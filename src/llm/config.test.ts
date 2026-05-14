import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  loadLlmConfig, saveLlmConfig, isLlmEnabled, effectiveModel, DEFAULT_MODEL,
} from './config'

function mockLocalStorage() {
  const store = new Map<string, string>()
  return {
    getItem: (k: string) => store.has(k) ? store.get(k)! : null,
    setItem: (k: string, v: string) => { store.set(k, v) },
    removeItem: (k: string) => { store.delete(k) },
    clear: () => store.clear(),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() { return store.size },
  } as Storage
}

describe('llm config', () => {
  beforeEach(() => { vi.stubGlobal('localStorage', mockLocalStorage()) })

  it('defaults to provider=disabled with empty key + model', () => {
    const cfg = loadLlmConfig()
    expect(cfg.provider).toBe('disabled')
    expect(cfg.apiKey).toBe('')
    expect(cfg.model).toBe('')
  })

  it('round-trips a saved config', () => {
    saveLlmConfig({ provider: 'anthropic', apiKey: 'sk-xxx', model: 'claude-haiku-4-5' })
    const cfg = loadLlmConfig()
    expect(cfg.provider).toBe('anthropic')
    expect(cfg.apiKey).toBe('sk-xxx')
    expect(cfg.model).toBe('claude-haiku-4-5')
  })
})

describe('isLlmEnabled', () => {
  it('false when provider=disabled', () => {
    expect(isLlmEnabled({ provider: 'disabled', apiKey: '', model: '' })).toBe(false)
  })

  it('false when no key', () => {
    expect(isLlmEnabled({ provider: 'anthropic', apiKey: '', model: '' })).toBe(false)
    expect(isLlmEnabled({ provider: 'anthropic', apiKey: '   ', model: '' })).toBe(false)
  })

  it('true when both provider and key are set', () => {
    expect(isLlmEnabled({ provider: 'anthropic', apiKey: 'sk-x', model: '' })).toBe(true)
    expect(isLlmEnabled({ provider: 'openai',    apiKey: 'sk-x', model: '' })).toBe(true)
  })
})

describe('effectiveModel', () => {
  it('returns the user model when set', () => {
    expect(effectiveModel({ provider: 'anthropic', apiKey: 'k', model: 'my-model' })).toBe('my-model')
  })

  it('falls back to the provider default when model is empty', () => {
    expect(effectiveModel({ provider: 'anthropic', apiKey: 'k', model: '' })).toBe(DEFAULT_MODEL.anthropic)
    expect(effectiveModel({ provider: 'openai',    apiKey: 'k', model: '' })).toBe(DEFAULT_MODEL.openai)
  })

  it('returns "" when disabled', () => {
    expect(effectiveModel({ provider: 'disabled', apiKey: '', model: '' })).toBe('')
  })

  it('trims whitespace-only model', () => {
    expect(effectiveModel({ provider: 'anthropic', apiKey: 'k', model: '   ' })).toBe(DEFAULT_MODEL.anthropic)
  })
})
