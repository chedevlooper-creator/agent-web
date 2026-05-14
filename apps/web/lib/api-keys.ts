const PROVIDER_ENV_KEYS: Record<string, string | undefined> = {
  openai: process.env.OPENAI_API_KEY,
  openrouter: process.env.OPENROUTER_API_KEY,
  opencode: process.env.OPENCODE_API_KEY,
  anthropic: process.env.ANTHROPIC_API_KEY,
  deepseek: process.env.DEEPSEEK_API_KEY,
  gemini: process.env.GEMINI_API_KEY,
};

export function getApiKeyForProvider(provider: string): string | undefined {
  return PROVIDER_ENV_KEYS[provider];
}

export function hasApiKeyForProvider(provider: string): boolean {
  const key = getApiKeyForProvider(provider);
  return typeof key === 'string' && key.length > 0;
}
