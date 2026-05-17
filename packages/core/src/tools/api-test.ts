import { tool } from "ai";
import { z } from "zod";

const MAX_RESPONSE_BODY = 10_000;
const DEFAULT_TIMEOUT_MS = 15_000;

function truncate(s: string): string {
  if (s.length <= MAX_RESPONSE_BODY) return s;
  return s.slice(0, MAX_RESPONSE_BODY) + `\n\n[... truncated ${s.length - MAX_RESPONSE_BODY} more chars ...]`;
}

export const apiTestTool = tool({
  description:
    "Send HTTP requests to test APIs and endpoints. Supports GET, POST, PUT, PATCH, DELETE methods with custom headers and JSON body. Returns status code, headers, and response body.",
  parameters: z.object({
    method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).describe("HTTP method"),
    url: z.string().describe("Full URL to request (must include http:// or https://)"),
    headers: z.record(z.string()).optional().describe("Optional HTTP headers as key-value pairs"),
    body: z.string().optional().describe("Request body (stringified JSON or raw text)"),
    timeout: z.number().min(1000).max(60_000).optional().describe(`Timeout in ms (default ${DEFAULT_TIMEOUT_MS})`),
  }),
  execute: async ({ method, url, headers, body, timeout }) => {
    // Validate URL
    let parsed: URL;
    try {
      parsed = new URL(url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return `[error] Unsupported protocol: "${parsed.protocol}". Only http and https are allowed.`;
      }
    } catch {
      return `[error] Invalid URL: "${url}".`;
    }

    const timeoutMs = Math.min(timeout ?? DEFAULT_TIMEOUT_MS, 60_000);

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const res = await fetch(url, {
        method,
        headers: {
          "User-Agent": "AgentWeb-API-Test/1.0",
          ...(body ? { "Content-Type": "application/json" } : {}),
          ...headers,
        },
        body: body ?? undefined,
        signal: controller.signal,
        redirect: "follow",
      });

      clearTimeout(timer);

      const responseHeaders: Record<string, string> = {};
      res.headers.forEach((v, k) => { responseHeaders[k] = v; });

      let responseBody = "";
      try {
        responseBody = await res.text();
      } catch {
        responseBody = "[unable to read response body]";
      }

      const parts: string[] = [];
      parts.push(`HTTP ${res.status} ${res.statusText}`);
      parts.push("");

      // Key headers
      const showHeaders = ["content-type", "content-length", "location", "set-cookie"];
      for (const h of showHeaders) {
        if (responseHeaders[h]) {
          parts.push(`${h}: ${responseHeaders[h].slice(0, 200)}`);
        }
      }

      parts.push("");
      parts.push(truncate(responseBody));

      return parts.join("\n");
    } catch (e: unknown) {
      const err = e as { name?: string; message?: string };
      if (err.name === "AbortError") {
        return `[error] Request timed out after ${timeoutMs}ms`;
      }
      return `[error] Request failed: ${err.message ?? "unknown error"}`;
    }
  },
});
