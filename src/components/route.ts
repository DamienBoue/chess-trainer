// Hash routes (#/…): browser back/forward work, a screen can be linked to
// (down to the move and the analysis tab), and a reload keeps it. Slugs
// are French and readable. `#share=…` (shared exercises) is owned by
// SharedExerciseView and never parsed here.

import type { StrategyTab } from './StrategyView'

export type AnalysisTabId = 'review' | 'move' | 'strategy' | 'opening'

export interface Route {
  view: string
  /** Analysis: game identifier (see gameSlug). */
  gameSlug?: string
  ply?: number
  tab?: AnalysisTabId
  strategyTab?: StrategyTab
  bookId?: string
}

const VIEW_SLUGS: Record<string, string> = {
  home: 'aujourdhui',
  games: 'parties',
  trainHub: 'entrainement',
  theoryHub: 'theorie',
  progressHub: 'progres',
  stats: 'statistiques',
  exercises: 'exercices',
  rush: 'rush',
  daily: 'quotidien',
  roadmap: 'niveau',
  compare: 'comparer',
  repertoire: 'repertoire',
  openingLab: 'labo-ouvertures',
  reverseDrill: 'miroir',
  library: 'bibliotheque',
  scouting: 'preparer',
  players: 'joueurs',
  play: 'jouer',
  blunder: 'reflexe',
  calc: 'calcul',
  concepts: 'concepts',
  settings: 'preferences',
}

const STRATEGY_SLUGS: Record<StrategyTab, string> = { profile: 'profil', trainer: 'entrainement', atlas: 'structures' }
const TAB_SLUGS: Record<AnalysisTabId, string> = { review: 'bilan', move: 'coup', strategy: 'strategie', opening: 'ouverture' }

const lookup = <K extends string>(table: Record<K, string>, slug: string | null | undefined): K | undefined =>
  (Object.keys(table) as K[]).find(k => table[k] === slug)

/** Short, stable id of a game: "live-123456789" for chess.com, an encoded URL otherwise. */
export function gameSlug(url: string): string {
  const m = url.match(/chess\.com\/game\/(live|daily)\/(\d+)/)
  return m ? `${m[1]}-${m[2]}` : `u-${encodeURIComponent(url)}`
}

export function findGameBySlug<T extends { url: string }>(games: T[], slug: string): T | undefined {
  return games.find(g => gameSlug(g.url) === slug)
}

export function formatRoute(r: Route): string {
  if (r.view === 'analysis' && r.gameSlug) {
    const q = new URLSearchParams()
    if (r.ply) q.set('coup', String(r.ply))
    if (r.tab && r.tab !== 'review') q.set('onglet', TAB_SLUGS[r.tab])
    const qs = q.toString()
    return `#/partie/${r.gameSlug}${qs ? `?${qs}` : ''}`
  }
  if (r.view === 'strategy') return `#/strategie/${STRATEGY_SLUGS[r.strategyTab ?? 'profile']}`
  if (r.view === 'book' && r.bookId) return `#/livre/${encodeURIComponent(r.bookId)}`
  return `#/${VIEW_SLUGS[r.view] ?? VIEW_SLUGS.home}`
}

/** null when the hash is not an app route (empty, `#share=…`, unknown shape). */
export function parseHash(hash: string): Route | null {
  if (!hash.startsWith('#/')) return null
  const [path, query = ''] = hash.slice(2).split('?')
  const [head, ...rest] = path.split('/').filter(Boolean)
  const q = new URLSearchParams(query)
  if (!head) return { view: 'home' }
  if (head === 'partie') {
    if (!rest[0]) return { view: 'games' }
    const ply = Number(q.get('coup'))
    return {
      view: 'analysis',
      gameSlug: rest[0],
      ply: Number.isInteger(ply) && ply > 0 ? ply : undefined,
      tab: lookup(TAB_SLUGS, q.get('onglet')),
    }
  }
  if (head === 'strategie') return { view: 'strategy', strategyTab: lookup(STRATEGY_SLUGS, rest[0]) ?? 'profile' }
  if (head === 'livre') {
    try {
      return rest[0] ? { view: 'book', bookId: decodeURIComponent(rest[0]) } : { view: 'library' }
    } catch {
      return { view: 'library' } // malformed percent-encoding
    }
  }
  return { view: lookup(VIEW_SLUGS, head) ?? 'home' }
}

/** Same screen, ignoring the query (move / tab inside an analysis). */
export function sameScreen(a: string, b: string): boolean {
  return a.split('?')[0] === b.split('?')[0]
}

/** Writes the hash into the history. Safari refuses more than 100 history
 *  updates per 30 s (holding an arrow key in an analysis): a refused update
 *  only leaves the URL behind, it must not take the app down. */
export function writeHash(hash: string, mode: 'push' | 'replace'): void {
  try {
    if (mode === 'push') window.history.pushState(null, '', hash)
    else window.history.replaceState(null, '', hash)
  } catch { /* throttled: the next update will catch up */ }
}
