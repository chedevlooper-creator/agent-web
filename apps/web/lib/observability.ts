import "server-only";
import { LangfuseSpanProcessor } from "@langfuse/otel";
import { NodeSDK } from "@opentelemetry/sdk-node";

let sdk: NodeSDK | null = null;

/**
 * Initialize Langfuse OpenTelemetry tracing.
 * Safe to call multiple times — only starts once.
 * Returns the SDK instance or null if Langfuse is not configured.
 */
export function initObservability(): NodeSDK | null {
  if (sdk) return sdk;

  const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
  const secretKey = process.env.LANGFUSE_SECRET_KEY;

  if (!publicKey || !secretKey) {
    if (process.env.NODE_ENV !== "production") {
      console.log("[observability] Langfuse not configured — skipping instrumentation");
    }
    return null;
  }

  const host = process.env.LANGFUSE_HOST || "https://cloud.langfuse.com";

  const spanProcessor = new LangfuseSpanProcessor({
    publicKey,
    secretKey,
    baseUrl: host,
    exportMode: "batch",
  });

  sdk = new NodeSDK({
    spanProcessors: [spanProcessor],
  });

  sdk.start();

  console.log("[observability] Langfuse tracing initialized");

  return sdk;
}

/**
 * Gracefully shut down the OpenTelemetry SDK.
 */
export async function shutdownObservability(): Promise<void> {
  if (sdk) {
    await sdk.shutdown();
    sdk = null;
  }
}
