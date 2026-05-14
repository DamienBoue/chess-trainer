import { CONCEPTS } from './catalog'
import type { Concept, ConceptCategory } from './types'

// Memoised maps for O(1) access. Concepts are static so this is safe.
const byId = new Map<string, Concept>(CONCEPTS.map(c => [c.id, c]))
const byAlias = new Map<string, Concept>()
for (const c of CONCEPTS) {
  byAlias.set(c.id.toLowerCase(), c)
  byAlias.set(c.title.toLowerCase(), c)
  for (const a of c.aliases ?? []) byAlias.set(a.toLowerCase(), c)
}

export function findConcept(idOrAlias: string): Concept | undefined {
  return byId.get(idOrAlias) ?? byAlias.get(idOrAlias.toLowerCase())
}

export function conceptsByCategory(cat: ConceptCategory): Concept[] {
  return CONCEPTS.filter(c => c.category === cat)
}

export function allConcepts(): Concept[] {
  return CONCEPTS
}

/** Fuzzy search: substring match on title + aliases. Returns relevance order. */
export function searchConcepts(query: string): Concept[] {
  const q = query.trim().toLowerCase()
  if (!q) return CONCEPTS
  const out: Array<{ c: Concept; score: number }> = []
  for (const c of CONCEPTS) {
    const haystack = [c.title, ...(c.aliases ?? [])].join(' ').toLowerCase()
    if (haystack.includes(q)) {
      // Exact title match ranks higher than alias match.
      const score = c.title.toLowerCase() === q ? 100
        : c.title.toLowerCase().startsWith(q) ? 50
        : c.title.toLowerCase().includes(q) ? 20
        : 10
      out.push({ c, score })
    }
  }
  return out.sort((a, b) => b.score - a.score).map(x => x.c)
}

/** Map a motif tag (from detectMotifs) to its concept. Used by the radar
 *  to surface a "📖 En savoir plus" chip per motif. */
const MOTIF_TO_CONCEPT: Record<string, string> = {
  'fork':            'fork',
  'fork-royal':      'fork-royal',
  'pin':             'pin',
  'mate-found':      'back-rank-mate',     // generic fallback
  'mate-missed':     'back-rank-mate',
  'hanging-capture': 'remove-defender',
  'sacrifice':       'sacrifice',
  // 'capture' has no specific concept — fall through to undefined.
}

export function conceptForMotif(motif: string): Concept | undefined {
  const id = MOTIF_TO_CONCEPT[motif]
  return id ? byId.get(id) : undefined
}

/** Picks a deterministic concept of the day from the catalogue. Same date
 *  + same catalogue ⇒ same concept, so reloading doesn't reshuffle. */
export function pickDailyConcept(dateStr: string): Concept {
  let h = 0x811c9dc5
  for (let i = 0; i < dateStr.length; i++) {
    h ^= dateStr.charCodeAt(i)
    h = Math.imul(h, 16777619) >>> 0
  }
  return CONCEPTS[h % CONCEPTS.length]
}
