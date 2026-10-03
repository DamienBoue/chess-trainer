// Game-level strategic review: how the structure evolved, which structural
// decisions each side made (and what they cost according to the engine),
// which strategic opportunities were missed, and the lessons to keep.
//
// Works on an analysed game (FEN before/after every move + Stockfish's
// verdict). Every position gets a light "snapshot" (pawns, squares, centre,
// structures, material); the full plan generator only runs on the few
// positions where the player lost significant value, to explain what the
// engine was after.

import type { GameAnalysis, MoveAnalysis } from '../types'
import { type Board, type Material, type Side, parseFen, materialOf, sqName, sqIndex, fileOf, kingSquare, opp } from './board'
import { type PawnStructure, analyzePawns } from './pawns'
import { type SquareAnalysis, analyzeSquares } from './squares'
import { type CenterType, classifyCenter } from './center'
import { type StructureMatch, detectStructures } from './structures'
import { analyzePosition, planMatchesMove } from './report'
import type { Plan } from './plans'
import { squareList } from './text'
import { Chess } from 'chess.js'

interface Snapshot {
  board: Board
  pawns: PawnStructure
  squares: SquareAnalysis
  center: CenterType
  structures: StructureMatch[]
  material: Record<Side, Material>
}

function snapshot(fen: string): Snapshot {
  const board = parseFen(fen)
  const pawns = analyzePawns(board)
  return {
    board,
    pawns,
    squares: analyzeSquares(board, pawns),
    center: classifyCenter(board, pawns).type,
    structures: detectStructures(board),
    material: { w: materialOf(board, 'w'), b: materialOf(board, 'b') },
  }
}

export interface StructureSegment {
  id: string
  name: string
  conceptId?: string
  sideA: Side
  /** First and last ply (1-based, inclusive) during which the structure was on the board. */
  fromPly: number
  toPly: number
}

export interface CenterSegment { type: CenterType; fromPly: number; toPly: number }

export type GameEventKind =
  | 'isolated' | 'doubled' | 'backward' | 'holes' | 'king-shelter' | 'bishop-pair'
  | 'passed-created' | 'passed-allowed' | 'break-played' | 'outpost-occupied'
  | 'missed-plan'

export interface GameEvent {
  /** Ply of the move that caused the event (1-based). */
  ply: number
  /** Side that played that move. */
  side: Side
  kind: GameEventKind
  /** From the mover's point of view. */
  polarity: 'plus' | 'minus' | 'info'
  title: string
  detail: string
  /** Engine verdict on the move, when it was costly. */
  cpLoss: number
  conceptId?: string
  squares: number[]
  /** Ply to show on the board: the decision point (before the move) for missed plans, the result otherwise. */
  focusPly: number
  /** For missed plans: which kind of plan the engine was after. */
  planKind?: Plan['kind']
  planId?: string
}

export interface GameStrategyReview {
  structures: StructureSegment[]
  centers: CenterSegment[]
  events: GameEvent[]
  lessons: string[]
  /** Main structure of the middlegame, from the user's point of view. */
  mainStructure: { id: string; name: string; conceptId?: string; userRole: 'A' | 'B'; plies: number } | null
}

const moverOf = (ply: number): Side => (ply % 2 === 1 ? 'w' : 'b')

function moveLabel(m: MoveAnalysis): string {
  return `${Math.ceil(m.ply / 2)}${m.ply % 2 === 1 ? '.' : '...'} ${m.san}`
}

function sidePawns(s: Snapshot, side: Side) {
  return side === 'w' ? s.pawns.w : s.pawns.b
}

function newSquares(before: number[], after: number[]): number[] {
  const b = new Set(before)
  return after.filter(x => !b.has(x))
}

function hasPair(m: Material) {
  return m.lightBishops > 0 && m.darkBishops > 0
}

