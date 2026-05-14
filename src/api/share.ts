import type { Color } from '../types'
import type { Exercise, ExerciseCategory } from '../analysis/exercises'

// Encode an exercise into a hash fragment payload that can be re-hydrated by
// any other instance of the app. Format: #share?fen=...&best=...&line=...&...
export function exerciseToShareUrl(e: Exercise): string {
  const params = new URLSearchParams({
    fen: e.fen,
    best: e.bestMoveSan,
    color: e.userColor,
    cat: e.category,
  })
  if (e.bestLineSan) params.set('line', e.bestLineSan)
  if (e.context.opponent) params.set('opp', e.context.opponent)
  if (e.context.opening) params.set('open', e.context.opening)
  const base = window.location.origin + window.location.pathname
  return `${base}#share?${params.toString()}`
}

export function readSharedFromHash(): Exercise | null {
  const h = window.location.hash
  if (!h.startsWith('#share?')) return null
  const params = new URLSearchParams(h.slice('#share?'.length))
  const fen = params.get('fen')
  const best = params.get('best')
  if (!fen || !best) return null
  const stm = (fen.split(' ')[1] === 'b' ? 'b' : 'w') as 'w' | 'b'
  const color = (params.get('color') as Color) ?? (stm === 'w' ? 'white' : 'black')
  const cat = (params.get('cat') as ExerciseCategory) ?? 'missed'
  return {
    id: `shared#${hashOf(h)}`,
    category: cat,
    fen,
    userColor: color,
    sideToMove: stm,
    bestMoveSan: best,
    bestLineSan: params.get('line') ?? undefined,
    playedMoveSan: '?',
    playedClassification: 'mistake',
    cpSwing: 0,
    evalBeforeWhite: 0,
    evalAfterPlayedWhite: 0,
    motifs: [],
    difficulty: 'medium',
    context: {
      gameUrl: window.location.href,
      opponent: params.get('opp') ?? '?',
      ply: 0,
      moveLabel: '?',
      endTime: Date.now(),
      opening: params.get('open') ?? undefined,
    },
  }
}

export function clearShareHash(): void {
  if (window.location.hash.startsWith('#share')) {
    history.replaceState(null, '', window.location.pathname + window.location.search)
  }
}

function hashOf(s: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i); h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0
  }
  return h.toString(36)
}
