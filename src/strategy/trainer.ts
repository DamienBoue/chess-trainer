// Strategy trainer: turns the player's own games (and the reference
// structure positions) into short positional drills.
//
//   * plan      — a position where the player missed the engine's idea:
//                 "which plan?" among the plans detected in the position
//   * square    — "click the strongest square for your knight"
//   * structure — "name this pawn structure"
//
// Everything is deterministic for a given seed so a session can be
// reproduced (and tested).

import { Chess } from 'chess.js'
import type { GameAnalysis } from '../types'
import { type Side, SIDE_LABEL, parseFen, sqIndex, sqName } from './board'
import { analyzePawns } from './pawns'
import { analyzeSquares } from './squares'
import { analyzePosition } from './report'
import type { GameStrategyReview } from './game'
import { PLAN_KIND_LABELS, type PlanKind } from './plans'
import { STRUCTURES, detectStructures, structureRole } from './structures'
import { STRUCTURE_SAMPLES, sampleFen } from './samples'

export type DrillKind = 'plan' | 'square' | 'structure'

export interface DrillChoice { id: string; label: string }

export interface Drill {
  id: string
  kind: DrillKind
  fen: string
  /** The side the question is asked for (board orientation). */
  side: Side
  prompt: string
  choices?: DrillChoice[]
  /** Correct choice ids (plan/structure) or square names (square). */
  answer: string[]
  explanation: string
  conceptId?: string
  /** Revealed after answering. */
  arrows: [number, number][]
  squares: number[]
  source?: { url: string; ply: number; label: string }
}

export const DRILL_LABELS: Record<DrillKind, string> = {
  plan: 'Quel plan ?',
  square: 'Case forte',
  structure: 'Nomme la structure',
}

// ---------------- deterministic randomness ----------------

function hash(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0 }
  return h
}

function rng(seed: number) {
  let x = seed || 1
  return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return ((x >>> 0) % 1_000_000) / 1_000_000 }
}

