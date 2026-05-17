"use client";

import { useRef, useCallback } from "react";
import { Square, Paperclip, GitCompare } from "lucide-react";
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
  contextPanelOpen: boolean;
  onAddContext: () => void;
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
  contextPanelOpen,
  onAddContext,
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
  const composerModel = model || `${provider}/model`;

  return (
    <div className="shrink-0 z-10 w-full px-6 pb-0 pt-2">
      <div className="max-w-[900px] mx-auto flex flex-col gap-3">
        {/* Compare mode badge */}
        {compareMode && effectiveModels.length > 1 && (
          <div className="mb-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] bg-accent/10 text-accent border border-accent/20 font-medium w-fit">
            <GitCompare size={11} />
            Karşılaştır: {effectiveModels.join(" vs ")}
          </div>
        )}

        {/* Attached files preview */}
        <FilePreviewBar files={attachedFiles} onRemove={onRemoveFile} />

        {/* Hidden file input */}
        <label htmlFor="file-upload-input" className="sr-only">Dosya yükle</label>
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
            "composer-frame flex flex-col p-4 md:p-5",
            "focus-within:ring-1 focus-within:ring-electric/30",
            "transition-[border-color,box-shadow,background-color] duration-300"
          )}
        >
          <label htmlFor="chat-input-textarea" className="sr-only">Mesaj</label>
          <textarea
            id="chat-input-textarea"
            data-chat-input="true"
            ref={textareaRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Agent Web'e her şeyi sor..."
            disabled={!hasApiKey}
            rows={1}
            className="w-full bg-transparent text-[15px] resize-none mb-6 min-h-[36px] max-h-[320px]
                       font-mono placeholder:text-muted-foreground focus:outline-none
                       disabled:opacity-50 disabled:cursor-not-allowed"
          />

          {/* Bottom Controls */}
          <div className="flex items-center justify-between">
            {/* Left side */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className={cn(
                  "h-12 w-12 flex items-center justify-center rounded-lg border border-border/40 bg-black/20 shrink-0 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isUploading
                    ? "text-primary animate-pulse"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                )}
                aria-label="Dosya ekle"
                data-tooltip={isUploading ? "Dosya yükleniyor" : "Dosya ekle"}
                title={isUploading ? "Dosya yükleniyor" : "Dosya ekle"}
              >
                {isUploading ? (
                  <Paperclip size={18} className="animate-spin" aria-hidden="true" />
                ) : (
                  <Paperclip size={18} aria-hidden="true" />
                )}
              </button>

              <button
                type="button"
                onClick={onAddContext}
                className={cn(
                  "h-12 px-4 flex items-center gap-2 rounded-lg border text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  contextPanelOpen
                    ? "border-electric/40 bg-electric-muted/25 text-electric"
                    : "border-border/40 bg-black/20 text-muted-foreground hover:text-foreground hover:bg-white/5"
                )}
                aria-label={contextPanelOpen ? "Bağlam paneli açık" : "Bağlam panelini aç"}
                aria-expanded={contextPanelOpen}
                aria-controls="context-panel"
              >
                <div className="relative">
                  <Square size={14} className="opacity-50 absolute -top-0.5 -left-0.5" />
                  <Square size={14} className="opacity-75 absolute top-0.5 left-0.5" />
                  <Square size={14} className="relative z-10" />
                </div>
                Bağlam ekle
              </button>
            </div>

            {/* Right side */}
            <div className="flex items-center gap-2">
              <div className="h-12 flex items-center gap-2 px-4 rounded-lg bg-black/30 border border-border/40 text-xs text-muted-foreground cursor-pointer hover:bg-black/50 transition-colors">
                <span className="max-w-[170px] truncate font-mono">{composerModel}</span>
                <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>

              <button
                type="button"
                onClick={isLoading ? onCancel : onSend}
                disabled={!isLoading && !canSend}
                className={cn(
                  "h-14 w-16 flex items-center justify-center transition-all duration-200",
                  "focus-visible:ring-2 focus-visible:ring-electric focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  isLoading
                    ? "bg-destructive text-white hover:bg-destructive/90 active:scale-90 clip-path-composer"
                    : canSend
                      ? "bg-electric text-black shadow-[0_0_15px_rgba(176,226,39,0.25)] hover:shadow-[0_0_30px_rgba(176,226,39,0.5)] active:scale-90"
                      : "bg-electric text-black opacity-60 cursor-not-allowed",
                  "clip-path-composer"
                )}
                style={{
                   clipPath: "polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)"
                }}
                aria-label={isLoading ? "Durdur" : "Mesaj gönder"}
              >
                {isLoading ? (
                   <Square size={14} className="fill-current" aria-hidden="true" />
                ) : (
                   <div className="relative">
                     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                       <polygon points="3 11 22 2 13 21 11 13 3 11" />
                     </svg>
                     <span className="absolute -top-1 -right-2 text-[10px] font-bold">+</span>
                   </div>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Shortcuts */}
        <div className="flex items-center justify-center gap-6 mt-1 text-[10px] text-muted-foreground font-mono">
          <div className="flex items-center gap-1.5"><span className="px-1.5 py-0.5 rounded bg-black/40 border border-border/50">Enter</span> gönder</div>
          <div className="flex items-center gap-1.5"><span className="px-1.5 py-0.5 rounded bg-black/40 border border-border/50">Shift+Enter</span> yeni satır</div>
          <div className="flex items-center gap-1.5"><span className="px-1.5 py-0.5 rounded bg-black/40 border border-border/50">Ctrl+K</span> ara</div>
          <div className="flex items-center gap-1.5"><span className="px-1.5 py-0.5 rounded bg-black/40 border border-border/50">Ctrl+T</span> araçları aç/kapat</div>
        </div>

      </div>
    </div>
  );
}
