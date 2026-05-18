"use client";

import { useState, useEffect, useCallback } from "react";
import { FileText, Trash2, ExternalLink, Upload, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface UploadedFile {
  name: string;
  path: string;
  size: number;
  mtime: number;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(ms: number): string {
  const d = new Date(ms);
  const now = new Date();
  const diffDays = Math.floor(
    (startOfDay(now).getTime() - startOfDay(d).getTime()) / (24 * 60 * 60 * 1000)
  );
  if (diffDays === 0) return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 1) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

interface FileManagerProps {
  expanded: boolean;
}

export function FileManager({ expanded }: FileManagerProps) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/upload");
      if (!res.ok) throw new Error("Failed to fetch files");
      const data = (await res.json()) as { files: UploadedFile[] };
      setFiles(data.files);
    } catch {
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchFiles();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [fetchFiles]);

  const handleDelete = useCallback(
    async (name: string) => {
      setDeleting(name);
      try {
        const res = await fetch(`/api/upload?name=${encodeURIComponent(name)}`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error("Delete failed");
        setFiles((prev) => prev.filter((f) => f.name !== name));
        toast.success("File deleted");
      } catch {
        toast.error("Failed to delete file");
      } finally {
        setDeleting(null);
        setConfirmDelete(null);
      }
    },
    []
  );

  const handlePreview = useCallback((file: UploadedFile) => {
    const previewUrl = `/api/upload/preview?path=${encodeURIComponent(file.name)}`;
    window.open(previewUrl, "_blank");
  }, []);

  if (!expanded) {
    return (
      <div className="flex-1 overflow-y-auto px-2 py-2">
        <div className="space-y-1">
          {loading ? (
            <div className="flex justify-center py-4">
              <Loader2 size={14} className="animate-spin text-[var(--muted-foreground)]" />
            </div>
          ) : files.length === 0 ? (
            <button
              className="mx-auto flex h-9 w-9 items-center justify-center text-[var(--muted-foreground)] hover:bg-[var(--overlay)] hover:text-[var(--foreground)]"
              title="Upload"
            >
              <Upload size={15} />
            </button>
          ) : (
            files.slice(0, 10).map((file) => (
              <button
                key={file.name}
                className="mx-auto flex h-9 w-9 items-center justify-center text-[var(--muted-foreground)] hover:bg-[var(--overlay)] hover:text-[var(--foreground)]"
                title={file.name}
              >
                <FileText size={15} />
              </button>
            ))
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2">
        <div className="flex items-center gap-2">
          <Upload size={14} className="text-[var(--primary)]" />
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--muted-foreground)]">
            Dosyalar
          </span>
          {!loading && (
            <span className="font-mono text-[9px] text-[var(--dim-foreground)]">
              {files.length}
            </span>
          )}
        </div>
        <button
          onClick={fetchFiles}
          className={cn(
            "flex h-6 w-6 items-center justify-center text-[var(--muted-foreground)] transition-colors hover:bg-[var(--surface-elevated)] hover:text-[var(--foreground)]",
            loading && "animate-spin"
          )}
          aria-label="Refresh file list"
        >
          <Loader2 size={12} />
        </button>
      </div>

      {/* File list */}
      <div className="flex-1 overflow-y-auto p-2">
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 bg-[var(--overlay)] p-2.5">
                <div className="h-4 w-4 animate-shimmer bg-[var(--surface-elevated)]" />
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="h-3 w-3/4 animate-shimmer bg-[var(--surface-elevated)]" />
                  <div className="h-2.5 w-1/3 animate-shimmer bg-[var(--surface-elevated)]" />
                </div>
              </div>
            ))}
          </div>
        ) : files.length === 0 ? (
          <div className="wk-file-empty">
            <Upload size={28} className="text-[var(--dim-foreground)]" />
            <span className="text-xs font-medium text-[var(--muted-foreground)]">
              Dosya yok
            </span>
            <span className="font-mono text-[10px] text-[var(--dim-foreground)]">
              Sohbet kutusundan dosya ekleyebilirsin
            </span>
          </div>
        ) : (
          <div className="space-y-1">
            {files.map((file) => (
              <div
                key={file.name}
                className="group flex items-center gap-2 border border-transparent bg-[var(--overlay)] p-2 transition-colors hover:border-[var(--border)]"
              >
                <FileText
                  size={14}
                  className="shrink-0 text-[var(--muted-foreground)]"
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium text-[var(--foreground)]">
                    {file.name}
                  </div>
                  <div className="flex items-center gap-2 font-mono text-[9px] text-[var(--dim-foreground)]">
                    <span>{formatSize(file.size)}</span>
                    <span>{formatDate(file.mtime)}</span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    onClick={() => handlePreview(file)}
                    className="flex h-6 w-6 items-center justify-center text-[var(--muted-foreground)] hover:bg-[var(--surface-elevated)] hover:text-[var(--foreground)]"
                    aria-label={`Preview ${file.name}`}
                  >
                    <ExternalLink size={12} />
                  </button>
                  {confirmDelete === file.name ? (
                    <div className="flex items-center gap-0.5">
                      <button
                        onClick={() => handleDelete(file.name)}
                        disabled={deleting === file.name}
                        className="flex h-6 w-6 items-center justify-center bg-[var(--destructive)] text-[var(--destructive-foreground)] hover:bg-[var(--destructive)]"
                        aria-label="Confirm delete"
                      >
                        {deleting === file.name ? (
                          <Loader2 size={11} className="animate-spin" />
                        ) : (
                          <Trash2 size={11} />
                        )}
                      </button>
                      <button
                        onClick={() => setConfirmDelete(null)}
                        className="flex h-6 w-6 items-center justify-center text-[var(--muted-foreground)] hover:bg-[var(--surface-elevated)] hover:text-[var(--foreground)]"
                        aria-label="Cancel delete"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDelete(file.name)}
                      className="flex h-6 w-6 items-center justify-center text-[var(--muted-foreground)] hover:bg-[var(--surface-elevated)] hover:text-[var(--destructive)]"
                      aria-label={`Delete ${file.name}`}
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
