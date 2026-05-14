// Browse all concepts: category filter + free-text search + card grid.
// Clicking a card opens the ConceptModal.

import { useMemo, useState } from 'react'
import { allConcepts, searchConcepts } from '../concepts/lookup'
import type { ConceptCategory } from '../concepts/types'
import { CATEGORY_COLORS, CATEGORY_LABELS } from '../concepts/types'
import { openConcept } from './ConceptModal'

const CATEGORIES: Array<ConceptCategory | 'all'> = ['all', 'tactics', 'endgame', 'structure', 'opening', 'strategy', 'mindset']

export default function ConceptsView() {
  const [cat, setCat] = useState<ConceptCategory | 'all'>('all')
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    let list = searchConcepts(query)
    if (cat !== 'all') list = list.filter(c => c.category === cat)
    return list
  }, [cat, query])

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto space-y-4">
      <div>
        <h2 className="text-2xl font-semibold">Bibliothèque de concepts</h2>
        <p className="text-sm text-neutral-400">
          Définitions courtes, ressources externes, positions à explorer. {allConcepts().length} fiches.
        </p>
      </div>

      <div className="flex gap-2 flex-wrap items-center">
        <input
          type="search"
          placeholder="Chercher (fork, IQP, Vancura…)"
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="flex-1 min-w-[200px] px-3 py-1.5 text-sm rounded bg-neutral-900 border border-[var(--color-border)] focus:border-[var(--color-accent)] focus:outline-none"
        />
        {(query || cat !== 'all') && (
          <button
            onClick={() => { setQuery(''); setCat('all') }}
            className="text-xs text-neutral-400 hover:text-white underline"
          >Réinitialiser</button>
        )}
      </div>

      <div className="flex gap-1 flex-wrap">
        {CATEGORIES.map(c => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={`text-xs px-2.5 py-1 rounded-full transition-colors ${
              c === cat
                ? 'bg-[var(--color-accent)] text-white'
                : 'bg-neutral-900 text-neutral-300 hover:bg-neutral-800 border border-[var(--color-border)]'
            }`}
          >
            {c === 'all' ? 'Toutes' : CATEGORY_LABELS[c as ConceptCategory]}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-neutral-500">Aucun résultat.</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(c => (
            <button
              key={c.id}
              onClick={() => openConcept(c.id)}
              className="text-left bg-[var(--color-panel)] border border-[var(--color-border)] hover:border-neutral-600 rounded-md p-3 transition-colors"
            >
              <div className="flex items-baseline gap-2 mb-1">
                <span
                  className="text-[10px] uppercase tracking-wider"
                  style={{ color: CATEGORY_COLORS[c.category] }}
                >
                  {CATEGORY_LABELS[c.category]}
                </span>
                {c.positions && c.positions.length > 0 && (
                  <span className="text-[10px] text-neutral-500">♟ {c.positions.length}</span>
                )}
                {c.links && c.links.length > 0 && (
                  <span className="text-[10px] text-neutral-500">↗ {c.links.length}</span>
                )}
              </div>
              <h3 className="font-semibold">{c.title}</h3>
              <p className="text-xs text-neutral-400 mt-1 line-clamp-3">{c.shortDef}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
