import type { GameAnalysis, MoveAnalysis } from '../types'
import { findDeviation, type RepertoireRoot } from './repertoire'

// Build a one-paragraph plain-text summary of a single analysed game.
// Designed to be readable at a glance without specialised chess vocabulary.
export function generateGameSummary(a: GameAnalysis, repertoireRoots?: RepertoireRoot[]): string {
  const sentences: string[] = []

  // Opening
  if (a.opening) sentences.push(`Ouverture : ${a.opening}.`)

  // Result line
  const resultWord = a.result === 'win' ? 'Victoire' : a.result === 'loss' ? 'Défaite' : 'Nulle'
  const oppRatingPart = a.opponentRating ? ` (${a.opponentRating})` : ''
  sentences.push(`${resultWord} contre ${a.opponent}${oppRatingPart}.`)

  // Accuracy
  let userCp = 0, userN = 0, oppCp = 0, oppN = 0
  const userBlunders: MoveAnalysis[] = []
  const userMistakes: MoveAnalysis[] = []
  const userIsWhite = a.userColor === 'white'
  for (const mv of a.moves) {
    const isUser = ((mv.ply % 2 === 1)) === userIsWhite
    if (isUser) {
      userN++; userCp += mv.cpLoss
      if (mv.classification === 'blunder') userBlunders.push(mv)
      else if (mv.classification === 'mistake') userMistakes.push(mv)
    } else {
      oppN++; oppCp += mv.cpLoss
    }
  }
  const userAvg = userN ? userCp / userN : 0
  const oppAvg = oppN ? oppCp / oppN : 0
  const accuracyDescriptor = userAvg < 30 ? 'excellente' : userAvg < 60 ? 'solide' : userAvg < 100 ? 'correcte' : 'à améliorer'
  sentences.push(`Précision ${accuracyDescriptor} (${userAvg.toFixed(0)} cp/coup vs ${oppAvg.toFixed(0)} pour l'adversaire).`)

  // Pivotal moment
  if (userBlunders.length === 0 && userMistakes.length === 0) {
    sentences.push('Pas d\'erreur grave de ta part.')
  } else if (userBlunders.length > 0) {
    const worst = userBlunders.reduce((a, b) => (a.cpLoss >= b.cpLoss ? a : b))
    const moveNum = Math.ceil(worst.ply / 2)
    const dots = worst.ply % 2 === 1 ? '.' : '...'
    sentences.push(
      `Coup-pivot : ${moveNum}${dots} ${worst.san} (${worst.cpLoss} cp perdus`
      + (worst.bestMoveSan && worst.bestMoveSan !== worst.san ? `, le meilleur était ${worst.bestMoveSan}).` : ').'),
    )
  } else if (userMistakes.length > 0) {
    const worst = userMistakes.reduce((a, b) => (a.cpLoss >= b.cpLoss ? a : b))
    const moveNum = Math.ceil(worst.ply / 2)
    const dots = worst.ply % 2 === 1 ? '.' : '...'
    sentences.push(`${userMistakes.length} erreur${userMistakes.length > 1 ? 's' : ''}, la pire au coup ${moveNum}${dots} ${worst.san} (${worst.cpLoss} cp).`)
  }

  // Repertoire deviation
  if (repertoireRoots && repertoireRoots.length > 0) {
    const dev = findDeviation(a, repertoireRoots)
    if (dev) {
      const moveNum = Math.ceil(dev.ply / 2)
      const dots = dev.ply % 2 === 1 ? '.' : '...'
      sentences.push(
        `Déviation du répertoire au coup ${moveNum}${dots} : tu joues d'habitude ${dev.expected} (${dev.expectedFrequency}/${dev.alternativesCount}), là tu as joué ${dev.played}.`
      )
    }
  }

  // Phase repartition
  const totalPlies = a.moves.length
  let opP = 0, midP = 0, endP = 0
  for (const mv of [...userBlunders, ...userMistakes]) {
    if (mv.ply <= 20) opP++
    else if (mv.ply >= totalPlies - 20) endP++
    else midP++
  }
  const totalP = opP + midP + endP
  if (totalP >= 2) {
    const worstPhase = opP >= midP && opP >= endP ? 'ouverture'
      : endP >= midP ? 'finale'
      : 'milieu de jeu'
    sentences.push(`Phase la plus problématique : ${worstPhase}.`)
  }

  return sentences.join(' ')
}

/** Errors and average loss of each side (the analysis summary). */
export function summarizeMoves(a: GameAnalysis) {
  const userIsWhite = a.userColor === 'white'
  const counters = {
    user: { blunders: 0, mistakes: 0, inaccuracies: 0, cpLossSum: 0, moves: 0, avgCpLoss: 0 },
    opp: { blunders: 0, mistakes: 0, inaccuracies: 0, cpLossSum: 0, moves: 0, avgCpLoss: 0 },
  }
  for (const m of a.moves) {
    const moverIsWhite = m.ply % 2 === 1
    const bucket = moverIsWhite === userIsWhite ? counters.user : counters.opp
    bucket.moves++
    bucket.cpLossSum += m.cpLoss
    if (m.classification === 'blunder') bucket.blunders++
    else if (m.classification === 'mistake') bucket.mistakes++
    else if (m.classification === 'inaccuracy') bucket.inaccuracies++
  }
  counters.user.avgCpLoss = counters.user.moves ? counters.user.cpLossSum / counters.user.moves : 0
  counters.opp.avgCpLoss = counters.opp.moves ? counters.opp.cpLossSum / counters.opp.moves : 0
  return counters
}
