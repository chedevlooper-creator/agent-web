import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Rough token estimation: 1 token ≈ 4 characters */
export function estimateTokens(messages: { content: string }[]): number {
  return messages.reduce((sum, m) => sum + Math.ceil(m.content.length / 4), 0);
}

/** Safely extract an error message from an unknown caught value */
export function getErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  if (e && typeof e === "object") {
    const withMsg = e as { message?: string };
    if (typeof withMsg.message === "string") return withMsg.message;
  }
  return String(e);
}
