"use client";

import { useRef, useCallback } from "react";
import { Send, Square, Paperclip, Sparkles, CornerDownLeft, GitCompare } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UploadedFile } from "./file-upload";
import { FilePreviewBar } from "./file-upload";

interface ChatInputProps {
  input: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onCancel: () => void;
  isLoading: boolean;
  hasApiKey: boolean;
  provider: string;
  model: string;
  compareMode: boolean;
  effectiveModels: string[];
  attachedFiles: UploadedFile[];
  isUploading: boolean;
  onFileUpload: (files: FileList | null) => void;
  onRemoveFile: (storedName: string) => void;
}

export function ChatInput({
  input,
  onInputChange,
  onSend,
  onCancel,
  isLoading,
  hasApiKey,
  provider,
  model,
  compareMode,
  effectiveModels,
  attachedFiles,
  isUploading,
  onFileUpload,
  onRemoveFile,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const ta = e.target;
      ta.style.height = "auto";
      ta.style.height = Math.min(ta.scrollHeight, 320) + "px";
      onInputChange(e.target.value);
    },
    [onInputChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        onSend();
      }
    },
    [onSend]
  );

  const canSend = input.trim() && hasApiKey;

  return (
    <div className="shrink-0 z-10 w-full px-4 pb-4 pt-3">
      <div className="max-w-3xl mx-auto">
        {/* Compare mode badge */}
        {compareMode && effectiveModels.length > 1 && (
          <div className="mb-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] bg-accent/10 text-accent border border-accent/20 font-medium">
            <GitCompare size={11} />
            Compare: {effectiveModels.join(" vs ")}
          </div>
        )}

        {/* Attached files preview */}
        <FilePreviewBar files={attachedFiles} onRemove={onRemoveFile} />

        {/* Hidden file input */}
        <label htmlFor="file-upload-input" className="sr-only">Upload files</label>
        <input
          id="file-upload-input"
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.docx,.doc,.xlsx,.xls,.csv,.txt,.md,.json,.xml,.html,.py,.js,.ts,.tsx,.jsx,.css,.yaml,.yml,.sql"
          onChange={(e) => onFileUpload(e.target.files)}
          className="hidden"
        />

        {/* Input bar */}
        <div
          className={cn(
            "flex items-end gap-2 p-2.5 rounded-2xl",
            "bg-surface-elevated/60 border border-border/50 backdrop-blur-sm",
            "focus-within:ring-2 focus-within:ring-primary/15 focus-within:border-primary/30",
            "shadow-sm hover:shadow-md",
            "transition-all duration-300"
          )}
        >
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className={cn(
              "min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg shrink-0 transition-all duration-200",
              isUploading
                ? "text-primary animate-pulse"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
            aria-label="Attach file"
          >
            {isUploading ? (
              <Paperclip size={16} className="animate-spin" aria-hidden="true" />
            ) : (
              <Paperclip size={16} aria-hidden="true" />
            )}
          </button>
          <label htmlFor="chat-input-textarea" className="sr-only">Message</label>
          <textarea
            id="chat-input-textarea"
            ref={textareaRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder={hasApiKey ? "Message Agent Web..." : "Configure API key in settings first"}
            disabled={!hasApiKey}
            rows={1}
            className="flex-1 bg-transparent text-sm resize-none px-2.5 py-1.5 min-h-[40px] max-h-[320px]
                       placeholder:text-muted-foreground/50 focus:outline-none
                       disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            onClick={isLoading ? onCancel : onSend}
            disabled={!isLoading && !canSend}
            className={cn(
              "min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl shrink-0 transition-all duration-200",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              isLoading
                ? "bg-destructive text-white hover:bg-destructive/90 active:scale-95"
                : canSend
                  ? "bg-gradient-to-br from-primary to-accent text-white shadow-sm shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 active:scale-95"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
            )}
            aria-label={isLoading ? "Stop generation" : "Send message"}
          >
            {isLoading ? <Square size={14} className="fill-current" aria-hidden="true" /> : <Send size={16} aria-hidden="true" />}
          </button>
        </div>

        {/* Bottom hints */}
        <div className="flex items-center justify-between mt-1.5 px-1">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/60">
            <Sparkles className="w-3 h-3 text-primary/60" />
            <span>{provider}</span>
            <span className="text-border">/</span>
            <span className="font-medium text-muted-foreground/80">{model}</span>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground/50">
            <CornerDownLeft size={10} />
            <span>Enter to send</span>
            <span className="text-border">·</span>
            <kbd className="px-1.5 py-0.5 rounded-md border border-border-muted bg-surface-muted font-mono text-[9px]">Ctrl+N</kbd>
            <span>New chat</span>
          </div>
        </div>
      </div>
    </div>
  );
}
