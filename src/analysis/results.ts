// Results over every game played, analysed or not: score, rating, how games
// end, openings, opponents' strength, tilt, time of day. Analyses only cover
// a handful of games; the history covers them all, so these are the numbers
// with a real sample behind them.
//
// Each game is first reduced to a small row (historyRows, once), then any
// window of rows is summarised (computeResults) and compared with the games
// before it (resultsInsights): "tu perds 31 % de tes parties au temps, contre
// 18 % d'habitude".

import type { ChessComGame, Color, GameResult } from '../types'
import { getParentOpening } from './openings'

/** How a game ended, from the loser's code (the user's own for a draw). */
export type Ending =
  | 'checkmate' | 'resign' | 'time' | 'abandon'
  | 'agreed' | 'repetition' | 'stalemate' | 'insufficient' | '50move' | 'timevsinsufficient'
  | 'other'

export const ENDING_LABELS: Record<Ending, string> = {
  checkmate: 'Échec et mat',
  resign: 'Abandon',
  time: 'Au temps',
  abandon: 'Partie quittée',
  agreed: 'Nulle par accord',
  repetition: 'Répétition',
  stalemate: 'Pat',
  insufficient: 'Matériel insuffisant',
  '50move': 'Règle des 50 coups',
  timevsinsufficient: 'Temps écoulé, mat impossible',
  other: 'Autre',
}

const ENDING_BY_CODE: Record<string, Ending> = {
  checkmated: 'checkmate',
  resigned: 'resign',
  timeout: 'time',
  abandoned: 'abandon',
  agreed: 'agreed',
  repetition: 'repetition',
  stalemate: 'stalemate',
  insufficient: 'insufficient',
  '50move': '50move',
  timevsinsufficient: 'timevsinsufficient',
}

export interface GameRow {
  url: string
  /** End of the game, ms. */
  end: number
  timeClass: string
  rated: boolean
  color: Color
  result: GameResult
  ending: Ending
  rating: number
  oppRating: number
  opponent: string
  /** "chess", or a variant ("chess960"…), left out of the stats. */
  rules: string
  /** Opening family (getParentOpening) and chess.com's line name. */
  opening: string
  variation: string
  /** Full moves played. */
  moves: number
}

/** Full moves in a PGN: the last move number of the movetext. */
export function moveCount(pgn: string): number {
  const body = pgn.slice(pgn.lastIndexOf('"]') + 2).slice(-300)
  let max = 0
  for (const m of body.matchAll(/(?:^|\s)(\d+)\.(?!\d)/g)) max = Math.max(max, Number(m[1]))
  return max
}

/** "Sicilian-Defense-Alapin-Variation-2...c3" → "Sicilian Defense Alapin Variation";
 *  "Reti-Opening-Nimzo-Larsen-Variation...5.Be2-d6" → "Reti Opening Nimzo Larsen Variation". */
function lineName(ecoUrl: string | undefined): string {
  const slug = ecoUrl?.split('/').pop() ?? ''
  const words: string[] = []
  for (const w of slug.split('-')) {
    // Moves start where a word holds a move number: "2...c3", "Variation...5.Be2".
    const cut = w.search(/\.\.\.|\d+\./)
    if (cut === 0) break
    if (cut > 0) { words.push(w.slice(0, cut)); break }
    if (w) words.push(w)
  }
  return words.join(' ')
}

/** The game seen from the user's side; null when the user didn't play it. */
export function toRow(game: ChessComGame, username: string): GameRow | null {
  const me = username.toLowerCase()
  const color: Color | null =
    game.white.username.toLowerCase() === me ? 'white' : game.black.username.toLowerCase() === me ? 'black' : null
  if (!color) return null
  const mine = game[color]
  const theirs = game[color === 'white' ? 'black' : 'white']
  const result: GameResult = mine.result === 'win' ? 'win' : theirs.result === 'win' ? 'loss' : 'draw'
  const code = result === 'win' ? theirs.result : mine.result
  const ecoUrl = game.eco ?? /\[ECOUrl "([^"]*)"\]/.exec(game.pgn)?.[1]
  const variation = lineName(ecoUrl)
  const eco = /\[ECO "([^"]*)"\]/.exec(game.pgn)?.[1]
  return {
    url: game.url,
    end: game.end_time * 1000,
    timeClass: game.time_class,
    rated: game.rated,
    color,
    result,
    ending: ENDING_BY_CODE[code] ?? 'other',
    rating: mine.rating,
    oppRating: theirs.rating,
    opponent: theirs.username,
    rules: game.rules,
    opening: getParentOpening(eco, variation),
    variation: variation || 'Inconnue',
    moves: moveCount(game.pgn),
  }
}

