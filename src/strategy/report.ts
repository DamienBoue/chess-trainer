// Entry point of the strategy domain: one FEN in, one strategic report out.
//
// The report is *descriptive* (what the position looks like: structure,
// squares, pieces, king safety, space) and *prescriptive* (plans for each
// side, with the reasons and the first concrete moves). It never runs an
// engine: callers can cross-check plans against Stockfish's best move with
// `planMatchesMove`.

import {
  type AttackMaps, type Board, type Material, type Side,
  parseFen, computeAttacks, materialOf,
} from './board'
import { type PawnStructure, analyzePawns } from './pawns'
import { type SquareAnalysis, analyzeSquares } from './squares'
import { type CenterInfo, type PawnBreak, classifyCenter, findPawnBreaks } from './center'
import { type StructureMatch, detectStructures } from './structures'
import {
  type BishopVerdict, type KingSafety, type Phase, type PieceActivity, type RookFact,
  analyzeBishops, analyzeKingSafety, analyzeRooks, detectPhase, pieceActivity, spaceScore, undevelopedMinors,
} from './pieces'
import { type Insight, buildInsights } from './insights'
import { type Plan, buildPlans } from './plans'

export interface ReportCore {
  fen: string
  board: Board
  atk: AttackMaps
  phase: Phase
  material: Record<Side, Material>
  pawns: PawnStructure
  squares: SquareAnalysis
  center: CenterInfo
  structures: StructureMatch[]
  breaks: Record<Side, PawnBreak[]>
  kings: Record<Side, KingSafety>
  bishops: Record<Side, BishopVerdict[]>
  rooks: Record<Side, RookFact[]>
  space: Record<Side, number>
  activity: Record<Side, PieceActivity[]>
  undeveloped: Record<Side, number[]>
}

export interface StrategicReport extends ReportCore {
  insights: Insight[]
  plans: Record<Side, Plan[]>
}

export function analyzeCore(fen: string): ReportCore {
  const board = parseFen(fen)
  const atk = computeAttacks(board)
  const material = { w: materialOf(board, 'w'), b: materialOf(board, 'b') }
  const phase = detectPhase(board, material.w, material.b)
  const pawns = analyzePawns(board)
  const squares = analyzeSquares(board, pawns)
  const center = classifyCenter(board, pawns)
  const both = <T>(fn: (s: Side) => T): Record<Side, T> => ({ w: fn('w'), b: fn('b') })
  return {
    fen, board, atk, phase, material, pawns, squares, center,
    structures: detectStructures(board),
    breaks: both(s => findPawnBreaks(board, pawns, atk, s, center)),
    kings: both(s => analyzeKingSafety(board, s, pawns, phase)),
    bishops: both(s => analyzeBishops(board, s, pawns)),
    rooks: both(s => analyzeRooks(board, s, pawns)),
    space: both(s => spaceScore(board, s, pawns, atk)),
    activity: both(s => pieceActivity(board, s, pawns)),
    undeveloped: both(s => undevelopedMinors(board, s)),
  }
}

export function analyzePosition(fen: string): StrategicReport {
  const core = analyzeCore(fen)
  return {
    ...core,
    insights: buildInsights(core),
    plans: { w: buildPlans(core, 'w'), b: buildPlans(core, 'b') },
  }
}

/** Does a played/engine move (from → to squares) start this plan? */
export function planMatchesMove(plan: Plan, from: number, to: number): boolean {
  return plan.moves.some(m =>
    (m.from === undefined || m.from === from) && (m.to === undefined || m.to === to)
    && (m.from !== undefined || m.to !== undefined))
}
