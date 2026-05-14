// Thin direct-from-browser clients for the supported LLM providers.
// Both Anthropic and OpenAI publish CORS headers for their inference
// endpoints, so we can hit them straight from the user's tab — no
// proxy, no backend.

import { effectiveModel, type LlmConfig } from './config'

export class LlmError extends Error {
  status?: number
  constructor(message: string, status?: number) {
    super(message)
    this.status = status
  }
}

export async function complete(cfg: LlmConfig, system: string, user: string, opts: { maxTokens?: number; signal?: AbortSignal } = {}): Promise<string> {
  const { maxTokens = 600, signal } = opts
  if (cfg.provider === 'disabled' || !cfg.apiKey.trim()) {
    throw new LlmError('Aucun fournisseur LLM configuré.')
  }
  const model = effectiveModel(cfg)
  if (cfg.provider === 'anthropic') return callAnthropic(cfg.apiKey, model, system, user, maxTokens, signal)
  if (cfg.provider === 'openai')    return callOpenAI(cfg.apiKey, model, system, user, maxTokens, signal)
  throw new LlmError(`Fournisseur inconnu : ${cfg.provider}`)
}

async function callAnthropic(apiKey: string, model: string, system: string, user: string, maxTokens: number, signal?: AbortSignal): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    signal,
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  })
  if (!res.ok) throw new LlmError(`Anthropic ${res.status}: ${await safeText(res)}`, res.status)
  const data = await res.json() as { content: Array<{ type: string; text: string }> }
  return data.content?.filter(c => c.type === 'text').map(c => c.text).join('\n').trim() || ''
}

async function callOpenAI(apiKey: string, model: string, system: string, user: string, maxTokens: number, signal?: AbortSignal): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    signal,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: system },
        { role: 'user',   content: user },
      ],
    }),
  })
  if (!res.ok) throw new LlmError(`OpenAI ${res.status}: ${await safeText(res)}`, res.status)
  const data = await res.json() as { choices: Array<{ message: { content: string } }> }
  return data.choices?.[0]?.message?.content?.trim() ?? ''
}

async function safeText(res: Response): Promise<string> {
  try { return (await res.text()).slice(0, 200) } catch { return '<no body>' }
}
