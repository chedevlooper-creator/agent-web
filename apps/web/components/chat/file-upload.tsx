import { X, FileText, FileSpreadsheet, File } from "lucide-react";

export interface UploadedFile {
  name: string;
  storedName: string;
  size: number;
  type: string;
  content: string;
  uploadedAt: number;
}

export function getFileIcon(type: string) {
  if (type === ".pdf") return <FileText size={14} className="text-red-400" />;
  if (type === ".docx" || type === ".doc") return <FileText size={14} className="text-blue-400" />;
  if (type === ".xlsx" || type === ".xls" || type === ".csv") return <FileSpreadsheet size={14} className="text-green-400" />;
  return <File size={14} className="text-muted-foreground" />;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

interface FilePreviewBarProps {
  files: UploadedFile[];
  onRemove: (storedName: string) => void;
}

export function FilePreviewBar({ files, onRemove }: FilePreviewBarProps) {
  if (files.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mb-2">
      {files.map((f) => (
        <div
          key={f.storedName}
          className="flex min-h-[44px] items-center gap-2 pl-3 pr-1.5 py-1 rounded-xl bg-primary/8 border border-primary/20 text-xs font-medium text-foreground animate-slide-up"
        >
          {getFileIcon(f.type)}
          <span className="max-w-[120px] truncate">{f.name}</span>
          <span className="text-[10px] text-muted-foreground">{formatFileSize(f.size)}</span>
          <button
            onClick={() => onRemove(f.storedName)}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-destructive/20 hover:text-destructive transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`${f.name}'i kaldır`}
          >
            <X size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}