/** Structural consequences of one move for the side that played it.
 *  When the move is a capture answered by a recapture on the same square,
 *  the structure is judged once the exchange is over (Panov: 7.cxd5 Nxd5
 *  leaves an isolated d4 pawn, not doubled d-pawns). */
function structuralEvents(
  m: MoveAnalysis, before: Snapshot, immediate: Snapshot, afterReply: Snapshot | null, reply: MoveAnalysis | null,
): GameEvent[] {
  const side = moverOf(m.ply)
  const recaptured = !!reply && !!afterReply && m.san.includes('x') && reply.san.includes('x')
    && moveSquares(reply).to === moveSquares(m).to
  const after = recaptured ? afterReply! : immediate
  const them = opp(side)
  const out: GameEvent[] = []
  const ev = (e: Omit<GameEvent, 'ply' | 'side' | 'cpLoss' | 'focusPly'>) =>
    out.push({ ...e, ply: m.ply, side, cpLoss: m.cpLoss, focusPly: m.ply })
  const costly = m.cpLoss >= 50
  const verdict = costly ? ` Le moteur a jugé ce coup coûteux (−${m.cpLoss} cp).` : ''

  const mineB = sidePawns(before, side), mineA = sidePawns(after, side)
  const theirsB = sidePawns(before, them), theirsA = sidePawns(after, them)
  const list = (ps: typeof mineA, pred: (p: (typeof mineA.pawns)[number]) => boolean) => ps.pawns.filter(pred).map(p => p.sq)

  const isoB = list(mineB, p => p.isolated && !p.passed), isoA = list(mineA, p => p.isolated && !p.passed)
  if (isoA.length > isoB.length) {
    const sqs = newSquares(isoB, isoA)
    ev({
      kind: 'isolated', polarity: 'minus', squares: sqs, conceptId: 'isolated-pawn',
      title: `Pion isolé créé (${squareList(sqs)})`,
      detail: `Après ${moveLabel(m)}, ${sqs.length > 1 ? 'tes pions' : 'ton pion'} ${squareList(sqs)} ne peu${sqs.length > 1 ? 'vent' : 't'} plus être protégé${sqs.length > 1 ? 's' : ''} par un pion : une cible durable, surtout en finale.${verdict}`,
    })
  }
  const dblFiles = (ps: typeof mineA) => ps.fileCounts.map((c, f) => (c > 1 ? f : -1)).filter(f => f >= 0)
  if (dblFiles(mineA).length > dblFiles(mineB).length) {
    const files = dblFiles(mineA).filter(f => !dblFiles(mineB).includes(f))
    const sqs = mineA.pawns.filter(p => files.includes(fileOf(p.sq))).map(p => p.sq)
    ev({
      kind: 'doubled', polarity: costly ? 'minus' : 'info', squares: sqs, conceptId: 'doubled-pawns',
      title: `Pions doublés (${squareList(sqs)})`,
      detail: `${moveLabel(m)} double tes pions. C'est parfois le prix d'une colonne semi-ouverte ou de la paire de fous — mais c'est une faiblesse de structure à long terme.${verdict}`,
    })
  }
  const bwB = list(mineB, p => p.backward), bwA = list(mineA, p => p.backward)
  if (bwA.length > bwB.length) {
    const sqs = newSquares(bwB, bwA)
    ev({
      kind: 'backward', polarity: 'minus', squares: sqs, conceptId: 'backward-pawn',
      title: `Pion arriéré créé (${squareList(sqs)})`,
      detail: `Après ${moveLabel(m)}, le pion ${squareList(sqs)} ne peut plus avancer ni être soutenu par un pion ; la case devant lui devient un point d'appui adverse.${verdict}`,
    })
  }

  // New holes in our camp that the opponent can actually use.
  const holesB = before.squares.weak[side].filter(w => w.score >= 7).map(w => w.sq)
  const holesA = after.squares.weak[side].filter(w => w.score >= 7).map(w => w.sq)
  const freshHoles = newSquares(holesB, holesA)
  if (freshHoles.length > 0 && m.san[0] >= 'a' && m.san[0] <= 'h') {
    ev({
      kind: 'holes', polarity: costly ? 'minus' : 'info', squares: freshHoles, conceptId: 'weak-square',
      title: `Case${freshHoles.length > 1 ? 's' : ''} faible${freshHoles.length > 1 ? 's' : ''} créée${freshHoles.length > 1 ? 's' : ''} (${squareList(freshHoles)})`,
      detail: `Un pion ne recule jamais : avec ${moveLabel(m)}, ${squareList(freshHoles)} ne pourra plus être contrôlé par tes pions. Une pièce adverse (surtout un cavalier) pourra s'y installer.${verdict}`,
    })
  }

  // Pawn moves in front of our own castled king.
  const king = kingSquare(after.board, side)
  const castledWing = king >= 0 && (fileOf(king) <= 2 || fileOf(king) >= 6)
  if (castledWing && /^[a-h]/.test(m.san) && !m.san.includes('x')) {
    const { from: f0 } = moveSquares(m)
    if (f0 >= 0 && Math.abs(fileOf(f0) - fileOf(king)) <= 1 && after.material[them].queens > 0) {
      ev({
        kind: 'king-shelter', polarity: costly ? 'minus' : 'info', squares: [f0, king], conceptId: 'king-safety',
        title: 'Abri du roi affaibli',
        detail: `${moveLabel(m)} avance un pion devant ton roi roqué : chaque poussée crée des cases faibles et des leviers pour l'adversaire.${verdict}`,
      })
    }
  }

  // Bishop pair given up: our bishop captured, and the reply took it back.
  if (afterReply && /^Bx/.test(m.san) && hasPair(before.material[side]) && !hasPair(afterReply.material[side])
    && hasPair(afterReply.material[them])) {
    ev({
      kind: 'bishop-pair', polarity: costly ? 'minus' : 'info', squares: [], conceptId: 'bishop-pair',
      title: 'Paire de fous cédée',
      detail: `${moveLabel(m)} échange un fou contre un cavalier : l'adversaire garde la paire de fous, un atout durable quand la position s'ouvre.${verdict}`,
    })
  }

  // Passed pawns.
  const passB = list(mineB, p => p.passed), passA = list(mineA, p => p.passed)
  if (passA.length > passB.length) {
    const sqs = newSquares(passB, passA)
    ev({
      kind: 'passed-created', polarity: 'plus', squares: sqs, conceptId: 'passed-pawn',
      title: `Pion passé obtenu (${squareList(sqs)})`,
      detail: `Après ${moveLabel(m)}, plus aucun pion adverse ne peut arrêter ${squareList(sqs)}.`,
    })
  }
  const tpB = list(theirsB, p => p.passed), tpA = list(theirsA, p => p.passed)
  if (tpA.length > tpB.length) {
    const sqs = newSquares(tpB, tpA)
    ev({
      kind: 'passed-allowed', polarity: 'minus', squares: sqs, conceptId: 'blockade',
      title: `Pion passé concédé (${squareList(sqs)})`,
      detail: `${moveLabel(m)} laisse à l'adversaire un pion passé en ${squareList(sqs)} : il faudra le bloquer.${verdict}`,
    })
  }

  // Knight landing on a real outpost.
  if (m.san.startsWith('N')) {
    const { to } = moveSquares(m)
    const o = immediate.squares.outposts[side].find(x => x.sq === to && x.pawnProtected && x.score >= 6)
    if (o) {
      ev({
        kind: 'outpost-occupied', polarity: 'plus', squares: [to], conceptId: 'outpost',
        title: `Cavalier sur l'avant-poste ${sqName(to)}`,
        detail: `${moveLabel(m)} installe un cavalier sur une case qu'aucun pion adverse ne peut contester.`,
      })
    }
  }
  return out
}

