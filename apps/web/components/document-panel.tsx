"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useChatStore } from "@/lib/store";
import { getShortcutKeys, matchAnyShortcut } from "@/lib/shortcuts-config";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import {
  FileText,
  FileSpreadsheet,
  FileImage,
  FileType,
  File as FileIcon,
  Upload,
  Download,
  Trash2,
  X,
  Loader2,
  Eye,
  FileUp,
  AlertCircle,
  CheckCircle2,
  Copy,
  Check,
  Search,
  FileSymlink,
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ───────────────────────────────────────────────────────────────────

interface DocumentItem {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  extension: string;
  fileSize: number;
  content: string | null;
  uploadedAt: number;
}

interface UploadItem {
  id: string;
  name: string;
  size: number;
  progress: number;
  status: "uploading" | "success" | "error";
  error?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getDocumentIcon(extension: string) {
  const imageExts = ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "tiff"];
  const spreadsheetExts = ["xlsx", "xls", "csv"];
  const textExts = ["txt", "md", "json", "yaml", "yml", "html", "xml", "rtf"];

  if (extension === "pdf") return FileText;
  if (spreadsheetExts.includes(extension)) return FileSpreadsheet;
  if (imageExts.includes(extension)) return FileImage;
  if (textExts.includes(extension)) return FileType;
  if (["docx", "doc"].includes(extension)) return FileText;
  if (["pptx", "ppt"].includes(extension)) return FileIcon;
  return FileIcon;
}

function getDocumentColor(extension: string): string {
  const colors: Record<string, string> = {
    pdf: "text-red-500 dark:text-red-400",
    docx: "text-blue-600 dark:text-blue-400",
    doc: "text-blue-600 dark:text-blue-400",
    xlsx: "text-emerald-600 dark:text-emerald-400",
    xls: "text-emerald-600 dark:text-emerald-400",
    csv: "text-emerald-600 dark:text-emerald-400",
    pptx: "text-orange-500 dark:text-orange-400",
    ppt: "text-orange-500 dark:text-orange-400",
    txt: "text-slate-500 dark:text-slate-400",
    md: "text-slate-500 dark:text-slate-400",
    json: "text-amber-600 dark:text-amber-400",
    png: "text-purple-500 dark:text-purple-400",
    jpg: "text-purple-500 dark:text-purple-400",
    jpeg: "text-purple-500 dark:text-purple-400",
    gif: "text-purple-500 dark:text-purple-400",
  };
  return colors[extension] || "text-muted-foreground";
}

function getExtensionBadge(extension: string): string {
  return extension.toUpperCase();
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
const ACCEPTED_EXTENSIONS =
  ".pdf,.docx,.doc,.xlsx,.xls,.pptx,.ppt,.csv,.txt,.md,.json,.png,.jpg,.jpeg,.gif,.webp,.svg";

// ─── Skeleton Shimmer ────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-muted/60 ${className ?? ""}`}
      aria-hidden="true"
    />
  );
}

// ─── Delete Confirmation Inline ──────────────────────────────────────────────

function DeleteConfirm({
  onConfirm,
  onCancel,
  deleting,
}: {
  onConfirm: () => void;
  onCancel: () => void;
  deleting: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5 p-2 rounded-md bg-destructive/10 border border-destructive/20 animate-in fade-in slide-in-from-top-1 duration-200">
      <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
      <span className="text-xs text-destructive font-medium flex-1">
        Silinsin mi?
      </span>
      <Button
        variant="destructive"
        size="xs"
        className="h-6 text-[10px] px-2"
        onClick={onConfirm}
        disabled={deleting}
        aria-label="Silme işlemini onayla"
      >
        {deleting ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          "Evet, sil"
        )}
      </Button>
      <Button
        variant="ghost"
        size="xs"
        className="h-6 text-[10px] px-2"
        onClick={onCancel}
        disabled={deleting}
        aria-label="Silme işlemini iptal et"
      >
        İptal
      </Button>
    </div>
  );
}

// ─── Drag & Drop Upload Zone ─────────────────────────────────────────────────

