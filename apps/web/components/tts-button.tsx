"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Volume2, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";

type SpeechState = "idle" | "playing" | "paused";

/**
 * A lightweight TTS button that uses the browser's native Web Speech API
 * (window.speechSynthesis) to read text aloud. Works entirely on the
 * frontend with zero backend dependency.
 *
 * Supports play / pause / resume and shows an animated icon while speaking.
 */
export function TtsButton({ text, onError }: { text: string; onError?: (msg: string) => void }) {
  const [state, setState] = useState<SpeechState>("idle");
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const isSpeechAvailable =
    typeof window !== "undefined" && "speechSynthesis" in window;

  const cleanup = useCallback(() => {
    window.speechSynthesis.cancel();
    utteranceRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  // Stop if text changes mid-speech
  useEffect(() => {
    if (state !== "idle") {
      cleanup();
      // Intentional: reset playback state when the source text prop changes.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState("idle");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  const handleClick = useCallback(() => {
    if (!isSpeechAvailable) {
      onError?.("Speech synthesis is not supported in this browser.");
      return;
    }

    if (state === "playing") {
      window.speechSynthesis.pause();
      setState("paused");
      return;
    }

    if (state === "paused") {
      window.speechSynthesis.resume();
      setState("playing");
      return;
    }

    // idle → start speaking
    cleanup();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.pitch = 1;

    utterance.onend = () => {
      utteranceRef.current = null;
      setState("idle");
    };
    utterance.onerror = (e) => {
      utteranceRef.current = null;
      setState("idle");
      onError?.(`Speech error: ${e.error}`);
    };

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
    setState("playing");
  }, [text, state, isSpeechAvailable, cleanup, onError]);

  const label =
    state === "playing" ? "Pause speech" : state === "paused" ? "Resume speech" : "Read aloud";
  const Icon =
    state === "paused" ? Play : Volume2;

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={handleClick}
            disabled={!text.trim()}
            aria-label={label}
            className={cn(
              "transition-colors",
              state === "playing" && "text-[var(--primary)]",
            )}
          />
        }
      >
        <Icon
          size={14}
          className={cn(
            state === "playing" && "animate-pulse",
            state === "paused" && "text-[var(--accent)]",
          )}
        />
        <span className="sr-only">{label}</span>
      </TooltipTrigger>
      <TooltipContent>
        <p>{label}</p>
      </TooltipContent>
    </Tooltip>
  );
}