const squaresCache = new Map<string, { from: number; to: number }>()

/** From/to squares of the move actually played. */
function moveSquares(m: MoveAnalysis): { from: number; to: number } {
  const key = `${m.fenBefore}|${m.san}`
  const hit = squaresCache.get(key)
  if (hit) return hit
  let res = { from: -1, to: -1 }
  try {
    const mv = new Chess(m.fenBefore).move(m.san)
    res = { from: sqIndex(mv.from), to: sqIndex(mv.to) }
  } catch { /* keep -1 */ }
  if (squaresCache.size > 5000) squaresCache.clear()
  squaresCache.set(key, res)
  return res
}

function sanSquares(fen: string, san?: string): { from: number; to: number; captured?: string } | null {
  if (!san) return null
  try {
    const mv = new Chess(fen).move(san)
    return { from: sqIndex(mv.from), to: sqIndex(mv.to), captured: mv.captured }
  } catch {
    return null
  }
}

const STRATEGIC_KINDS = new Set<Plan['kind']>([
  'central-break', 'wing-play', 'minority-attack', 'majority', 'passed-pawn', 'blockade', 'outpost',
  'weak-pawn', 'open-file', 'seventh-rank', 'pawn-storm', 'open-center', 'structure', 'king-activity',
  'castle', 'development', 'bishop-pair', 'bad-bishop',
])

