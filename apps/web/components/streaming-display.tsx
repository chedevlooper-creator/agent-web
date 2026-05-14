"use client";

import { useState, useEffect, useRef } from "react";

interface StreamingDisplayProps {
  text: string;
  isComplete: boolean;
  tokensPerSecond?: number;
}

export function StreamingDisplay({ text, isComplete, tokensPerSecond }: StreamingDisplayProps) {
  const [cursorVisible, setCursorVisible] = useState(true);

  useEffect(() => {
    if (!isComplete) {
      const interval = setInterval(() => setCursorVisible((v) => !v), 530);
      return () => clearInterval(interval);
    }
  }, [isComplete]);

  return (
    <div className="relative">
      <div className="prose dark:prose-invert prose-sm max-w-none">
        {text}
        {!isComplete && (
          <span
            className="inline-block w-2 h-4 bg-primary ml-0.5 align-middle rounded-sm transition-opacity duration-100"
            style={{ opacity: cursorVisible ? 1 : 0 }}
          />
        )}
      </div>
      {tokensPerSecond !== undefined && !isComplete && (
        <div className="absolute top-0 right-0 text-[9px] text-muted-foreground font-mono bg-muted/50 rounded px-1.5 py-0.5">
          {Math.round(tokensPerSecond)} tok/s
        </div>
      )}
    </div>
  );
}
