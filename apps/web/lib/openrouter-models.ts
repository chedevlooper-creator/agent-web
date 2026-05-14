/** OpenRouter models with $0 prompt + completion pricing (chat-capable). */
export const OPENROUTER_FREE_MODELS = [
  "openrouter/free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "google/gemma-4-31b-it:free",
  "google/gemma-4-26b-a4b-it:free",
  "qwen/qwen3-next-80b-a3b-instruct:free",
  "qwen/qwen3-coder:free",
  "openai/gpt-oss-120b:free",
  "openai/gpt-oss-20b:free",
  "nousresearch/hermes-3-llama-3.1-405b:free",
  "minimax/minimax-m2.5:free",
  "z-ai/glm-4.5-air:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "nvidia/nemotron-3-nano-30b-a3b:free",
  "nvidia/nemotron-nano-9b-v2:free",
  "arcee-ai/trinity-large-thinking:free",
  "cognitivecomputations/dolphin-mistral-24b-venice-edition:free",
  "meta-llama/llama-3.2-3b-instruct:free",
  "liquid/lfm-2.5-1.2b-instruct:free",
  "liquid/lfm-2.5-1.2b-thinking:free",
  "inclusionai/ring-2.6-1t:free",
  "openrouter/owl-alpha",
] as const;

export const OPENROUTER_PREMIUM_MODELS = [
  "anthropic/claude-sonnet-4",
  "openai/gpt-4o",
  "openai/gpt-4o-mini",
  "google/gemini-2.5-pro",
  "deepseek/deepseek-chat",
] as const;

export const OPENROUTER_ALL_MODELS = [
  ...OPENROUTER_FREE_MODELS,
  ...OPENROUTER_PREMIUM_MODELS,
] as const;
