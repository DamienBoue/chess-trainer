// Generic "ask the coach a one-shot question" UI. Renders a button
// that triggers a fetch, then swaps to a loading line, then to the
// model's prose answer with a Regenerate link. The parent owns the
// fetch function — this component knows nothing about chess.

import { useEffect, useRef, useState } from 'react'
import { llmAvailable } from '../coach/coach'

interface Props {
  /** Call the LLM. Should resolve to the model's text response. */
  run: (signal: AbortSignal) => Promise<string>
  /** Button label when no answer is loaded yet. */
  ctaLabel: string
  /** Optional fallback when LLM is not configured. */
  fallback?: React.ReactNode
  /** Visual variant — Plan view uses a tinted box, Analysis a flat one. */
  tinted?: boolean
  /** Stable key so the answer resets when the underlying input changes. */
  resetKey?: string | number
  /** When provided, the helper line shown below the CTA. */
  hint?: string
}

export default function LlmAskBox({
  run, ctaLabel, fallback, tinted = false, resetKey, hint,
}: Props) {
  const available = llmAvailable()
  const [text, setText] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const ctrlRef = useRef<AbortController | null>(null)

  useEffect(() => {
    // Reset whenever the parent's key changes.
    ctrlRef.current?.abort()
    setText(null); setErr(null); setLoading(false)
  }, [resetKey])

  if (!available) return fallback ? <>{fallback}</> : null

  async function go() {
    ctrlRef.current?.abort()
    const ctrl = new AbortController()
    ctrlRef.current = ctrl
    setLoading(true); setErr(null); setText(null)
    try {
      const out = await run(ctrl.signal)
      if (ctrl.signal.aborted) return
      setText(out || '(Réponse vide.)')
    } catch (e) {
      if (ctrl.signal.aborted) return
      setErr(e instanceof Error ? e.message : 'Erreur LLM')
    } finally {
      if (!ctrl.signal.aborted) setLoading(false)
    }
  }

  const wrapperCls = tinted
    ? 'p-3 rounded-md bg-purple-500/5 border border-purple-500/30'
    : ''

  return (
    <div className={wrapperCls}>
      {!text && !loading && !err && (
        <>
          <button
            onClick={go}
            className="text-xs px-2.5 py-1 rounded bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 border border-purple-500/30"
          >{ctaLabel}</button>
          {hint && <p className="text-[11px] text-neutral-500 mt-1">{hint}</p>}
        </>
      )}
      {loading && <p className="text-xs text-neutral-400">L'IA réfléchit…</p>}
      {err && <p className="text-xs text-red-400">⚠ {err}</p>}
      {text && (
        <>
          <div className="text-sm text-neutral-200 leading-relaxed whitespace-pre-wrap">{text}</div>
          <button
            onClick={go}
            className="block mt-2 text-[11px] text-neutral-500 hover:text-white underline"
          >Régénérer</button>
        </>
      )}
    </div>
  )
}
