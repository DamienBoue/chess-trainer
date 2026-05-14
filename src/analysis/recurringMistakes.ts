// Detect recurring mistakes across the user's games.
//
// Two heuristics, both surfaced separately:
//   1. Exact-position recurrence: the user played the SAME wrong move from
//      the SAME position in ≥2 different games. The most actionable signal —
//      it's a memorised reflex that needs unlearning.
//   2. Opening-shape recurrence: same wrong move SAN in the SAME parent
//      opening across ≥2 games. Looser but catches "you blunder f7 against
//      the Italian over and over".

import type { GameAnalysis } from '../types'
import { getParentOpening } from './openings'
import { positionKey } from '../utils/move'

export interface RecurringMistake {
  kind: 'exact-position' | 'same-opening'
  /** Stable identifier for React keying. */
  id: string
  positionKey: string         // truncated FEN ("placement stm castling enpass")
  sanPlayed: string
  bestSan?: string
  occurrences: Array<{
    gameUrl: string
    opponent: string
    endTime: number
    ply: number
    cpLoss: number
    opening: string
  }>
  totalCpLost: number
  parentOpening?: string      // populated only for 'same-opening' clusters
}

const MIN_CP_LOSS = 100   // ignore tiny errors

export function findRecurringMistakes(analyses: GameAnalysis[]): {
  exact: RecurringMistake[]
  byOpening: RecurringMistake[]
} {
  // Bucket every user blunder/mistake by both keys.
  // Opening clusters also keep a sample FEN so the explorer has something
  // concrete to display — picks the most-recent occurrence at flush time.
  const exactBuckets = new Map<string, RecurringMistake['occurrences'][number][] & { _san: string; _best?: string; _fen: string }>()
  const openingBuckets = new Map<string, RecurringMistake['occurrences'][number][] & { _san: string; _best?: string; _opening: string; _sampleFen?: string; _sampleEndTime?: number }>()

  for (const game of analyses) {
    const userIsWhite = game.userColor === 'white'
    for (const move of game.moves) {
      const moverIsWhite = move.ply % 2 === 1
      if (moverIsWhite !== userIsWhite) continue
      if (move.classification !== 'blunder' && move.classification !== 'mistake') continue
      if (move.cpLoss < MIN_CP_LOSS) continue
      if (!move.fenBefore) continue
      const parent = getParentOpening(game.ecoCode, game.opening)
      const occ: RecurringMistake['occurrences'][number] = {
        gameUrl: game.url,
        opponent: game.opponent,
        endTime: game.endTime,
        ply: move.ply,
        cpLoss: move.cpLoss,
        opening: parent,
      }
      // Exact-position bucket
      const pk = positionKey(move.fenBefore)
      const ek = `${pk}||${move.san}`
      let arr = exactBuckets.get(ek)
      if (!arr) {
        arr = Object.assign([] as RecurringMistake['occurrences'][number][], {
          _san: move.san, _best: move.bestMoveSan, _fen: move.fenBefore,
        })
        exactBuckets.set(ek, arr)
      }
      arr.push(occ)
      // Opening + SAN bucket — also remember the most-recent FEN sample so
      // the panel can open something in the explorer.
      const ok = `${parent}||${move.san}`
      let oarr = openingBuckets.get(ok)
      if (!oarr) {
        oarr = Object.assign([] as RecurringMistake['occurrences'][number][], {
          _san: move.san, _best: move.bestMoveSan, _opening: parent,
          _sampleFen: move.fenBefore, _sampleEndTime: game.endTime,
        })
        openingBuckets.set(ok, oarr)
      } else if (!oarr._sampleEndTime || game.endTime > oarr._sampleEndTime) {
        oarr._sampleFen = move.fenBefore
        oarr._sampleEndTime = game.endTime
      }
      oarr.push(occ)
    }
  }

  function build(
    buckets: typeof exactBuckets | typeof openingBuckets,
    kind: 'exact-position' | 'same-opening',
  ): RecurringMistake[] {
    const out: RecurringMistake[] = []
    for (const [key, arr] of buckets) {
      // Need ≥2 occurrences AND from ≥2 distinct games.
      const distinctGames = new Set(arr.map(o => o.gameUrl)).size
      if (distinctGames < 2) continue
      const occurrences = [...arr].sort((a, b) => b.endTime - a.endTime)
      const m = arr as unknown as { _san: string; _best?: string; _fen?: string; _sampleFen?: string; _opening?: string }
      out.push({
        kind,
        id: kind + ':' + key,
        positionKey: m._fen ?? m._sampleFen ?? '',
        sanPlayed: m._san,
        bestSan: m._best,
        parentOpening: m._opening,
        occurrences,
        totalCpLost: occurrences.reduce((s, o) => s + o.cpLoss, 0),
      })
    }
    // Highest cumulative cp loss first — it's a proxy for "this hurts the most".
    return out.sort((a, b) => b.totalCpLost - a.totalCpLost)
  }

  return {
    exact: build(exactBuckets, 'exact-position'),
    byOpening: build(openingBuckets, 'same-opening'),
  }
}
