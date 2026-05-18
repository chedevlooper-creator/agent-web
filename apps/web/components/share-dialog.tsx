"use client";

import { useState } from "react";
import { useChatStore } from "@/lib/store";
import { X, Check, Copy, Loader2 } from "lucide-react";

export function ShareDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const activeSessionId = useChatStore((s) => s.activeSessionId);

  const handleShare = async () => {
    if (!activeSessionId) return;
    setLoading(true);
    try {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: activeSessionId, expiresInHours: 24 }),
      });
      const data = await res.json();
      if (data.shareUrl) setShareUrl(data.shareUrl);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg border border-gray-700 bg-gray-900 p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-bold text-white">Share Session</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>

        {!shareUrl ? (
          <button
            onClick={handleShare}
            disabled={loading || !activeSessionId}
            className="w-full rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 size={14} className="mr-2 inline animate-spin" />
            ) : null}
            Generate Share Link
          </button>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded border border-gray-700 bg-gray-800 p-2">
              <input
                readOnly
                value={shareUrl}
                className="flex-1 bg-transparent text-xs text-gray-300 outline-none"
              />
              <button
                onClick={handleCopy}
                className="flex h-7 w-7 items-center justify-center rounded text-gray-400 hover:bg-gray-700 hover:text-white"
              >
                {copied ? (
                  <Check size={14} className="text-green-400" />
                ) : (
                  <Copy size={14} />
                )}
              </button>
            </div>
            <p className="text-[10px] text-gray-500">
              This link expires in 24 hours. Anyone with the link can view this
              session.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
