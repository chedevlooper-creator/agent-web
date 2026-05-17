import { tool } from "ai";
import { z } from "zod";

const MAX_RETURN_CHARS = 32_000;
const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_TIMEOUT_MS = 60_000;

function decodeHtml(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

function stripTags(html: string): string {
  // Remove script and style blocks entirely
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, "")
    // Replace block elements with newlines
    .replace(/<\/(div|p|h[1-6]|li|tr|section|article|header|footer|nav|main|aside|form|table|ul|ol|dl|br|hr|pre|blockquote)[^>]*>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    // Remove remaining tags
    .replace(/<[^>]+>/g, "")
    // Decode HTML entities
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)));

  // Collapse whitespace
  return text
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 0)
    .join("\n");
}

function extractTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!match) return null;
  return decodeHtml(match[1].trim());
}

function truncateOutput(output: string): string {
  if (output.length <= MAX_RETURN_CHARS) return output;
  return output.slice(0, MAX_RETURN_CHARS) + "\n\n[... truncated ...]";
}

export const webFetchTool = tool({
  description:
    "Fetch a URL and extract its text content. Returns the page title and readable text (HTML tags stripped, entities decoded). Max return size: 32K characters. Use for reading documentation, articles, or any web page content.",
  parameters: z.object({
    url: z.string().describe("The URL to fetch (must include http:// or https://)"),
    timeout: z
      .number()
      .min(1000)
      .max(MAX_TIMEOUT_MS)
      .optional()
      .describe(`Timeout in milliseconds (default ${DEFAULT_TIMEOUT_MS}ms, max ${MAX_TIMEOUT_MS}ms)`),
  }),
  execute: async ({ url, timeout }) => {
    const timeoutMs = Math.min(timeout ?? DEFAULT_TIMEOUT_MS, MAX_TIMEOUT_MS);

    // Validate URL
    let parsed: URL;
    try {
      parsed = new URL(url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return `[error] Unsupported protocol: "${parsed.protocol}". Only http and https are allowed.`;
      }
    } catch {
      return `[error] Invalid URL: "${url}". Must be a valid http:// or https:// URL.`;
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
        signal: controller.signal,
        redirect: "follow",
      });

      clearTimeout(timer);

      if (!res.ok) {
        return `[error] HTTP ${res.status} ${res.statusText} for "${url}"`;
      }

      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
        return `[error] Unsupported content type: "${contentType}". Only text/html and text/plain are supported.`;
      }

      const html = await res.text();
      const title = extractTitle(html);
      const text = stripTags(html);

      const parts: string[] = [];
      if (title) {
        parts.push(`Title: ${title}`);
        parts.push("");
      }
      parts.push(text);

      return truncateOutput(parts.join("\n"));
    } catch (e: unknown) {
      const err = e as { name?: string; message?: string };
      if (err.name === "AbortError") {
        return `[error] Fetch timed out after ${timeoutMs}ms for "${url}"`;
      }
      return `[error] Fetch failed: ${err.message ?? "unknown error"}`;
    }
  },
});