/** When a move cost value and the engine's choice started a recognised
 *  plan that the played move didn't follow, that's a missed strategic idea. */
function missedPlan(m: MoveAnalysis): GameEvent | null {
  if (m.cpLoss < 60 || !m.bestMoveSan || m.bestMoveSan === m.san) return null
  const side = moverOf(m.ply)
  const best = sanSquares(m.fenBefore, m.bestMoveSan)
  const played = moveSquares(m)
  if (!best) return null
  // Winning a piece is tactics, not strategy (the exercises cover it).
  if (best.captured && best.captured !== 'p') return null
  const report = analyzePosition(m.fenBefore)
  const plan = report.plans[side].find(p => STRATEGIC_KINDS.has(p.kind) && planMatchesMove(p, best.from, best.to))
  if (!plan) return null
  if (planMatchesMove(plan, played.from, played.to)) return null
  return {
    ply: m.ply, side, kind: 'missed-plan', polarity: 'minus', cpLoss: m.cpLoss,
    title: `Plan manqué : ${plan.title}`,
    detail: `Au lieu de ${moveLabel(m)}, le moteur jouait ${m.bestMoveSan}, qui lance ce plan. ${plan.why}`,
    conceptId: plan.conceptId,
    squares: [best.from, best.to],
    focusPly: m.ply - 1,
    planKind: plan.kind,
    planId: plan.id,
  }
}

