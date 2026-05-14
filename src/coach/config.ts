// LLM configuration (bring-your-own key). Stored in localStorage — never
// sent to our origin. Calls go straight from the user's browser to the
// provider, keeping the no-backend constraint.

import { loadJson, saveJson } from '../storage/json'
import { KEYS } from '../storage/keys'

export type LlmProvider = 'anthropic' | 'openai' | 'disabled'

export interface LlmConfig {
  provider: LlmProvider
  apiKey: string
  /** Model id. Empty = use sensible default per provider. */
  model: string
}

const KEY = KEYS.llmConfig

const DEFAULTS: LlmConfig = { provider: 'disabled', apiKey: '', model: '' }

export const DEFAULT_MODEL: Record<Exclude<LlmProvider, 'disabled'>, string> = {
  anthropic: 'claude-haiku-4-5-20251001',
  openai:    'gpt-4o-mini',
}

export function loadLlmConfig(): LlmConfig {
  return loadJson<LlmConfig>(KEY, DEFAULTS)
}

export function saveLlmConfig(cfg: LlmConfig): void {
  saveJson(KEY, cfg)
}

export function isLlmEnabled(cfg: LlmConfig = loadLlmConfig()): boolean {
  return cfg.provider !== 'disabled' && cfg.apiKey.trim().length > 0
}

export function effectiveModel(cfg: LlmConfig): string {
  if (cfg.model.trim()) return cfg.model.trim()
  if (cfg.provider === 'disabled') return ''
  return DEFAULT_MODEL[cfg.provider]
}