function UploadZone({
  onUpload,
  uploadItems,
  inputRef: externalInputRef,
}: {
  onUpload: (files: File[]) => Promise<void>;
  uploadItems: UploadItem[];
  inputRef?: React.RefObject<HTMLInputElement | null>;
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragging(false);
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) onUpload(files);
    },
    [onUpload]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (files.length > 0) onUpload(files);
      if (inputRef.current) inputRef.current.value = "";
    },
    [onUpload]
  );

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label="Dosya yüklemek için tıklayın veya sürükleyin"
      aria-describedby="upload-description"
      className={`
        group relative cursor-pointer rounded-xl border-2 border-dashed p-6
        transition-all duration-300 ease-out
        outline-none
        focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2
        ${
          dragging
            ? "border-primary bg-primary/5 shadow-lg shadow-primary/5 scale-[1.02]"
            : "border-border/40 hover:border-primary/40 hover:bg-accent/20 hover:shadow-sm"
        }
        ${uploadItems.length > 0 ? "pointer-events-none opacity-60" : ""}
      `}
    >
      <input
        ref={(el) => {
          (inputRef as React.MutableRefObject<HTMLInputElement | null>).current = el;
          if (externalInputRef && typeof externalInputRef === "object") {
            (externalInputRef as React.MutableRefObject<HTMLInputElement | null>).current = el;
          }
        }}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileSelect}
        accept={ACCEPTED_EXTENSIONS}
        aria-hidden="true"
      />

      {/* Animated background gradient on drag */}
      {dragging && (
        <div
          className="absolute inset-0 rounded-xl bg-gradient-to-br from-primary/5 via-transparent to-primary/5 animate-in fade-in duration-300"
          aria-hidden="true"
        />
      )}

      <div className="relative flex flex-col items-center gap-3 text-center">
        {uploadItems.length > 0 ? (
          <>
            <div className="relative">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
            <div className="w-full space-y-2">
              <p className="text-sm font-medium text-foreground/80">
                Yükleniyor ({uploadItems.filter((i) => i.status === "success").length}/{uploadItems.length})
              </p>
              <div className="space-y-1.5">
                {uploadItems.map((item) => (
                  <div key={item.id} className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <span className="text-xs truncate text-foreground/70">
                          {item.name}
                        </span>
                        <span className="text-[10px] font-mono tabular-nums shrink-0 text-muted-foreground/50">
                          {item.status === "uploading"
                            ? `%${item.progress}`
                            : item.status === "success"
                              ? "✓"
                              : "✗"}
                        </span>
                      </div>
                      <div className="h-1 w-full rounded-full bg-muted/60 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ease-out ${
                            item.status === "success"
                              ? "bg-emerald-500/70"
                              : item.status === "error"
                                ? "bg-destructive/70"
                                : "bg-primary"
                          }`}
                          style={{ width: `${item.progress}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <>
            <div
              className={`
                rounded-full p-3 transition-all duration-300
                ${
                  dragging
                    ? "bg-primary/15 scale-110"
                    : "bg-muted group-hover:bg-accent"
                }
              `}
            >
              <FileUp
                className={`
                  h-6 w-6 transition-all duration-300
                  ${dragging ? "text-primary scale-110" : "text-muted-foreground"}
                `}
              />
            </div>
            <div className="space-y-1.5">
              <p className="text-sm font-medium">
                <span className="text-primary hover:underline decoration-primary/30 underline-offset-2">
                  Dosya seç
                </span>{" "}
                <span className="text-muted-foreground/70">veya sürükle bırak</span>
              </p>
              <p
                id="upload-description"
                className="text-xs text-muted-foreground/60 leading-relaxed max-w-[200px] mx-auto"
              >
                PDF, DOCX, XLSX, PPTX, CSV, TXT, MD, JSON ve görseller &middot;{" "}
                <span className="font-medium">50MB</span> max &middot; birden çok seçin{" "}
                <kbd className="ml-0.5 inline-flex items-center rounded border border-border/30 bg-muted/60 px-1 text-[10px] font-medium leading-none text-muted-foreground/50">
                  Ctrl+U
                </kbd>
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Document Card ────────────────────────────────────────────────────────────

function DocumentCard({
  doc,
  onDelete,
  onPreview,
  isSelected,
  style,
}: {
  doc: DocumentItem;
  onDelete: (id: string) => void;
  onPreview: (doc: DocumentItem) => void;
  isSelected: boolean;
  style?: React.CSSProperties;
}) {
  const Icon = getDocumentIcon(doc.extension);
  const colorClass = getDocumentColor(doc.extension);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  return (
    <Card
      className={`
        group relative overflow-hidden
        transition-all duration-200 ease-out
        hover:shadow-md hover:border-border/60
        ${
          isSelected
            ? "ring-2 ring-primary/40 border-primary/30 shadow-sm"
            : ""
        }
      `}
      style={style}
    >
      <div className="p-3">
        <div className="flex items-start gap-3">
          {/* Icon with gradient container */}
          <div className="relative shrink-0 mt-0.5">
            <div
              className={`
                flex items-center justify-center w-10 h-10 rounded-lg
                transition-all duration-200
                ${isSelected ? "bg-primary/10" : "bg-muted/60 group-hover:bg-accent"}
              `}
            >
              <Icon className={`h-5 w-5 ${colorClass}`} />
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <p className="text-sm font-medium truncate text-foreground/90 group-hover:text-foreground transition-colors">
                {doc.originalName}
              </p>
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 h-4 font-mono shrink-0"
              >
                {getExtensionBadge(doc.extension)}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground/70">
              {formatFileSize(doc.fileSize)}
              <span className="mx-1.5 inline-block text-[8px] opacity-50" aria-hidden="true">
                ●
              </span>
              {formatDate(doc.uploadedAt)}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 mt-2.5 pt-2.5 border-t border-border/20">
          <Tooltip>
            <TooltipTrigger className="inline-flex">
              <Button
                variant="ghost"
                size="icon-xs"
                className="h-7 w-7 hover:bg-accent/80"
                onClick={() => onPreview(doc)}
                aria-label={`Önizle: ${doc.originalName}`}
              >
                <Eye className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              Önizle
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger className="inline-flex">
              <Button
                variant="ghost"
                size="icon-xs"
                className="h-7 w-7 hover:bg-accent/80"
                onClick={() => window.open(`/api/documents/${doc.id}/download`, "_blank")}
                aria-label={`İndir: ${doc.originalName}`}
              >
                <Download className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              İndir
            </TooltipContent>
          </Tooltip>

          <div className="ml-auto">
            {showDeleteConfirm ? (
              <DeleteConfirm
                onConfirm={() => {
                  setShowDeleteConfirm(false);
                  onDelete(doc.id);
                }}
                onCancel={() => setShowDeleteConfirm(false)}
                deleting={false}
              />
            ) : (
              <Tooltip>
                <TooltipTrigger className="inline-flex">
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="h-7 w-7 text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10"
                    onClick={() => setShowDeleteConfirm(true)}
                    aria-label={`Sil: ${doc.originalName}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  Sil{" "}
                  <kbd className="ml-0.5 inline-flex items-center rounded border border-border/30 bg-muted/60 px-1 text-[10px] font-medium leading-none text-muted-foreground/50">
                    Delete
                  </kbd>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

// ─── Document Preview ────────────────────────────────────────────────────────

function DocumentPreview({
  doc,
  onClose,
  closeRef,
}: {
  doc: DocumentItem;
  onClose: () => void;
  closeRef?: React.RefObject<HTMLButtonElement | null>;
}) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadContent() {
      setLoading(true);
      setContent(null);
      try {
        const res = await fetch(`/api/documents/${doc.id}`);
        if (!cancelled) {
          if (res.ok) {
            const data = await res.json();
            setContent(data.content || null);
          } else {
            setContent(null);
          }
        }
      } catch {
        if (!cancelled) setContent(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadContent();

    return () => {
      cancelled = true;
    };
  }, [doc.id]);

  const handleCopy = useCallback(async () => {
    if (content) {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      toast.success("İçerik panoya kopyalandı");
      setTimeout(() => setCopied(false), 2000);
    }
  }, [content]);

  const hasContent = content && content.length > 0 && content !== "(İçerik yok)";

  return (
    <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          {(() => {
            const Icon = getDocumentIcon(doc.extension);
            return (
              <Icon
                className={`h-4 w-4 shrink-0 ${getDocumentColor(doc.extension)}`}
              />
            );
          })()}
          <p className="text-sm font-medium truncate text-foreground/90">
            {doc.originalName}
          </p>
        </div>          <Button
          ref={closeRef}
          variant="ghost"
          size="icon-xs"
          className="h-7 w-7 shrink-0"
          onClick={onClose}
          aria-label="Önizlemeyi kapat"
        >
          <X className="h-3.5 w-3.5" />
          <kbd className="ml-1 rounded border border-border/30 bg-muted/60 px-1 text-[10px] font-medium leading-none text-muted-foreground/60">
            Esc
          </kbd>
        </Button>
      </div>

      {/* Metadata pills */}
      <div className="flex flex-wrap gap-1.5">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-[11px] text-muted-foreground font-mono">
          {getExtensionBadge(doc.extension)}
        </span>
        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-muted text-[11px] text-muted-foreground">
          {formatFileSize(doc.fileSize)}
        </span>
        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-muted text-[11px] text-muted-foreground">
          {formatDate(doc.uploadedAt)}
        </span>
      </div>

      {/* Content */}
      <div className="relative min-h-[80px]">
        {loading ? (
          <div className="space-y-2 p-4 rounded-lg bg-muted/30">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-[90%]" />
            <Skeleton className="h-3 w-[80%]" />
            <Skeleton className="h-3 w-[95%]" />
            <Skeleton className="h-3 w-[60%]" />
          </div>
        ) : hasContent ? (
          <div className="group/preview relative rounded-lg bg-muted/40 border border-border/20">
            <div className="absolute top-2 right-2 opacity-0 group-hover/preview:opacity-100 transition-opacity duration-200">
              <Tooltip>
                <TooltipTrigger className="inline-flex">
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="h-7 w-7 bg-background/80 backdrop-blur-sm hover:bg-background"
                    onClick={handleCopy}
                    aria-label="İçeriği kopyala"
                  >
                    {copied ? (
                      <Check className="h-3.5 w-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left" className="text-xs">
                  {copied ? "Kopyalandı" : "Kopyala"}
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="p-4 overflow-auto max-h-52">
              <pre className="text-xs leading-relaxed whitespace-pre-wrap break-words font-mono text-muted-foreground/90">
                {content}
              </pre>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-8 rounded-lg bg-muted/20 border border-dashed border-border/30">
            <AlertCircle className="h-6 w-6 text-muted-foreground/30" />
            <p className="text-xs text-muted-foreground/50">
              Bu dosyanın metin içeriği görüntülenemiyor
            </p>
            <p className="text-[10px] text-muted-foreground/30">
              Dosyayı indirerek açmayı deneyin
            </p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        <Button
          variant="default"
          size="sm"
          className="gap-1.5 h-8 text-xs"
          onClick={() => window.open(`/api/documents/${doc.id}/download`, "_blank")}
        >
          <Download className="h-3.5 w-3.5" />
          <span>İndir</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs h-8"
          onClick={onClose}
        >
          Kapat
        </Button>
      </div>
    </div>
  );
}

// ─── Empty State ─────────────────────────────────────────────────────────────

function EmptyState({ onUpload }: { onUpload: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 py-12 text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="relative">
        <div className="rounded-2xl bg-gradient-to-br from-primary/5 via-primary/[0.02] to-transparent p-6">
          <FileSymlink className="h-12 w-12 text-primary/30" />
        </div>
        <div className="absolute -bottom-1 -right-1 rounded-full bg-background p-1">
          <Upload className="h-4 w-4 text-primary/40" />
        </div>
      </div>
      <div className="space-y-1.5 max-w-[220px]">
        <p className="text-sm font-medium text-foreground/70">
          Henüz doküman yok
        </p>
        <p className="text-xs text-muted-foreground/50 leading-relaxed">
          Dosya yüklemek için yukarıdaki alana sürükleyin veya tıklayarak seçin
        </p>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 text-xs h-8 mt-1"
        onClick={onUpload}
      >
        <Upload className="h-3.5 w-3.5" />
        <span>Dosya Yükle</span>
      </Button>
    </div>
  );
}

// ─── Document Tab (Main Export) ──────────────────────────────────────────────

export function DocumentTab() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDoc, setSelectedDoc] = useState<DocumentItem | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [uploadItems, setUploadItems] = useState<UploadItem[]>([]);
  const uploadRef = useRef<HTMLDivElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const previewCloseRef = useRef<HTMLButtonElement>(null);
  const uploadCleanupRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const uploadIdCounter = useRef(0);
  const deleteTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const countdownRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 200);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Filter documents by name
  const filteredDocuments = useMemo(
    () =>
      debouncedSearch
        ? documents.filter((d) =>
            d.originalName.toLowerCase().includes(debouncedSearch.toLowerCase())
          )
        : documents,
    [documents, debouncedSearch]
  );

  // ─── Load documents ─────────────────────────────────────────────────

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/documents");
      if (res.ok) {
        const data = await res.json();
        setDocuments(data.documents || data || []);
      }
    } catch (e) {
      console.error("Failed to load documents:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  // ─── Upload ──────────────────────────────────────────────────────────

  const handleUpload = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;

      const validFiles: File[] = [];
      for (const file of files) {
        if (file.size > MAX_FILE_SIZE) {
          toast.error(`${file.name} çok büyük`, {
            description: "Maksimum dosya boyutu 50 MB",
          });
        } else {
          validFiles.push(file);
        }
      }

      if (validFiles.length === 0) return;

      // Create upload items
      const items: UploadItem[] = validFiles.map((f, i) => ({
        id: `upload-${++uploadIdCounter.current}-${i}`,
        name: f.name,
        size: f.size,
        progress: 0,
        status: "uploading" as const,
      }));

      setUploadItems(items);

      // Upload all files in parallel
      const results = await Promise.allSettled(
        items.map((item, index) => {
          const file = validFiles[index];
          return new Promise<void>((resolve, reject) => {
            const xhr = new XMLHttpRequest();

            xhr.upload.onprogress = (e: ProgressEvent) => {
              if (e.lengthComputable) {
                const percent = Math.round((e.loaded / e.total) * 100);
                setUploadItems((prev) =>
                  prev.map((p) =>
                    p.id === item.id ? { ...p, progress: percent } : p
                  )
                );
              }
            };

            xhr.onload = () => {
              if (xhr.status >= 200 && xhr.status < 300) {
                setUploadItems((prev) =>
                  prev.map((p) =>
                    p.id === item.id
                      ? { ...p, progress: 100, status: "success" }
                      : p
                  )
                );
                resolve();
              } else {
                try {
                  const err = JSON.parse(xhr.responseText);
                  reject(new Error(err.error || "Yükleme başarısız"));
                } catch {
                  reject(new Error(`Yükleme başarısız (${xhr.status})`));
                }
              }
            };

            xhr.onerror = () => reject(new Error("Ağ hatası"));
            xhr.onabort = () => reject(new Error("Yükleme iptal edildi"));

            const formData = new FormData();
            formData.append("file", file);

            xhr.open("POST", "/api/documents");
            xhr.send(formData);
          });
        })
      );

      // Process results
      let successCount = 0;
      let failCount = 0;

      for (const result of results) {
        if (result.status === "fulfilled") {
          successCount++;
        } else {
          failCount++;
        }
      }

      // Mark failed items
      results.forEach((result, i) => {
        if (result.status === "rejected") {
          setUploadItems((prev) =>
            prev.map((p) =>
              p.id === items[i].id
                ? { ...p, status: "error", error: result.reason?.message }
                : p
            )
          );
        }
      });

      // Summary toast
      if (failCount === 0) {
        toast.success(
          successCount === 1
            ? `“${validFiles[0].name}” yüklendi`
            : `${successCount} dosya yüklendi`,
          {
            icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
          }
        );
      } else {
        toast.warning(
          `${successCount} dosya yüklendi, ${failCount} başarısız`,
          {
            icon: <AlertCircle className="h-4 w-4 text-destructive" />,
          }
        );
      }

      await loadDocuments();

      // Clear upload items after a moment
      if (uploadCleanupRef.current) clearTimeout(uploadCleanupRef.current);
      uploadCleanupRef.current = setTimeout(() => setUploadItems([]), 2500);
    },
    [loadDocuments]
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (uploadCleanupRef.current) clearTimeout(uploadCleanupRef.current);
    };
  }, []);

  // ─── Delete ──────────────────────────────────────────────────────────

  const handleDelete = useCallback(
    async (id: string) => {
      setDeleting(id);
      try {
        const res = await fetch(`/api/documents/${id}`, {
          method: "DELETE",
        });

        if (res.ok) {
          toast.success("Dosya silindi", {
            icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
          });
          if (selectedDoc?.id === id) setSelectedDoc(null);
          await loadDocuments();
        } else {
          toast.error("Silme başarısız");
        }
      } catch {
        toast.error("Silme başarısız");
      } finally {
        setDeleting(null);
      }
    },
    [loadDocuments, selectedDoc]
  );

  // ─── Scroll to upload on empty state CTA ─────────────────────────────

  const scrollToUpload = useCallback(() => {
    uploadRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // ─── Keyboard shortcuts ───────────────────────────────────────────

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const isInputting =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      const overrides = useChatStore.getState().shortcutOverrides;

      // Escape — close preview
      if (
        selectedDoc &&
        !isInputting &&
        matchAnyShortcut(e, getShortcutKeys("close-preview", overrides))
      ) {
        e.preventDefault();
        setSelectedDoc(null);
        return;
      }

      // Ctrl+U (or Cmd+U on Mac) — trigger upload
      if (matchAnyShortcut(e, getShortcutKeys("upload-document", overrides))) {
        e.preventDefault();
        uploadInputRef.current?.click();
        return;
      }

      // Delete — delete selected document with undo safety net
      if (
        selectedDoc &&
        !isInputting &&
        matchAnyShortcut(e, getShortcutKeys("delete-document", overrides))
      ) {
        e.preventDefault();
        const doc = selectedDoc;
        // Clear any previous pending delete timeout and countdown
        if (deleteTimeoutRef.current) clearTimeout(deleteTimeoutRef.current);
        if (countdownRef.current) clearInterval(countdownRef.current);

        const totalSeconds = 5;
        let remaining = totalSeconds;

        const toastId = toast(`"${doc.originalName}" siliniyor...`, {
          description: `${remaining}sn`,
          duration: 5000,
          action: {
            label: "Geri Al",
            onClick: () => {
              if (countdownRef.current) {
                clearInterval(countdownRef.current);
                countdownRef.current = undefined;
              }
              if (deleteTimeoutRef.current) {
                clearTimeout(deleteTimeoutRef.current);
                deleteTimeoutRef.current = undefined;
              }
              toast.dismiss(toastId);
              toast.success("Silme iptal edildi");
            },
          },
        });

        // Live countdown: update toast description every second
        countdownRef.current = setInterval(() => {
          remaining--;
          if (remaining <= 0) {
            clearInterval(countdownRef.current!);
            countdownRef.current = undefined;
          } else {
            toast(toastId, { description: `${remaining}sn` });
          }
        }, 1000);

        // Actual delete fires after 5s if not undone
        deleteTimeoutRef.current = setTimeout(() => {
          if (countdownRef.current) {
            clearInterval(countdownRef.current);
            countdownRef.current = undefined;
          }
          handleDelete(doc.id);
        }, 5000);
        return;
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      // Clean up any pending delete timeout and countdown on unmount
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = undefined;
      }
      if (deleteTimeoutRef.current) {
        clearTimeout(deleteTimeoutRef.current);
        deleteTimeoutRef.current = undefined;
      }
    };
  }, [selectedDoc, handleDelete]);

  // Focus management — when preview opens, focus close button
  useEffect(() => {
    if (selectedDoc) {
      // Small delay to let the preview render
      requestAnimationFrame(() => {
        previewCloseRef.current?.focus();
      });
    }
  }, [selectedDoc]);

  // ─── Render ──────────────────────────────────────────────────────────

  const hasDocuments = documents.length > 0;

  return (
    <div className="space-y-4" role="region" aria-label="Doküman yönetimi">
      {/* Upload Zone */}
      <div ref={uploadRef}>
        <UploadZone onUpload={handleUpload} uploadItems={uploadItems} inputRef={uploadInputRef} />
      </div>

      {/* Preview Mode */}
      {selectedDoc && (
        <div
          className="rounded-xl border border-border/40 bg-card p-4 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300"
          role="complementary"
          aria-label="Doküman önizleme"
        >
          <DocumentPreview
            doc={selectedDoc}
            onClose={() => setSelectedDoc(null)}
            closeRef={previewCloseRef}
          />
        </div>
      )}

      {/* Document List */}
      <div className="space-y-1.5" role="region" aria-label="Doküman listesi">
        {/* Search input */}
        {hasDocuments && (
          <div className="relative px-0.5">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Dosya adıyla filtrele…"
              aria-label="Dosya adına göre filtrele"
              className="
                w-full h-8 pl-8 pr-7 text-xs
                rounded-lg border border-border/30
                bg-accent/30
                placeholder:text-muted-foreground/30
                outline-none
                transition-all duration-200
                focus:border-primary/30 focus:bg-accent/50 focus:ring-1 focus:ring-primary/20
              "
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-muted-foreground/30 hover:text-muted-foreground/70 transition-colors"
                aria-label="Filtreyi temizle"
                type="button"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        )}

        <div className="flex items-center justify-between px-0.5">
          <h3 className="text-xs font-semibold text-muted-foreground/80 uppercase tracking-widest">
            Dokümanlar
          </h3>
          {hasDocuments && (
            <span className="text-[10px] text-muted-foreground/50 font-mono tabular-nums">
              {searchQuery
                ? `${filteredDocuments.length}/${documents.length}`
                : `${documents.length} dosya`}
            </span>
          )}
        </div>

        {loading ? (
          <div className="space-y-2 pt-1">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="p-3">
                <div className="flex items-start gap-3">
                  <Skeleton className="h-10 w-10 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-[60%]" />
                    <Skeleton className="h-3 w-[40%]" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : filteredDocuments.length > 0 ? (
          <div className="space-y-2 pt-1.5">
            {filteredDocuments.map((doc, index) => (
              <div
                key={doc.id}
                className="relative animate-in fade-in slide-in-from-bottom-1 duration-300"
                style={{ animationDelay: `${index * 40}ms` }}
                role="listitem"
              >
                {deleting === doc.id && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-background/70 backdrop-blur-[2px] animate-in fade-in duration-200">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  </div>
                )}
                <DocumentCard
                  doc={doc}
                  onDelete={handleDelete}
                  onPreview={(d) => setSelectedDoc(d)}
                  isSelected={selectedDoc?.id === doc.id}
                />
              </div>
            ))}
          </div>
        ) : hasDocuments && searchQuery ? (
          <div className="flex flex-col items-center gap-1.5 py-6 text-center animate-in fade-in duration-200">
            <Search className="h-5 w-5 text-muted-foreground/20" />
            <p className="text-xs text-muted-foreground/40">
              &ldquo;{searchQuery}&rdquo; ile eşleşen dosya yok
            </p>
            <button
              onClick={() => setSearchQuery("")}
              className="text-[10px] text-primary/60 hover:text-primary underline underline-offset-2 transition-colors"
              type="button"
            >
              Filtreyi temizle
            </button>
          </div>
        ) : (
          <EmptyState onUpload={scrollToUpload} />
        )}
      </div>

    </div>
  );
}