/** Every standard game of the user, oldest first. */
export function historyRows(games: ChessComGame[], username: string): GameRow[] {
  const rows: GameRow[] = []
  for (const g of games) {
    const r = toRow(g, username)
    if (r) rows.push(r)
  }
  return standardRows(rows)
}

/** The standard games (no variants), oldest first. */
export function standardRows(rows: GameRow[]): GameRow[] {
  return rows.filter(r => r.rules === 'chess').sort((a, b) => a.end - b.end)
}

/** "21061" → "21 061" (French thousands, narrow no-break space). */
export const formatCount = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f')

export interface WDL { w: number; d: number; l: number }

const emptyWdl = (): WDL => ({ w: 0, d: 0, l: 0 })
export const totalOf = (r: WDL) => r.w + r.d + r.l
/** Points scored per game, 0..1 (a draw is half a point). */
export const scoreOf = (r: WDL) => (totalOf(r) ? (r.w + r.d / 2) / totalOf(r) : 0)

function add(r: WDL, result: GameResult) {
  if (result === 'win') r.w++
  else if (result === 'loss') r.l++
  else r.d++
}

export interface RatingTrack {
  timeClass: string
  games: number
  /** Rating before the window (last game before it), else at its first game. */
  start: number
  end: number
  delta: number
  peak: number
  /** At most SERIES_POINTS points, starting from `start`. */
  series: number[]
}

export interface OpeningResult extends WDL {
  name: string
  color: Color
  variations: (WDL & { name: string })[]
}

export type GapId = 'much-weaker' | 'weaker' | 'even' | 'stronger' | 'much-stronger'

export interface GapBucket extends WDL {
  id: GapId
  label: string
  /** Score the rating gap predicts (Elo formula), averaged over the games. */
  expected: number
}

export type DayPart = 'night' | 'morning' | 'afternoon' | 'evening'

export const DAY_PART_LABELS: Record<DayPart, string> = {
  morning: 'Matin (6 h–12 h)',
  afternoon: 'Après-midi (12 h–18 h)',
  evening: 'Soir (18 h–0 h)',
  night: 'Nuit (0 h–6 h)',
}

const DAY_PART_WHEN: Record<DayPart, string> = {
  morning: 'Le matin',
  afternoon: "L'après-midi",
  evening: 'Le soir',
  night: 'La nuit',
}

export interface ResultsStats {
  games: number
  all: WDL
  byColor: Record<Color, WDL>
  ratings: RatingTrack[]
  openings: OpeningResult[]
  /** Wins by the opponent's ending, losses by the user's, draws by kind. */
  winsBy: Partial<Record<Ending, number>>
  lossesBy: Partial<Record<Ending, number>>
  drawsBy: Partial<Record<Ending, number>>
  gaps: GapBucket[]
  /** Losses in SHORT_GAME moves or fewer. */
  shortLosses: number
  avgMoves: number
  /** Live games started soon after a loss, and every other live game. */
  afterLoss: WDL
  otherwise: WDL
  dayParts: (WDL & { id: DayPart })[]
  activeDays: number
}

export const SHORT_GAME = 25
const SERIES_POINTS = 40
/** A live game within this time of the previous one belongs to the same sitting. */
const SAME_SITTING_MS = 45 * 60_000

const GAPS: { id: GapId; label: string; min: number }[] = [
  { id: 'much-stronger', label: 'Bien plus forts (+200)', min: 200 },
  { id: 'stronger', label: 'Plus forts (+50 à +199)', min: 50 },
  { id: 'even', label: 'Même niveau (±49)', min: -49 },
  { id: 'weaker', label: 'Plus faibles (−50 à −199)', min: -199 },
  { id: 'much-weaker', label: 'Bien plus faibles (−200)', min: -Infinity },
]

/** Score the Elo formula predicts against an opponent rated `gap` above you. */
export const expectedScore = (gap: number) => 1 / (1 + 10 ** (gap / 400))

const dayPartOf = (hour: number): DayPart =>
  hour < 6 ? 'night' : hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening'

const localHour = (ms: number) => new Date(ms).getHours()
const localDay = (ms: number) => new Date(ms).toDateString()

/** Each time control's last rating before `start` (rows oldest first). */
export function ratingsBefore(rows: GameRow[], start: number | null): Record<string, number> {
  const out: Record<string, number> = {}
  if (start === null) return out
  for (const r of rows) {
    if (r.end >= start) break
    if (r.rated) out[r.timeClass] = r.rating
  }
  return out
}

