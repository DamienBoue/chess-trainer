// Global modal overlay that shows a single Concept on top of any view.
// Driven by an event-bus pattern so any component (StudyHint, motif chip,
// plan item) can open it without prop-drilling.

import { useEffect, useState } from 'react'
import { findConcept } from '../concepts/lookup'
import type { Concept } from '../concepts/types'
import ConceptCard from './ConceptCard'

const EVENT = 'concept:open'

export function openConcept(idOrAlias: string): void {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { id: idOrAlias } }))
}

export default function ConceptModal() {
  const [concept, setConcept] = useState<Concept | null>(null)

  useEffect(() => {
    function onOpen(e: Event) {
      const id = (e as CustomEvent<{ id: string }>).detail.id
      const c = findConcept(id)
      if (c) setConcept(c)
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setConcept(null)
    }
    window.addEventListener(EVENT, onOpen)
    window.addEventListener('keydown', onEsc)
    return () => {
      window.removeEventListener(EVENT, onOpen)
      window.removeEventListener('keydown', onEsc)
    }
  }, [])

  if (!concept) return null

  return (
    <div
      className="fixed inset-0 z-30 bg-black/70 flex items-start justify-center pt-12 px-4 overflow-y-auto"
      onClick={() => setConcept(null)}
    >
      <div
        className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-lg shadow-2xl w-full max-w-2xl p-5 my-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-end mb-2">
          <button
            onClick={() => setConcept(null)}
            className="text-neutral-400 hover:text-white text-xl leading-none px-2"
            aria-label="Fermer"
          >×</button>
        </div>
        <ConceptCard
          concept={concept}
          onOpenRelated={id => {
            const next = findConcept(id)
            if (next) setConcept(next)
          }}
        />
      </div>
    </div>
  )
}
