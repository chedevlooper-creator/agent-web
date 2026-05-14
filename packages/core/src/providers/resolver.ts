import { createOpenAI } from "@ai-sdk/openai";

export type ApiMode = "chat_completions" | "anthropic_messages" | "codex_responses";

/** OpenAI-compatible base URL; accepts host or full .../v1 without duplicating path */
export function normalizeOpenAiBaseUrl(url: string): string {
  const trimmed = url.replace(/\/$/, "");
  return trimmed.endsWith("/v1") ? trimmed : `${trimmed}/v1`;
}

const DEFAULT_NINEROUTER_BASE = normalizeOpenAiBaseUrl(
  process.env.NINEROUTER_URL ?? "https://rfb2lzd.9router.com"
);

export interface ResolvedProvider {
  apiMode: ApiMode;
  apiKey: string;
  baseUrl?: string;
  model: string;
  label: string;
  contextLength: number;
}

const PROVIDER_CONFIGS: Record<string, { apiMode: ApiMode; defaultBase?: string; label: string; contextLength: number }> = {
  openai: {
    apiMode: "chat_completions",
    label: "OpenAI",
    contextLength: 128_000,
  },
  openrouter: {
    apiMode: "chat_completions",
    defaultBase: "https://openrouter.ai/api/v1",
    label: "OpenRouter",
    contextLength: 200_000,
  },
  opencode: {
    apiMode: "chat_completions",
    defaultBase: "https://api.opencode.ai/v1",
    label: "OpenCode",
    contextLength: 128_000,
  },
  anthropic: {
    apiMode: "anthropic_messages",
    label: "Anthropic",
    contextLength: 200_000,
  },
  deepseek: {
    apiMode: "chat_completions",
    defaultBase: "https://api.deepseek.com",
    label: "DeepSeek",
    contextLength: 64_000,
  },
  gemini: {
    apiMode: "chat_completions",
    defaultBase: "https://generativelanguage.googleapis.com/v1beta/openai",
    label: "Gemini/Google",
    contextLength: 1_048_576,
  },
  huggingface: {
    apiMode: "chat_completions",
    defaultBase: "https://api-inference.huggingface.co/models",
    label: "Hugging Face",
    contextLength: 8_000,
  },
  bedrock: {
    apiMode: "anthropic_messages",
    label: "AWS Bedrock",
    contextLength: 200_000,
  },
  opencode_zen: {
    apiMode: "chat_completions",
    defaultBase: "https://zen.opencode.ai/v1",
    label: "OpenCode Zen",
    contextLength: 128_000,
  },
  opencode_go: {
    apiMode: "chat_completions",
    defaultBase: "https://go.opencode.ai/v1",
    label: "OpenCode Go",
    contextLength: 128_000,
  },
  github_copilot: {
    apiMode: "chat_completions",
    defaultBase: "https://api.githubcopilot.com",
    label: "GitHub Copilot",
    contextLength: 128_000,
  },
  nvidia: {
    apiMode: "chat_completions",
    defaultBase: "https://integrate.api.nvidia.com/v1",
    label: "NVIDIA NIM",
    contextLength: 32_000,
  },
  dashscope: {
    apiMode: "chat_completions",
    defaultBase: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    label: "Alibaba Cloud/DashScope",
    contextLength: 32_000,
  },
  minimax: {
    apiMode: "chat_completions",
    defaultBase: "https://api.minimax.chat/v1",
    label: "MiniMax",
    contextLength: 245_000,
  },
  moonshot: {
    apiMode: "chat_completions",
    defaultBase: "https://api.moonshot.cn/v1",
    label: "Kimi/Moonshot",
    contextLength: 128_000,
  },
  ai_gateway: {
    apiMode: "chat_completions",
    defaultBase: "https://api.vercel.com/v1/gateway",
    label: "Vercel AI Gateway",
    contextLength: 128_000,
  },
  ollama: {
    apiMode: "chat_completions",
    defaultBase: "http://localhost:11434/v1",
    label: "Local/Ollama",
    contextLength: 128_000,
  },
  "9router": {
    apiMode: "chat_completions",
    defaultBase: DEFAULT_NINEROUTER_BASE,
    label: "9Router",
    contextLength: 200_000,
  },
  custom: {
    apiMode: "chat_completions",
    label: "Custom Endpoint",
    contextLength: 128_000,
  },
};

export function listProviders() {
  return Object.entries(PROVIDER_CONFIGS).map(([key, config]) => ({
    key,
    label: config.label,
    apiMode: config.apiMode,
    contextLength: config.contextLength,
  }));
}

export function getProviderConfig(provider: string) {
  return PROVIDER_CONFIGS[provider];
}

export async function resolveProvider(provider: string, model: string, opts: { apiKey: string; baseUrl?: string }): Promise<ResolvedProvider> {
  const config = PROVIDER_CONFIGS[provider] ?? PROVIDER_CONFIGS.custom;
  const baseUrl = opts.baseUrl
    ? normalizeOpenAiBaseUrl(opts.baseUrl)
    : config.defaultBase;

  return {
    apiMode: config.apiMode,
    apiKey: opts.apiKey,
    baseUrl,
    model,
    label: config.label,
    contextLength: config.contextLength,
  };
}

/**
 * Create an OpenAI-compatible model client from resolved provider config
 */
export function createModelClient(resolved: ResolvedProvider) {
  const client = createOpenAI({
    apiKey: resolved.apiKey,
    ...(resolved.baseUrl ? { baseURL: resolved.baseUrl } : {}),
  });
  return client(resolved.model);
}