function downsample(values: number[], n: number): number[] {
  if (values.length <= n) return values
  const out: number[] = []
  for (let i = 1; i <= n; i++) out.push(values[Math.round((i * values.length) / n) - 1])
  return out
}

/** Summary of a window of rows (oldest first). */
export function computeResults(
  rows: GameRow[],
  opts: { before?: Record<string, number>; hourOf?: (ms: number) => number; dayOf?: (ms: number) => string } = {},
): ResultsStats {
  const hourOf = opts.hourOf ?? localHour
  const dayOf = opts.dayOf ?? localDay
  const all = emptyWdl()
  const byColor = { white: emptyWdl(), black: emptyWdl() }
  const winsBy: Partial<Record<Ending, number>> = {}
  const lossesBy: Partial<Record<Ending, number>> = {}
  const drawsBy: Partial<Record<Ending, number>> = {}
  const gaps = GAPS.map(g => ({ ...emptyWdl(), id: g.id, label: g.label, expected: 0 }))
  const dayParts = (['morning', 'afternoon', 'evening', 'night'] as const).map(id => ({ ...emptyWdl(), id }))
  const afterLoss = emptyWdl()
  const otherwise = emptyWdl()
  const tracks = new Map<string, number[]>()
  const openings = new Map<string, OpeningResult>()
  const days = new Set<string>()
  let shortLosses = 0
  let moves = 0
  let prevLive: GameRow | null = null

  for (const r of rows) {
    add(all, r.result)
    add(byColor[r.color], r.result)
    const by = r.result === 'win' ? winsBy : r.result === 'loss' ? lossesBy : drawsBy
    by[r.ending] = (by[r.ending] ?? 0) + 1
    if (r.result === 'loss' && r.moves <= SHORT_GAME) shortLosses++
    moves += r.moves
    days.add(dayOf(r.end))

    const gap = r.oppRating - r.rating
    const bucket = gaps[GAPS.findIndex(g => gap >= g.min)]
    add(bucket, r.result)
    bucket.expected += expectedScore(gap)

    if (r.rated) {
      const t = tracks.get(r.timeClass) ?? []
      t.push(r.rating)
      tracks.set(r.timeClass, t)
    }

    const key = `${r.color}|${r.opening}`
    const o = openings.get(key) ?? { ...emptyWdl(), name: r.opening, color: r.color, variations: [] }
    add(o, r.result)
    let v = o.variations.find(x => x.name === r.variation)
    if (!v) o.variations.push(v = { ...emptyWdl(), name: r.variation })
    add(v, r.result)
    openings.set(key, o)

    // Daily games run side by side: no sittings, no time of day.
    if (r.timeClass !== 'daily') {
      add(dayParts.find(p => p.id === dayPartOf(hourOf(r.end)))!, r.result)
      const tilted = prevLive !== null && prevLive.result === 'loss' && r.end - prevLive.end <= SAME_SITTING_MS
      add(tilted ? afterLoss : otherwise, r.result)
      prevLive = r
    }
  }
  for (const g of gaps) g.expected = totalOf(g) ? g.expected / totalOf(g) : 0

  const ratings: RatingTrack[] = [...tracks.entries()]
    .map(([timeClass, list]) => {
      const start = opts.before?.[timeClass] ?? list[0]
      const end = list[list.length - 1]
      return {
        timeClass,
        games: list.length,
        start,
        end,
        delta: end - start,
        peak: Math.max(...list),
        series: [start, ...downsample(list, SERIES_POINTS - 1)],
      }
    })
    .sort((a, b) => b.games - a.games)

  for (const o of openings.values()) o.variations.sort((a, b) => totalOf(b) - totalOf(a))

  return {
    games: rows.length,
    all,
    byColor,
    ratings,
    openings: [...openings.values()].sort((a, b) => totalOf(b) - totalOf(a)),
    winsBy,
    lossesBy,
    drawsBy,
    gaps,
    shortLosses,
    avgMoves: rows.length ? moves / rows.length : 0,
    afterLoss,
    otherwise,
    dayParts,
    activeDays: days.size,
  }
}

export interface ResultInsight {
  kind: 'weakness' | 'strength'
  text: string
  /** Larger = more telling; the list is sorted on it. */
  weight: number
}

