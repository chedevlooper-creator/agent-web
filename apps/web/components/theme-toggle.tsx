"use client";

import { useState, useEffect, useCallback } from "react";
import { Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";

const THEME_KEY = "agent-web-theme";

type Theme = "night" | "day";

function getInitialTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === "day" || stored === "night") return stored;
    // Map legacy values
    if (stored === "light") return "day";
    if (stored === "dark") return "night";
  } catch {}
  if (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: light)").matches) {
    return "day";
  }
  return "night";
}

function applyTheme(theme: Theme) {
  if (theme === "day") {
    document.documentElement.setAttribute("data-theme", "day");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
}

export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>("night");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const initial = getInitialTheme();
    setTheme(initial);
    applyTheme(initial);
    setMounted(true);
  }, []);

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === "night" ? "day" : "night";
      applyTheme(next);
      try { localStorage.setItem(THEME_KEY, next); } catch {}
      return next;
    });
  }, []);

  if (!mounted) {
    return (
      <button
        type="button"
        className={cn(
          "flex h-7 w-7 items-center justify-center text-[var(--ink-faint)] transition-colors hover:bg-[var(--bg-elev)] hover:text-[var(--ink)]",
          className
        )}
        aria-label="Tema değiştir"
        disabled
      >
        <Sun size={14} />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className={cn(
        "flex h-7 w-7 items-center justify-center text-[var(--ink-faint)] transition-colors hover:bg-[var(--bg-elev)] hover:text-[var(--ink)]",
        className
      )}
      aria-label={`${theme === "night" ? "Gündüz" : "Gece"} moduna geç`}
      title={`${theme === "night" ? "Gündüz" : "Gece"} moduna geç`}
    >
      {theme === "night" ? <Sun size={14} /> : <Moon size={14} />}
    </button>
  );
}