function shuffle<T>(xs: T[], seed: number): T[] {
  const r = rng(seed)
  const out = xs.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** Textbook plans used as distractors when they don't apply. */
const GENERIC_KINDS: PlanKind[] = [
  'minority-attack', 'pawn-storm', 'simplify', 'open-center', 'open-file',
  'king-activity', 'bad-bishop', 'blockade', 'seventh-rank', 'outpost', 'central-break',
]

const moveLabel = (ply: number, san: string) => `${Math.ceil(ply / 2)}${ply % 2 === 1 ? '.' : '...'} ${san}`

// ---------------- builders ----------------

export function planDrills(a: GameAnalysis, review: GameStrategyReview): Drill[] {
  const userSide: Side = a.userColor === 'white' ? 'w' : 'b'
  const out: Drill[] = []
  for (const e of review.events) {
    if (e.kind !== 'missed-plan' || e.side !== userSide || !e.planId) continue
    const m = a.moves[e.ply - 1]
    if (!m?.bestMoveSan) continue
    const report = analyzePosition(m.fenBefore)
    const plans = report.plans[userSide]
    const correct = plans.find(p => p.id === e.planId)
    if (!correct) continue
    // Choices are square-free kinds of plans, so the right answer doesn't
    // stand out by its precision: two that exist in the position, then
    // textbook plans that do NOT apply here.
    const detectedKinds = [...new Set(plans.map(p => p.kind))]
      .filter(k => k !== correct.kind && k !== 'structure').slice(0, 2)
    const fillers = shuffle(
      GENERIC_KINDS.filter(k => k !== correct.kind && !detectedKinds.includes(k)),
      hash(a.url + e.ply + 'g'),
    ).slice(0, 3 - detectedKinds.length)
    const choices = shuffle([correct.kind, ...detectedKinds, ...fillers], hash(a.url + e.ply))
      .map(k => ({ id: k, label: PLAN_KIND_LABELS[k] }))
    out.push({
      id: `plan:${a.url}:${e.ply}`,
      kind: 'plan',
      fen: m.fenBefore,
      side: userSide,
      prompt: `Trait aux ${SIDE_LABEL[userSide]}. Le moteur avait une idée claire ici : quel plan ?`,
      choices,
      answer: [correct.kind],
      explanation: `${correct.title} — ${correct.why} Le moteur jouait ${m.bestMoveSan} ; dans la partie, ${moveLabel(m.ply, m.san)} a coûté ${m.cpLoss} cp.`,
      conceptId: correct.conceptId,
      arrows: correct.arrows,
      squares: correct.squares,
      source: { url: a.url, ply: m.ply - 1, label: `vs ${a.opponent}, coup ${moveLabel(m.ply, m.san)}` },
    })
  }
  return out
}

/** Middlegame positions with the user to move and a real, free outpost. */
export function squareDrills(a: GameAnalysis, max = 2): Drill[] {
  const userSide: Side = a.userColor === 'white' ? 'w' : 'b'
  const out: Drill[] = []
  const n = a.moves.length
  for (let i = 16; i < n - 6 && out.length < max; i += 3) {
    const m = a.moves[i]
    if (!m || ((m.ply % 2 === 1) !== (userSide === 'w'))) continue
    const board = parseFen(m.fenBefore)
    const ps = analyzePawns(board)
    const outposts = analyzeSquares(board, ps).outposts[userSide]
      .filter(o => o.pawnProtected && !o.occupant && o.score >= 7)
    if (outposts.length === 0) continue
    const best = outposts[0]
    const answer = outposts.filter(o => o.score >= best.score - 1).map(o => sqName(o.sq))
    out.push({
      id: `square:${a.url}:${m.ply}`,
      kind: 'square',
      fen: m.fenBefore,
      side: userSide,
      prompt: `Trait aux ${SIDE_LABEL[userSide]}. Clique sur la meilleure case forte pour un de tes cavaliers.`,
      answer,
      explanation: `${sqName(best.sq)} : ${best.reasons.join(', ')}.`,
      conceptId: 'outpost',
      arrows: routeArrows(best.route),
      squares: answer.map(sqIndex),
      source: { url: a.url, ply: m.ply - 1, label: `vs ${a.opponent}, avant ${moveLabel(m.ply, m.san)}` },
    })
    i += 6 // spread the drills along the game
  }
  return out
}

function routeArrows(route?: { from: number; path: number[] }): [number, number][] {
  if (!route) return []
  const pts = [route.from, ...route.path]
  return pts.slice(1).map((to, k) => [pts[k], to] as [number, number])
}

function structureChoices(correctId: string, seed: number): DrillChoice[] {
  const others = shuffle(STRUCTURES.filter(p => p.id !== correctId), seed).slice(0, 3)
  const correct = STRUCTURES.find(p => p.id === correctId)!
  return shuffle([correct, ...others], seed + 1).map(p => ({ id: p.id, label: p.name }))
}

function structureDrill(fen: string, id: string, source?: Drill['source']): Drill | null {
  const matches = detectStructures(parseFen(fen))
  const m = matches[0]
  if (!m) return null
  const turn: Side = fen.split(' ')[1] === 'b' ? 'b' : 'w'
  const role = structureRole(m, turn)
  return {
    id,
    kind: 'structure',
    fen,
    side: turn,
    prompt: 'Regarde les pions : quelle est cette structure ?',
    choices: structureChoices(m.pattern.id, hash(id)),
    answer: [m.pattern.id],
    explanation: `${m.pattern.summary} Plan type pour ${SIDE_LABEL[turn].toLowerCase()} (${role.role}) : ${role.plans[0]}`,
    conceptId: m.pattern.conceptId,
    arrows: role.breaks.filter(([f]) => { const p = parseFen(fen).squares[f]; return !!p && p.type === 'p' }),
    squares: role.squares,
    source,
  }
}

export function structureDrillsFromGame(a: GameAnalysis, review: GameStrategyReview): Drill[] {
  const out: Drill[] = []
  for (const sg of review.structures) {
    const mid = Math.min(a.moves.length - 1, Math.floor((sg.fromPly + sg.toPly) / 2))
    const m = a.moves[mid]
    if (!m) continue
    const d = structureDrill(m.fenAfter, `structure:${a.url}:${mid}`, { url: a.url, ply: m.ply, label: `vs ${a.opponent}` })
    if (d && d.answer[0] === sg.id) out.push(d)
  }
  return out
}

export function sampleStructureDrills(): Drill[] {
  return STRUCTURE_SAMPLES
    .map(s => structureDrill(sampleFen(s), `structure:sample:${s.structureId}`))
    .filter((d): d is Drill => !!d && d.answer.length > 0)
}

export interface DrillSetOptions {
  size?: number
  seed?: number
  kinds?: DrillKind[]
}

/** A mixed session, the player's own positions first, reference positions to fill. */
export function buildDrillSet(
  analyses: GameAnalysis[],
  reviews: Map<string, GameStrategyReview>,
  opts: DrillSetOptions = {},
): Drill[] {
  const size = opts.size ?? 10
  const seed = opts.seed ?? 1
  const kinds = opts.kinds ?? ['plan', 'square', 'structure']
  const pools: Record<DrillKind, Drill[]> = { plan: [], square: [], structure: [] }
  for (const a of analyses) {
    const r = reviews.get(a.url)
    if (!r) continue
    if (kinds.includes('plan')) pools.plan.push(...planDrills(a, r))
    if (kinds.includes('square')) pools.square.push(...squareDrills(a))
    if (kinds.includes('structure')) pools.structure.push(...structureDrillsFromGame(a, r))
  }
  if (kinds.includes('structure') && pools.structure.length < size) pools.structure.push(...sampleStructureDrills())
  const shuffled = kinds.map((k, i) => shuffle(dedupe(pools[k]), seed + i * 7919))
  // Round-robin across kinds so a session mixes question types.
  const out: Drill[] = []
  for (let round = 0; out.length < size; round++) {
    let added = false
    for (const pool of shuffled) {
      if (round < pool.length && out.length < size) { out.push(pool[round]); added = true }
    }
    if (!added) break
  }
  return out
}

function dedupe(ds: Drill[]): Drill[] {
  const seen = new Set<string>()
  return ds.filter(d => {
    const key = d.fen.split(' ').slice(0, 2).join(' ') + d.kind
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** Checks a square-drill click. */
export function isCorrectSquare(d: Drill, square: string): boolean {
  return d.kind === 'square' && d.answer.includes(square)
}

/** Validates that a drill's FEN is playable (used by tests / guards). */
export function drillIsLegal(d: Drill): boolean {
  try { new Chess(d.fen); return true } catch { return false }
}
