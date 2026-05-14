// Small "📖 <title>" pill that opens the full concept modal on click and
// shows a shortDef preview on hover.
//
// Used by Plan, Roadmap, Stats motif radar — anywhere we reference a
// concept inline.

import { useEffect, useRef, useState } from 'react'
import { findConcept } from '../concepts/lookup'
import { CATEGORY_COLORS, CATEGORY_LABELS } from '../concepts/types'
import { openConcept } from './ConceptModal'

interface Props {
  /** Concept id or alias. */
  id: string
  /** Custom label override. Default = "📖 <concept title>". */
  label?: string
  /** Hide the title — show only "📖". Used in dense lists. */
  iconOnly?: boolean
}

const HOVER_DELAY_MS = 300

export default function ConceptChip({ id, label, iconOnly = false }: Props) {
  const concept = findConcept(id)
  const [hovered, setHovered] = useState(false)
  const timerRef = useRef<number | null>(null)

  useEffect(() => () => { if (timerRef.current) window.clearTimeout(timerRef.current) }, [])

  // Concept missing → don't render anything (better than a dead chip).
  if (!concept) return null

  function show() {
    if (timerRef.current) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => setHovered(true), HOVER_DELAY_MS)
  }
  function hide() {
    if (timerRef.current) window.clearTimeout(timerRef.current)
    setHovered(false)
  }

  return (
    <span className="relative inline-block">
      <button
        onClick={e => { e.stopPropagation(); openConcept(concept.id) }}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 align-baseline"
      >
        {label ?? (iconOnly ? '📖' : `📖 ${concept.title}`)}
      </button>
      {hovered && (
        <span
          role="tooltip"
          className="absolute z-30 left-0 mt-1 w-[260px] bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md shadow-2xl p-2.5 text-[12px] leading-snug normal-case tracking-normal cursor-default"
        >
          <span className="flex items-baseline gap-1.5 mb-1">
            <span
              className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium"
              style={{ backgroundColor: CATEGORY_COLORS[concept.category] + '33', color: CATEGORY_COLORS[concept.category] }}
            >
              {CATEGORY_LABELS[concept.category]}
            </span>
            <span className="font-semibold text-neutral-100">{concept.title}</span>
          </span>
          <span className="block text-neutral-300">{concept.shortDef}</span>
          <span className="block mt-1.5 text-[10px] text-neutral-500">Cliquer pour la fiche complète</span>
        </span>
      )}
    </span>
  )
}
