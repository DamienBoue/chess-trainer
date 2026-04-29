import type { Color, GameAnalysis, MoveAnalysis } from '../types'

export type ExerciseCategory = 'missed' | 'punishment' | 'defense'

export interface Exercise {
  id: string
  category: ExerciseCategory
  fen: string                  // position to solve from
  userColor: Color             // orient the board this way
  sideToMove: 'w' | 'b'
  bestMoveSan: string          // expected solution
  bestLineSan?: string         // continuation, displayed after solving
  playedMoveSan: string        // what was actually played in the real game
  playedClassification: MoveAnalysis['classification']
  cpSwing: number              // magnitude (cps) of the impact
  evalBeforeWhite: number
  evalAfterPlayedWhite: number
  context: {
    gameUrl: string
    opponent: string
    ply: number
    moveLabel: string          // "12." or "12..."
    endTime: number
    opening?: string
  }
}

// User's "perspective" eval (positive = good for user)
function userEval(scoreWhite: number, color: Color): number {
  return color === 'white' ? scoreWhite : -scoreWhite
}

// Build a stable, human-readable move label like "14." or "14..."
function moveLabel(ply: number): string {
  const num = Math.ceil(ply / 2)
  return ply % 2 === 1 ? `${num}.` : `${num}...`
}

export interface ExtractOptions {
  // Minimum cp loss for a missed exercise (to avoid trivia)
  minMissedCpLoss?: number
  // Minimum cp loss of opponent's preceding move to qualify a punishment
  minOpponentCpLoss?: number
  // Threshold (in cp from user's perspective) below which a position counts as "defensive"
  defenseEvalCeiling?: number
  // Max exercises per game (prevents one disaster game from dominating)
  maxPerGame?: number
}

export function extractExercises(
  analyses: GameAnalysis[],
  opts: ExtractOptions = {},
): Exercise[] {
  const {
    minMissedCpLoss = 120,
    minOpponentCpLoss = 150,
    defenseEvalCeiling = -200,
    maxPerGame = 6,
  } = opts

  const all: Exercise[] = []
  for (const game of analyses) {
    const fromGame: Exercise[] = []
    for (let i = 0; i < game.moves.length; i++) {
      const move = game.moves[i]
      const moverIsWhite = move.ply % 2 === 1
      const isUser = (game.userColor === 'white') === moverIsWhite
      if (!isUser) continue
      if (!move.bestMoveSan) continue

      const ctx = {
        gameUrl: game.url,
        opponent: game.opponent,
        ply: move.ply,
        moveLabel: moveLabel(move.ply),
        endTime: game.endTime,
        opening: game.opening,
      }

      // 1) Missed: user blundered/mistook, best move existed and was different
      if (
        (move.classification === 'mistake' || move.classification === 'blunder')
        && move.cpLoss >= minMissedCpLoss
        && move.bestMoveSan !== move.san
      ) {
        fromGame.push({
          id: `${game.url}#${move.ply}-missed`,
          category: 'missed',
          fen: move.fenBefore,
          userColor: game.userColor,
          sideToMove: moverIsWhite ? 'w' : 'b',
          bestMoveSan: move.bestMoveSan,
          bestLineSan: move.bestLineSan,
          playedMoveSan: move.san,
          playedClassification: move.classification,
          cpSwing: move.cpLoss,
          evalBeforeWhite: move.evalBefore,
          evalAfterPlayedWhite: move.evalAfter,
          context: ctx,
        })
        continue
      }

      // 2) Punishment: user found best move right after opponent's mistake/blunder
      const prev = i > 0 ? game.moves[i - 1] : null
      if (
        prev
        && (prev.classification === 'mistake' || prev.classification === 'blunder')
        && prev.cpLoss >= minOpponentCpLoss
        && (move.classification === 'best' || move.classification === 'great')
      ) {
        fromGame.push({
          id: `${game.url}#${move.ply}-punishment`,
          category: 'punishment',
          fen: move.fenBefore,
          userColor: game.userColor,
          sideToMove: moverIsWhite ? 'w' : 'b',
          bestMoveSan: move.bestMoveSan,
          bestLineSan: move.bestLineSan,
          playedMoveSan: move.san,
          playedClassification: move.classification,
          cpSwing: prev.cpLoss,
          evalBeforeWhite: move.evalBefore,
          evalAfterPlayedWhite: move.evalAfter,
          context: ctx,
        })
        continue
      }

      // 3) Defense: user is in a losing position and played the best move
      const userEvalBefore = userEval(move.evalBefore, game.userColor)
      if (
        userEvalBefore <= defenseEvalCeiling
        && (move.classification === 'best' || move.classification === 'great')
      ) {
        fromGame.push({
          id: `${game.url}#${move.ply}-defense`,
          category: 'defense',
          fen: move.fenBefore,
          userColor: game.userColor,
          sideToMove: moverIsWhite ? 'w' : 'b',
          bestMoveSan: move.bestMoveSan,
          bestLineSan: move.bestLineSan,
          playedMoveSan: move.san,
          playedClassification: move.classification,
          cpSwing: Math.abs(userEvalBefore),
          evalBeforeWhite: move.evalBefore,
          evalAfterPlayedWhite: move.evalAfter,
          context: ctx,
        })
        continue
      }
    }

    // Cap per game by largest cpSwing
    fromGame.sort((a, b) => b.cpSwing - a.cpSwing)
    all.push(...fromGame.slice(0, maxPerGame))
  }

  // Stable global ordering: most recent games first, then biggest swings
  all.sort((a, b) => {
    if (b.context.endTime !== a.context.endTime) return b.context.endTime - a.context.endTime
    return b.cpSwing - a.cpSwing
  })
  return all
}

export const CATEGORY_LABELS: Record<ExerciseCategory, string> = {
  missed: 'Coup raté',
  punishment: 'Punition trouvée',
  defense: 'Défense trouvée',
}

export const CATEGORY_DESCRIPTIONS: Record<ExerciseCategory, string> = {
  missed: 'Tu as joué une erreur ou une gaffe ici. Quel était le bon coup ?',
  punishment: 'Ton adversaire vient de commettre une erreur. Trouve le coup qui exploite la faiblesse.',
  defense: 'Position difficile. Trouve la meilleure défense.',
}

export const CATEGORY_COLORS: Record<ExerciseCategory, string> = {
  missed: '#e08e3c',
  punishment: '#5fa052',
  defense: '#4a90d0',
}