const pct = (x: number) => `${Math.round(x * 100)}\u00a0%`
const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(Math.round(n))}`
const COLOR_FR: Record<Color, string> = { white: 'les Blancs', black: 'les Noirs' }

/** Below this many games a window says nothing. */
export const MIN_GAMES = 10
/** The games before the window must be this many to stand as "d'habitude". */
const MIN_BASELINE = 30

/** Is the gap between a score over n1 games and another one (over n2 games,
 *  or a fixed expectation when n2 is null) more than chance? One-sided 95 %:
 *  15 games against 15 rarely are, a few hundred usually. */
export function clearGap(s1: number, n1: number, s2: number, n2: number | null): boolean {
  if (n1 === 0 || n2 === 0) return false
  const p = n2 === null ? s2 : (s1 * n1 + s2 * n2) / (n1 + n2)
  const v = Math.max(p * (1 - p), 0.04)
  const se = Math.sqrt(v / n1 + (n2 === null ? 0 : v / n2))
  return Math.abs(s1 - s2) >= 1.65 * se
}

/** The few things worth knowing about a window, each with its numbers, and
 *  only when the gap is clear and the sample big enough. `base`: the games
 *  before the window (null when the window is the whole history). */
export function resultsInsights(cur: ResultsStats, base: ResultsStats | null): ResultInsight[] {
  if (cur.games < MIN_GAMES) return []
  const out: ResultInsight[] = []
  const usual = base && base.games >= MIN_BASELINE ? base : null
  const score = scoreOf(cur.all)

  if (usual) {
    const d = score - scoreOf(usual.all)
    if (Math.abs(d) >= 0.06 && clearGap(score, cur.games, scoreOf(usual.all), usual.games)) {
      out.push(d > 0
        ? { kind: 'strength', text: `Bonne période : tu marques ${pct(score)} des points, contre ${pct(scoreOf(usual.all))} d'habitude.`, weight: d * 10 }
        : { kind: 'weakness', text: `Période difficile : tu marques ${pct(score)} des points, contre ${pct(scoreOf(usual.all))} d'habitude.`, weight: -d * 10 })
    }
  }

  for (const t of cur.ratings) {
    if (t.games < MIN_GAMES || Math.abs(t.delta) < 25) continue
    const tc = t.timeClass === 'rapid' ? 'rapide' : t.timeClass
    out.push({
      kind: t.delta > 0 ? 'strength' : 'weakness',
      text: `${signed(t.delta)} Elo en ${tc} (${t.start} → ${t.end}).`,
      weight: Math.min(Math.abs(t.delta) / 50, 2) * (t === cur.ratings[0] ? 1.2 : 0.8),
    })
  }

  const losses = cur.all.l
  if (losses >= 8) {
    const time = (cur.lossesBy.time ?? 0) / losses
    const usualTime = usual && usual.all.l >= 20 ? (usual.lossesBy.time ?? 0) / usual.all.l : null
    if (usualTime !== null && time - usualTime >= 0.1 && clearGap(time, losses, usualTime, usual!.all.l)) {
      out.push({ kind: 'weakness', text: `${pct(time)} de tes défaites sont au temps, contre ${pct(usualTime)} d'habitude : joue plus vite les coups simples.`, weight: (time - usualTime) * 10 })
    } else if (time >= 0.3) {
      out.push({ kind: 'weakness', text: `${pct(time)} de tes défaites sont au temps : la pendule te coûte des points, garde du temps pour la fin.`, weight: time * 3 })
    }

    const short = cur.shortLosses / losses
    if (short >= 0.25) {
      out.push({ kind: 'weakness', text: `${pct(short)} de tes défaites arrivent avant le ${SHORT_GAME}e coup : une ouverture mal connue ou une gaffe précoce.`, weight: short * 3 })
    }
  }

  const { white, black } = cur.byColor
  if (totalOf(white) >= 15 && totalOf(black) >= 15) {
    const d = scoreOf(white) - scoreOf(black)
    if (Math.abs(d) >= 0.12 && clearGap(scoreOf(white), totalOf(white), scoreOf(black), totalOf(black))) {
      const weak: Color = d > 0 ? 'black' : 'white'
      const strong: Color = d > 0 ? 'white' : 'black'
      out.push({
        kind: 'weakness',
        text: `Avec ${COLOR_FR[weak]} tu marques ${pct(scoreOf(cur.byColor[weak]))}, contre ${pct(scoreOf(cur.byColor[strong]))} avec ${COLOR_FR[strong]} : ton répertoire ${weak === 'white' ? 'Blancs' : 'Noirs'} est la priorité.`,
        weight: Math.abs(d) * 8,
      })
    }
  }

  if (totalOf(cur.afterLoss) >= 15 && totalOf(cur.otherwise) >= 15) {
    const d = scoreOf(cur.otherwise) - scoreOf(cur.afterLoss)
    if (d >= 0.08 && clearGap(scoreOf(cur.afterLoss), totalOf(cur.afterLoss), scoreOf(cur.otherwise), totalOf(cur.otherwise))) {
      out.push({ kind: 'weakness', text: `Juste après une défaite tu marques ${pct(scoreOf(cur.afterLoss))}, contre ${pct(scoreOf(cur.otherwise))} le reste du temps : fais une pause avant de relancer.`, weight: d * 9 })
    }
  }

  const known = cur.openings.filter(o => o.name !== 'Inconnue' && totalOf(o) >= 8)
  const worst = known.reduce<OpeningResult | null>((m, o) => (!m || scoreOf(o) < scoreOf(m) ? o : m), null)
  if (worst && scoreOf(worst) <= score - 0.15 && clearGap(scoreOf(worst), totalOf(worst), score, null)) {
    out.push({ kind: 'weakness', text: `${worst.name} avec ${COLOR_FR[worst.color]} : ${pct(scoreOf(worst))} sur ${formatCount(totalOf(worst))} parties (${pct(score)} en moyenne).`, weight: (score - scoreOf(worst)) * 6 })
  }
  const best = known.reduce<OpeningResult | null>((m, o) => (!m || scoreOf(o) > scoreOf(m) ? o : m), null)
  if (best && best !== worst && scoreOf(best) >= score + 0.15 && clearGap(scoreOf(best), totalOf(best), score, null)) {
    out.push({ kind: 'strength', text: `${best.name} avec ${COLOR_FR[best.color]} : ${pct(scoreOf(best))} sur ${formatCount(totalOf(best))} parties, ton arme.`, weight: (scoreOf(best) - score) * 5 })
  }

  const stronger = mergeGaps(cur.gaps, ['stronger', 'much-stronger'])
  if (totalOf(stronger) >= MIN_GAMES && scoreOf(stronger) - stronger.expected >= 0.08 && clearGap(scoreOf(stronger), totalOf(stronger), stronger.expected, null)) {
    out.push({ kind: 'strength', text: `Contre plus fort que toi tu marques ${pct(scoreOf(stronger))} (le classement prévoit ${pct(stronger.expected)}) : tu te sublimes face aux meilleurs.`, weight: (scoreOf(stronger) - stronger.expected) * 6 })
  }
  const weaker = mergeGaps(cur.gaps, ['weaker', 'much-weaker'])
  if (totalOf(weaker) >= MIN_GAMES && weaker.expected - scoreOf(weaker) >= 0.08 && clearGap(scoreOf(weaker), totalOf(weaker), weaker.expected, null)) {
    out.push({ kind: 'weakness', text: `Contre plus faible que toi tu ne marques que ${pct(scoreOf(weaker))} (le classement prévoit ${pct(weaker.expected)}) : tu relâches ta vigilance.`, weight: (weaker.expected - scoreOf(weaker)) * 6 })
  }

  const live = totalOf(cur.afterLoss) + totalOf(cur.otherwise)
  for (const p of cur.dayParts) {
    const rest = { w: 0, d: 0, l: 0 }
    for (const q of cur.dayParts) if (q !== p) { rest.w += q.w; rest.d += q.d; rest.l += q.l }
    if (totalOf(p) < 15 || totalOf(rest) < 15 || live === 0) continue
    const d = scoreOf(rest) - scoreOf(p)
    if (d >= 0.1 && clearGap(scoreOf(p), totalOf(p), scoreOf(rest), totalOf(rest))) {
      out.push({ kind: 'weakness', text: `${DAY_PART_WHEN[p.id]} tu marques ${pct(scoreOf(p))}, contre ${pct(scoreOf(rest))} le reste de la journée.`, weight: d * 6 })
    }
  }

  return out.sort((a, b) => b.weight - a.weight).slice(0, 5)
}

function mergeGaps(gaps: GapBucket[], ids: GapId[]): WDL & { expected: number } {
  const out = { w: 0, d: 0, l: 0, expected: 0 }
  for (const g of gaps) {
    if (!ids.includes(g.id)) continue
    out.w += g.w; out.d += g.d; out.l += g.l
    out.expected += g.expected * totalOf(g)
  }
  if (totalOf(out)) out.expected /= totalOf(out)
  return out
}
