import { Chess } from 'chess.js'
import type { ChessComGame, GameAnalysis, MoveAnalysis } from '../types'
import { StockfishEngine, toWhitePerspective } from '../engine/stockfish'
import { extractMoves, getUserSide, getResultForUser, parsePgnHeaders } from './pgn'
import { classifyByCpLoss } from './classify'

export interface AnalyzeProgress {
  done: number
  total: number
  currentSan?: string
}

interface AnalyzeOptions {
  depth?: number
  movetimeMs?: number
  bookPlies?: number
  onProgress?: (p: AnalyzeProgress) => void
  signal?: AbortSignal
}

const CP_CLAMP = 1000
export function clampCp(v: number): number {
  return Math.max(-CP_CLAMP, Math.min(CP_CLAMP, v))
}

// Recompute cpLoss + classification from a stored move's evalBefore/evalAfter.
// Used to migrate analyses persisted before the cp clamp fix.
export function recomputeMoveMetrics(
  move: { fenBefore: string; evalBefore: number; evalAfter: number; san: string; bestMoveSan?: string },
  bookPliesIndex: number,
  bookPlies: number = 8,
): { cpLoss: number; classification: ReturnType<typeof classifyByCpLoss> } {
  const stm = move.fenBefore.split(' ')[1]
  const sign = stm === 'w' ? 1 : -1
  const moverEvalBefore = clampCp(sign * move.evalBefore)
  const moverEvalAfter = clampCp(sign * move.evalAfter)
  const cpLoss = Math.max(0, moverEvalBefore - moverEvalAfter)
  const isBest = !!move.bestMoveSan && move.bestMoveSan === move.san
  const isBook = bookPliesIndex < bookPlies
  return { cpLoss, classification: classifyByCpLoss(cpLoss, isBest, isBook) }
}

// Convert a UCI move to SAN given the FEN it is played from.
function uciToSan(fen: string, uci: string): string | undefined {
  if (!uci || uci.length < 4) return undefined
  const chess = new Chess(fen)
  const from = uci.slice(0, 2)
  const to = uci.slice(2, 4)
  const promo = uci.length > 4 ? uci.slice(4, 5) : undefined
  try {
    const mv = chess.move({ from, to, promotion: promo })
    return mv?.san
  } catch {
    return undefined
  }
}

function pvToSan(fen: string, pvUci: string[], maxLen = 6): string {
  const chess = new Chess(fen)
  const sans: string[] = []
  for (const uci of pvUci.slice(0, maxLen)) {
    if (!uci || uci.length < 4) break
    try {
      const mv = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci.length > 4 ? uci.slice(4, 5) : undefined })
      if (!mv) break
      sans.push(mv.san)
    } catch {
      break
    }
  }
  return sans.join(' ')
}

export async function analyzeGame(
  engine: StockfishEngine,
  game: ChessComGame,
  username: string,
  options: AnalyzeOptions = {},
): Promise<GameAnalysis> {
  const { depth = 12, movetimeMs = 600, bookPlies = 8, onProgress, signal } = options
  const moves = extractMoves(game.pgn)
  const headers = parsePgnHeaders(game.pgn)
  const userColor = getUserSide(game, username)
  const result = getResultForUser(game, username)
  const opponent = userColor === 'white' ? game.black.username : game.white.username
  const opponentRating = userColor === 'white' ? game.black.rating : game.white.rating
  const userRating = userColor === 'white' ? game.white.rating : game.black.rating

  const analyses: MoveAnalysis[] = []
  // We need eval at every position from start to end (n+1 positions for n moves).
  // For each move i: evalBefore = eval(fenBefore_i), evalAfter = eval(fenAfter_i).
  // We can reuse evalAfter_i as evalBefore_{i+1}.
  let prevAfterEval: { scoreCpWhite: number; bestUci?: string; pvUci: string[]; isMate: boolean } | null = null

  for (let i = 0; i < moves.length; i++) {
    if (signal?.aborted) throw new DOMException('Analysis aborted', 'AbortError')
    const move = moves[i]
    onProgress?.({ done: i, total: moves.length, currentSan: move.san })

    let beforeRaw: { scoreCp: number; bestMoveUci?: string; pvUci: string[]; isMate: boolean }
    if (prevAfterEval) {
      // Note: previous "afterEval" was computed for fenAfter (which equals fenBefore of current).
      // Score is from STM perspective in raw output, but we converted it to white-perspective.
      // We need to reconstruct white-perspective for the "before" too.
      beforeRaw = {
        scoreCp: 0, bestMoveUci: prevAfterEval.bestUci, pvUci: prevAfterEval.pvUci, isMate: prevAfterEval.isMate,
      }
      beforeRaw.scoreCp = prevAfterEval.scoreCpWhite // already white-perspective, used directly below
    } else {
      const r = await engine.evaluate(move.fenBefore, depth, movetimeMs)
      beforeRaw = { scoreCp: toWhitePerspective(r.scoreCp, move.fenBefore), bestMoveUci: r.bestMoveUci, pvUci: r.pvUci, isMate: r.isMate }
    }

    const afterRaw = await engine.evaluate(move.fenAfter, depth, movetimeMs)
    const afterScoreWhite = toWhitePerspective(afterRaw.scoreCp, move.fenAfter)

    const evalBeforeWhite = beforeRaw.scoreCp
    const evalAfterWhite = afterScoreWhite

    // CP loss from the mover's perspective: how much did the mover's eval drop?
    // Clamp to ±1000 cp so that mate scores (±99 000+) don't blow up the average:
    // missing a forced mate counts as a ~1000 cp swing, not a 99 000 cp one.
    const stm = move.fenBefore.split(' ')[1] // 'w' or 'b' — side to move
    const sign = stm === 'w' ? 1 : -1
    const moverEvalBefore = clampCp(sign * evalBeforeWhite)
    const moverEvalAfter = clampCp(sign * evalAfterWhite)
    const cpLoss = Math.max(0, moverEvalBefore - moverEvalAfter)

    // Best move check
    const bestUciFromBefore = beforeRaw.bestMoveUci
    const playedUci = move.uci
    const isBest = !!bestUciFromBefore && bestUciFromBefore === playedUci
    const isBook = i < bookPlies

    const bestMoveSan = bestUciFromBefore ? uciToSan(move.fenBefore, bestUciFromBefore) : undefined
    const bestLineSan = beforeRaw.pvUci?.length ? pvToSan(move.fenBefore, beforeRaw.pvUci) : undefined

    const classification = classifyByCpLoss(cpLoss, isBest, isBook)

    analyses.push({
      ply: move.ply,
      san: move.san,
      fenBefore: move.fenBefore,
      fenAfter: move.fenAfter,
      evalBefore: evalBeforeWhite,
      evalAfter: evalAfterWhite,
      bestMoveSan,
      bestLineSan,
      classification,
      cpLoss,
      isMate: beforeRaw.isMate || afterRaw.isMate,
    })

    prevAfterEval = {
      scoreCpWhite: afterScoreWhite,
      bestUci: afterRaw.bestMoveUci,
      pvUci: afterRaw.pvUci,
      isMate: afterRaw.isMate,
    }
  }
  onProgress?.({ done: moves.length, total: moves.length })

  return {
    pgn: game.pgn,
    moves: analyses,
    userColor,
    opening: headers.opening,
    ecoCode: headers.eco,
    result,
    opponent,
    opponentRating,
    userRating,
    endTime: game.end_time,
    timeClass: game.time_class,
    url: game.url,
  }
}
