// Inline card rendering a single Concept. Used by ConceptModal +
// ConceptsView. Stateless and easy to embed anywhere.

import { useState } from 'react'
import type { Concept } from '../concepts/types'
import { CATEGORY_COLORS, CATEGORY_LABELS } from '../concepts/types'
import { findConcept } from '../concepts/lookup'
import PositionExplorer from './PositionExplorer'

interface Props {
  concept: Concept
  /** Click a related-concept chip → navigate to that concept. */
  onOpenRelated?: (id: string) => void
}

export default function ConceptCard({ concept, onOpenRelated }: Props) {
  const [activePosFen, setActivePosFen] = useState<string | null>(null)

  return (
    <div className="space-y-3">
      <div>
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span
            className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded"
            style={{ backgroundColor: CATEGORY_COLORS[concept.category] + '33', color: CATEGORY_COLORS[concept.category] }}
          >
            {CATEGORY_LABELS[concept.category]}
          </span>
        </div>
        <h2 className="text-xl font-semibold">{concept.title}</h2>
        <p className="text-sm text-neutral-300 mt-1 leading-relaxed">{concept.shortDef}</p>
      </div>

      {concept.detail && (
        <p className="text-sm text-neutral-300 leading-relaxed whitespace-pre-line">{concept.detail}</p>
      )}

      {concept.positions && concept.positions.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs uppercase tracking-wider text-neutral-500">Positions à explorer</h3>
          <ul className="space-y-1.5">
            {concept.positions.map((p, i) => (
              <li key={i} className="bg-neutral-900 border border-[var(--color-border)] rounded p-2.5 text-sm">
                {p.caption && <p className="text-neutral-300 mb-1.5">{p.caption}</p>}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <code className="text-[11px] text-neutral-500 font-mono break-all">{p.fen}</code>
                  <button
                    onClick={() => setActivePosFen(p.fen)}
                    className="text-xs px-2.5 py-1 rounded bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white whitespace-nowrap"
                  >
                    Ouvrir l'échiquier →
                  </button>
                </div>
                {p.bestSan && (
                  <p className="text-[11px] text-neutral-500 mt-1.5">
                    Coup pédagogique : <span className="font-mono text-neutral-300">{p.bestSan}</span>
                    {p.bestLineSan && <> · ligne : <span className="font-mono">{p.bestLineSan}</span></>}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {concept.links && concept.links.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs uppercase tracking-wider text-neutral-500">Pour aller plus loin</h3>
          <ul className="space-y-1">
            {concept.links.map((l, i) => (
              <li key={i} className="text-sm">
                <a
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-300 hover:underline inline-flex items-center gap-1"
                >
                  {l.label}
                  <span className="text-[10px] text-neutral-500">[{l.kind}]</span>
                  <svg width="11" height="11" viewBox="0 0 12 12" className="opacity-60">
                    <path d="M4 2h6v6M10 2L4 8M3 5v5h5" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" />
                  </svg>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {concept.related && concept.related.length > 0 && (
        <div className="space-y-1.5">
          <h3 className="text-xs uppercase tracking-wider text-neutral-500">Voir aussi</h3>
          <div className="flex gap-1.5 flex-wrap">
            {concept.related.map(rid => {
              const r = findConcept(rid)
              if (!r) return null
              return (
                <button
                  key={rid}
                  onClick={() => onOpenRelated?.(rid)}
                  className="text-xs px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-[var(--color-border)]"
                >
                  {r.title}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {activePosFen && (
        <PositionExplorer
          fen={activePosFen}
          onClose={() => setActivePosFen(null)}
          title={`${concept.title} — explorer`}
        />
      )}
    </div>
  )
}
