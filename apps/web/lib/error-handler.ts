import { NextResponse } from "next/server";

/**
 * Structured API error response with logging.
 * In production, this could be extended to send to Sentry, Datadog, etc.
 */

type ErrorCategory = "validation" | "auth" | "not-found" | "rate-limit" | "internal" | "external";

interface ErrorConfig {
  status: number;
  message: string;
  category: ErrorCategory;
  logLevel: "error" | "warn" | "info";
}

const ERROR_CONFIGS: Record<string, ErrorConfig> = {
  VALIDATION: { status: 400, message: "Invalid request", category: "validation", logLevel: "warn" },
  AUTH: { status: 401, message: "Authentication required", category: "auth", logLevel: "warn" },
  FORBIDDEN: { status: 403, message: "Forbidden", category: "auth", logLevel: "warn" },
  NOT_FOUND: { status: 404, message: "Not found", category: "not-found", logLevel: "info" },
  RATE_LIMIT: { status: 429, message: "Too many requests", category: "rate-limit", logLevel: "warn" },
  INTERNAL: { status: 500, message: "Internal server error", category: "internal", logLevel: "error" },
  EXTERNAL: { status: 502, message: "External service error", category: "external", logLevel: "error" },
};

function getErrorConfig(originalError: unknown, defaultConfig: ErrorConfig): ErrorConfig {
  // Check for known error types
  if (originalError instanceof SyntaxError) {
    return { ...ERROR_CONFIGS.VALIDATION, message: "Invalid JSON in request body" };
  }
  if (originalError instanceof TypeError && originalError.message.includes("fetch")) {
    return { ...ERROR_CONFIGS.EXTERNAL, message: "External API request failed" };
  }
  // Return caller's default config for unknown errors
  return defaultConfig;
}

function serializeError(error: unknown): { message: string; stack?: string } {
  if (error instanceof Error) {
    return { message: error.message, stack: process.env.NODE_ENV !== "production" ? error.stack : undefined };
  }
  return { message: String(error) };
}

interface LogEntry {
  timestamp: string;
  method?: string;
  path?: string;
  category: ErrorCategory;
  message: string;
  status: number;
  requestId?: string;
  durationMs?: number;
}

function createLogEntry(
  config: ErrorConfig,
  serialized: { message: string; stack?: string },
  request?: Request
): LogEntry {
  const url = request ? new URL(request.url) : undefined;
  return {
    timestamp: new Date().toISOString(),
    method: url ? "POST" : undefined,
    path: url?.pathname,
    category: config.category,
    message: serialized.message,
    status: config.status,
    durationMs: undefined,
  };
}

function writeLog(entry: LogEntry, config: ErrorConfig, stack?: string): void {
  const prefix = `[api] ${entry.category.toUpperCase()} ${entry.status} ${entry.path || ""}`;
  switch (config.logLevel) {
    case "error":
      console.error(`${prefix}: ${entry.message}`, stack ? `\n${stack}` : "");
      break;
    case "warn":
      console.warn(`${prefix}: ${entry.message}`);
      break;
    case "info":
      console.info(`${prefix}: ${entry.message}`);
      break;
  }
}

/**
 * Handle an API error consistently across all routes.
 *
 * @example
 * ```ts
 * try {
 *   // ...
 * } catch (e) {
 *   return handleApiError(e, req);
 * }
 * ```
 */
export function handleApiError(
  error: unknown,
  request?: Request,
  defaultConfig?: Partial<ErrorConfig>
): NextResponse {
  const baseConfig = {
    ...ERROR_CONFIGS.INTERNAL,
    ...defaultConfig,
  } as ErrorConfig;

  const config = getErrorConfig(error, baseConfig);
  const serialized = serializeError(error);
  const entry = createLogEntry(config, serialized, request);

  writeLog(entry, config, serialized.stack);

  return NextResponse.json(
    {
      error: config.message,
      ...(process.env.NODE_ENV !== "production" && config.status >= 500
        ? { detail: serialized.message }
        : {}),
    },
    { status: config.status }
  );
}