export function reviewGameStrategy(a: GameAnalysis): GameStrategyReview {
  const n = a.moves.length
  if (n === 0) return { structures: [], centers: [], events: [], lessons: [], mainStructure: null }
  // snaps[i] = position after i plies (snaps[0] = start).
  const snaps: Snapshot[] = [snapshot(a.moves[0].fenBefore), ...a.moves.map(m => snapshot(m.fenAfter))]

  // Structures & centre timelines.
  const structures: StructureSegment[] = []
  const open = new Map<string, StructureSegment>()
  const centers: CenterSegment[] = []
  for (let ply = 1; ply <= n; ply++) {
    const s = snaps[ply]
    const present = new Set<string>()
    for (const m of s.structures) {
      const key = `${m.pattern.id}:${m.sideA}`
      present.add(key)
      const seg = open.get(key)
      if (seg && seg.toPly === ply - 1) seg.toPly = ply
      else {
        const fresh: StructureSegment = { id: m.pattern.id, name: m.pattern.name, conceptId: m.pattern.conceptId, sideA: m.sideA, fromPly: ply, toPly: ply }
        structures.push(fresh)
        open.set(key, fresh)
      }
    }
    const last = centers[centers.length - 1]
    if (last && last.type === s.center && last.toPly === ply - 1) last.toPly = ply
    else centers.push({ type: s.center, fromPly: ply, toPly: ply })
  }
  // Ignore flickers: a structure must hold for 4+ plies to count.
  const lasting = structures.filter(sg => sg.toPly - sg.fromPly >= 3)

  const events: GameEvent[] = []
  for (let i = 0; i < n; i++) {
    const m = a.moves[i]
    events.push(...structuralEvents(m, snaps[i], snaps[i + 1], i + 2 <= n ? snaps[i + 2] : null, a.moves[i + 1] ?? null))
    const missed = missedPlan(m)
    if (missed) events.push(missed)
  }

  const userSide: Side = a.userColor === 'white' ? 'w' : 'b'
  const userRoleOf = (sg: StructureSegment): 'A' | 'B' => (sg.sideA === userSide ? 'A' : 'B')
  const main = [...lasting].sort((x, y) => (y.toPly - y.fromPly) - (x.toPly - x.fromPly))[0]
  const mainStructure = main
    ? { id: main.id, name: main.name, conceptId: main.conceptId, userRole: userRoleOf(main), plies: main.toPly - main.fromPly + 1 }
    : null

  return { structures: lasting, centers, events, lessons: buildLessons(a, events, mainStructure, userSide), mainStructure }
}

function buildLessons(
  a: GameAnalysis,
  events: GameEvent[],
  main: GameStrategyReview['mainStructure'],
  userSide: Side,
): string[] {
  const lessons: string[] = []
  const mine = events.filter(e => e.side === userSide)
  const missed = mine.filter(e => e.kind === 'missed-plan').sort((x, y) => y.cpLoss - x.cpLoss)[0]
  if (missed) {
    const m = a.moves[missed.ply - 1]
    const planTitle = missed.title.slice('Plan manqué : '.length)
    lessons.push(`Coup ${moveLabel(m)} : le plan « ${planTitle} » était la bonne idée (le moteur jouait ${m.bestMoveSan}, ton coup a coûté ${missed.cpLoss} cp).`)
  }
  const structural = mine
    .filter(e => e.polarity === 'minus' && e.kind !== 'missed-plan')
    .sort((x, y) => y.cpLoss - x.cpLoss)[0]
  if (structural) {
    const m = a.moves[structural.ply - 1]
    lessons.push(`Coup ${moveLabel(m)} : ${structural.title.charAt(0).toLowerCase()}${structural.title.slice(1)}${structural.cpLoss >= 50 ? ` (−${structural.cpLoss} cp)` : ''}. Avant chaque coup de pion, demande-toi quelle case ou quel pion il affaiblit pour toujours.`)
  }
  const exploited = events.filter(e => e.side !== userSide && e.polarity === 'minus' && e.kind !== 'missed-plan')
  if (exploited.length > 0 && lessons.length < 3) {
    const e = exploited.sort((x, y) => y.cpLoss - x.cpLoss)[0]
    const m = a.moves[e.ply - 1]
    lessons.push(`L'adversaire t'a offert une cible au coup ${moveLabel(m)} (${e.title.charAt(0).toLowerCase()}${e.title.slice(1)}) : fixe-la, puis attaque-la avec tes pièces.`)
  }
  if (main && lessons.length < 3) {
    lessons.push(`Structure dominante : ${main.name} (${main.plies} demi-coups). Revois ses plans types${main.userRole === 'A' ? '' : ' côté défenseur'} : c'est la structure que tu as eue le plus longtemps sur l'échiquier.`)
  }
  if (lessons.length === 0) lessons.push('Pas d\'erreur stratégique marquante détectée : ta structure est restée saine et tes coups suivaient des plans cohérents.')
  return lessons
}
