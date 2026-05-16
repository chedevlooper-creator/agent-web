import { useRef, useState, useCallback, useEffect, useMemo } from "react";
import { toast } from "sonner";
import type { UploadedFile } from "@/components/chat/file-upload";

export function useScrollAnchor(messageCount: number) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const shouldAutoScroll = useRef(true);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (shouldAutoScroll.current) {
      scrollToBottom();
    }
  }, [messageCount, scrollToBottom]);

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const nearBottom = distFromBottom < 100;
    shouldAutoScroll.current = nearBottom;
    setShowScrollBtn(!nearBottom);
  }, []);

  return useMemo(() => ({
    messagesEndRef,
    scrollContainerRef,
    showScrollBtn,
    scrollToBottom,
    handleScroll,
  }), [showScrollBtn, scrollToBottom, handleScroll]);
}

export function useFileUpload() {
  const [attachedFiles, setAttachedFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileUpload = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);
    const newFiles: UploadedFile[] = [];

    for (const file of Array.from(files)) {
      try {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        const data = await res.json();
        if (!res.ok) {
          toast.error(`Failed to upload ${file.name}: ${data.error}`);
          continue;
        }
        newFiles.push({
          name: data.file.name,
          storedName: data.file.storedName,
          size: data.file.size,
          type: data.file.type,
          content: data.content,
          uploadedAt: data.file.uploadedAt,
        });
        toast.success(`Uploaded ${file.name}`);
      } catch (err) {
        toast.error(`Failed to upload ${file.name}`);
        console.error(err);
      }
    }

    setAttachedFiles((prev) => [...prev, ...newFiles]);
    setIsUploading(false);
  }, []);

  const removeAttachedFile = useCallback((storedName: string) => {
    setAttachedFiles((prev) => prev.filter((f) => f.storedName !== storedName));
  }, []);

  const clearAttachedFiles = useCallback(() => {
    setAttachedFiles([]);
  }, []);

  return {
    attachedFiles,
    isUploading,
    handleFileUpload,
    removeAttachedFile,
    clearAttachedFiles,
  };
}
