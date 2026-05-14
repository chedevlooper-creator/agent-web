import { OPENROUTER_ALL_MODELS, OPENROUTER_FREE_MODELS } from "./openrouter-models";

export const NINEROUTER_DEFAULT_BASE = "https://rfb2lzd.9router.com/v1";

export const NINEROUTER_MODELS = [
  "ag/gemini-3-flash",
  "ag/gemini-3.1-pro-low",
  "ag/claude-sonnet-4-6",
  "cx/gpt-5.2",
  "cx/gpt-5.3-codex",
  "cu/claude-4.5-sonnet",
  "cu/gpt-5.2",
  "openai/gpt-oss-120b:free",
  "meta-llama/llama-3.3-70b-instruct:free",
] as const;

export type ProviderCatalogEntry = {
  value: string;
  label: string;
  models: readonly string[];
  contextLength: number;
  freeModels?: readonly string[];
  needsBaseUrl?: boolean;
  optionalApiKey?: boolean;
};

export const PROVIDER_CATALOG: ProviderCatalogEntry[] = [
  {
    value: "9router",
    label: "9Router",
    models: NINEROUTER_MODELS,
    contextLength: 200_000,
    needsBaseUrl: true,
    optionalApiKey: true,
  },
  { value: "openai", label: "OpenAI", models: ["gpt-4o", "gpt-4o-mini", "o3-mini", "o1"], contextLength: 128_000 },
  {
    value: "openrouter",
    label: "OpenRouter",
    models: OPENROUTER_ALL_MODELS,
    freeModels: OPENROUTER_FREE_MODELS,
    contextLength: 200_000,
  },
  { value: "anthropic", label: "Anthropic", models: ["claude-sonnet-4", "claude-opus-4", "claude-haiku-3.5"], contextLength: 200_000 },
  { value: "deepseek", label: "DeepSeek", models: ["deepseek-chat", "deepseek-coder"], contextLength: 64_000 },
  { value: "google", label: "Google Gemini", models: ["gemini-2.5-pro", "gemini-2.0-flash"], contextLength: 1_000_000 },
  { value: "opencode", label: "OpenCode", models: ["opencode-go", "opencode-zen"], contextLength: 128_000, needsBaseUrl: true },
  { value: "huggingface", label: "Hugging Face", models: ["meta-llama/Llama-3-70B", "mistralai/Mixtral-8x7B"], contextLength: 32_000 },
  { value: "github", label: "GitHub Copilot", models: ["gpt-4o", "claude-3.5-sonnet"], contextLength: 128_000 },
  { value: "ollama", label: "Ollama (Local)", models: ["llama3", "mistral", "codellama"], contextLength: 8192, needsBaseUrl: true },
];

export function getProviderDefaults(value: string) {
  const entry = PROVIDER_CATALOG.find((p) => p.value === value);
  if (!entry) return {};
  return {
    provider: entry.value,
    model: entry.models[0],
    ...(entry.value === "9router" ? { baseUrl: NINEROUTER_DEFAULT_BASE } : {}),
    ...(entry.value === "opencode" ? { baseUrl: "https://api.opencode.ai/v1" } : {}),
    ...(entry.value === "ollama" ? { baseUrl: "http://localhost:11434/v1" } : {}),
  };
}
