// Thin wrapper around the public Lichess opening explorer + tablebase APIs.
//
// Docs: https://lichess.org/api#tag/Opening-Explorer
//        https://lichess.org/api#tag/Tablebase
//
// Both endpoints are CORS-friendly. The community/masters explorers may
// require a Lichess auth token when called from heavily-trafficked IPs;
// we treat any non-2xx response as a soft failure so the rest of the UI
// keeps working when Lichess is unreachable or rate-limited.

const EXPLORER_BASE = 'https://explorer.lichess.ovh'
const TABLEBASE_BASE = 'https://tablebase.lichess.ovh'

// The explorer endpoints recently started requiring auth. We read the
// user's Personal Access Token from localStorage (set via Settings) and
// attach it as a Bearer header when present. Without a token the call
// will likely 401 and the UI shows a "configure a Lichess token" hint.
function authHeaders(): HeadersInit {
  let token = ''
  try { token = localStorage.getItem('chess.lichess.token') ?? '' } catch { /* noop */ }
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export interface ExplorerMove {
  uci: string
  san: string
  white: number
  draws: number
  black: number
  averageRating?: number
}

export interface ExplorerResponse {
  white: number
  draws: number
  black: number
  moves: ExplorerMove[]
  opening?: { eco: string; name: string } | null
}

export type ExplorerSource = 'masters' | 'lichess' | 'player'

interface ExplorerOpts {
  source: ExplorerSource
  fen: string
  // Lichess DB options:
  speeds?: Array<'ultraBullet' | 'bullet' | 'blitz' | 'rapid' | 'classical' | 'correspondence'>
  ratings?: Array<1000 | 1200 | 1400 | 1600 | 1800 | 2000 | 2200 | 2500>
  moves?: number
  // Player DB options:
  player?: string
  color?: 'white' | 'black'
}

function buildExplorerUrl(opts: ExplorerOpts): string {
  const params = new URLSearchParams()
  params.set('fen', opts.fen)
  if (opts.moves != null) params.set('moves', String(opts.moves))
  if (opts.source === 'lichess' || opts.source === 'player') {
    if (opts.speeds?.length) params.set('speeds', opts.speeds.join(','))
  }
  if (opts.source === 'lichess') {
    if (opts.ratings?.length) params.set('ratings', opts.ratings.join(','))
  }
  if (opts.source === 'player') {
    if (opts.player) params.set('player', opts.player)
    if (opts.color) params.set('color', opts.color)
  }
  return `${EXPLORER_BASE}/${opts.source}?${params.toString()}`
}

/** Returns the explorer payload, or `null` on transport/auth failure.
 *
 *  Player queries on the explorer are streamed as NDJSON because Lichess
 *  computes them on-demand; we still return only the final (most complete)
 *  payload.
 */
export async function fetchExplorer(opts: ExplorerOpts, signal?: AbortSignal): Promise<ExplorerResponse | null> {
  try {
    const r = await fetch(buildExplorerUrl(opts), { signal, headers: authHeaders() })
    if (!r.ok) return null
    if (opts.source !== 'player') {
      return await r.json() as ExplorerResponse
    }
    // NDJSON: last line is the most up-to-date snapshot.
    const text = await r.text()
    const lines = text.split('\n').map(s => s.trim()).filter(Boolean)
    if (lines.length === 0) return null
    return JSON.parse(lines[lines.length - 1]) as ExplorerResponse
  } catch {
    return null
  }
}

// ---------- Tablebase -------------------------------------------------------

export type TableCategory = 'win' | 'unknown' | 'maybe-win' | 'cursed-win'
  | 'draw' | 'blessed-loss' | 'maybe-loss' | 'loss'

export interface TableMove {
  uci: string
  san: string
  dtz: number | null
  dtm: number | null
  category: TableCategory
  zeroing: boolean
  checkmate: boolean
  stalemate: boolean
}

export interface TableResponse {
  category: TableCategory
  dtz: number | null
  dtm: number | null
  checkmate: boolean
  stalemate: boolean
  insufficient_material: boolean
  moves: TableMove[]
}

/** Lichess tablebase lookup — works for positions with ≤7 pieces.
 *  Returns null if the position is out of scope or the network call fails.
 */
export async function fetchTablebase(fen: string, signal?: AbortSignal): Promise<TableResponse | null> {
  // Count pieces to skip pointless requests.
  const placement = fen.split(' ')[0] ?? ''
  const pieces = (placement.match(/[a-zA-Z]/g) ?? []).length
  if (pieces === 0 || pieces > 7) return null
  try {
    const r = await fetch(
      `${TABLEBASE_BASE}/standard?fen=${encodeURIComponent(fen)}`,
      { signal },
    )
    if (!r.ok) return null
    return await r.json() as TableResponse
  } catch {
    return null
  }
}

/** Pretty French label for a tablebase category, from the side-to-move's POV. */
export function tableCategoryLabel(cat: TableCategory): { label: string; tone: 'win' | 'loss' | 'draw' } {
  switch (cat) {
    case 'win':           return { label: 'Gagnant',            tone: 'win'  }
    case 'maybe-win':     return { label: 'Probablement gagnant', tone: 'win' }
    case 'cursed-win':    return { label: 'Gain technique (50 coups)', tone: 'win' }
    case 'draw':          return { label: 'Nulle théorique',     tone: 'draw' }
    case 'blessed-loss':  return { label: 'Sauvable (50 coups)', tone: 'draw' }
    case 'maybe-loss':    return { label: 'Probablement perdu',  tone: 'loss' }
    case 'loss':          return { label: 'Perdu',               tone: 'loss' }
    default:              return { label: 'Inconnu',              tone: 'draw' }
  }
}

export type MoveTone = 'optimal' | 'good' | 'imprecise' | 'bad'

/** Classify a played move against the tablebase: did it preserve the
 *  position's theoretical value? Useful to give an instant verdict in
 *  the endgame trainer.
 */
export function classifyTableMove(
  current: TableCategory,
  resulting: TableCategory,
): MoveTone {
  // The position's category from side-to-move POV inverts after the move:
  // a "win" position turns into a "loss" position for the opponent.
  // Optimal: opponent's resulting category is the inverse of current.
  const winLike: TableCategory[] = ['win', 'maybe-win', 'cursed-win']
  const lossLike: TableCategory[] = ['loss', 'maybe-loss', 'blessed-loss']
  const drawLike: TableCategory[] = ['draw']
  const cur = winLike.includes(current) ? 'W'
    : lossLike.includes(current) ? 'L'
    : drawLike.includes(current) ? 'D' : '?'
  const res = winLike.includes(resulting) ? 'W'
    : lossLike.includes(resulting) ? 'L'
    : drawLike.includes(resulting) ? 'D' : '?'
  // After our move, the opponent is to move with the resulting category.
  // Winning move: opponent's position is a loss (L).
  // Drawing move: opponent's position is a draw (D).
  // Losing move: opponent's position is a win (W).
  if (cur === 'W' && res === 'L') return 'optimal'  // kept the win
  if (cur === 'W' && res === 'D') return 'bad'      // threw the win
  if (cur === 'W' && res === 'W') return 'bad'      // lost the win
  if (cur === 'D' && res === 'D') return 'optimal'  // kept the draw
  if (cur === 'D' && res === 'L') return 'optimal'  // improved to win
  if (cur === 'D' && res === 'W') return 'bad'      // threw the draw
  if (cur === 'L' && res === 'W') return 'optimal'  // already lost
  if (cur === 'L' && res === 'D') return 'good'     // saved
  if (cur === 'L' && res === 'L') return 'imprecise'
  return 'imprecise'
}
