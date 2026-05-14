export const PROVIDERS = {
  OPENAI: 'openai',
  OPENROUTER: 'openrouter',
  OPENCODE: 'opencode',
  ANTHROPIC: 'anthropic',
  DEEPSEEK: 'deepseek',
  GEMINI: 'gemini',
} as const;

export type Provider = typeof PROVIDERS[keyof typeof PROVIDERS];

export const TOOLSETS = {
  TERMINAL: 'terminal',
  FILE: 'file',
  WEB: 'web',
  CODE_EXECUTION: 'code_execution',
  BROWSER: 'browser',
  VISION: 'vision',
  TODO: 'todo',
  MEMORY: 'memory',
  DELEGATE: 'delegate',
} as const;

export const SESSION_STATUS = {
  ACTIVE: 'active',
  ARCHIVED: 'archived',
  RUNNING: 'running',
} as const;

export const SUBAGENT_STATUS = {
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;

export const CRON_ENABLED = {
  TRUE: true,
  FALSE: false,
} as const;

export const DEFAULTS = {
  MODEL: 'gpt-4o-mini',
  PROVIDER: PROVIDERS.OPENROUTER,
  MAX_STEPS: 8,
  TIMEOUT_MS: 30000,
} as const;
