"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type SttState = "idle" | "recording" | "processing";

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
  }
}

/**
 * A microphone button that uses the browser's native SpeechRecognition API
 * (webkitSpeechRecognition) to transcribe speech into text.
 *
 * On successful transcription, calls `onTranscript(text)` so the parent can
 * populate the chat input or send directly.
 */
export function SttButton({
  onTranscript,
  disabled,
}: {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}) {
  const [state, setState] = useState<SttState>("idle");
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const isSupported =
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  const cleanup = useCallback(() => {
    try {
      recognitionRef.current?.abort();
    } catch {
      // ignore
    }
    recognitionRef.current = null;
  }, []);

  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  const handleClick = useCallback(() => {
    if (!isSupported) {
      toast.error("Speech recognition is not supported in this browser.");
      return;
    }

    if (state === "recording") {
      // Stop recording
      try {
        recognitionRef.current?.stop();
      } catch {
        // ignore
      }
      setState("idle");
      return;
    }

    // Start recording
    cleanup();

    const SpeechRecognitionAPI =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
      toast.error("Speech recognition is not available.");
      return;
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    let finalTranscript = "";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        }
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error("Speech recognition error:", event.error, event.message);
      if (event.error !== "no-speech" && event.error !== "aborted") {
        toast.error(`Speech recognition error: ${event.error}`);
      }
      setState("idle");
    };

    recognition.onend = () => {
      if (finalTranscript.trim()) {
        onTranscript(finalTranscript.trim());
      }
      setState("idle");
    };

    recognitionRef.current = recognition;
    recognition.start();
    setState("recording");
  }, [state, isSupported, cleanup, onTranscript]);

  const label =
    state === "recording"
      ? "Stop recording"
      : state === "processing"
        ? "Processing speech..."
        : "Start voice input";

  const Icon =
    state === "recording"
      ? MicOff
      : state === "processing"
        ? Loader2
        : Mic;

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={handleClick}
            disabled={disabled || !isSupported}
            aria-label={label}
            className={cn("shrink-0", state === "recording" && "text-[var(--destructive)]")}
          />
        }
      >
        <Icon
          size={14}
          className={cn(
            state === "recording" && "animate-pulse",
            state === "processing" && "animate-spin",
          )}
        />
        <span className="sr-only">{label}</span>
      </TooltipTrigger>
      <TooltipContent>
        <p>
          {!isSupported
            ? "Speech recognition not supported"
            : label}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}
