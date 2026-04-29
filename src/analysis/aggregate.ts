import type { GameAnalysis, MoveClassification } from '../types'
import { getParentOpening } from './openings'

export interface OpeningStat {
  name: string
  ecoCode?: string
  played: number
  wins: number
  losses: number
  draws: number
}

export interface OpeningGroup extends OpeningStat {
  // Variations grouped under this parent opening, sorted by played desc.
  variations: OpeningStat[]
}

export interface PhaseMistakes {
  opening: number
  middlegame: number
  endgame: number
}

export interface AggregateStats {
  gamesAnalyzed: number
  totalMoves: number
  byClass: Record<MoveClassification, number>
  avgCpLossUser: number
  avgCpLossOpponent: number
  blundersByPhase: PhaseMistakes
  mistakesByPhase: PhaseMistakes
  inaccuraciesByPhase: PhaseMistakes
  openings: OpeningStat[]              // flat (legacy)
  openingGroups: OpeningGroup[]         // grouped by parent
  resultsByColor: { white: { w: number; l: number; d: number }; black: { w: number; l: number; d: number } }
}

function classifyPhase(ply: number, totalPlies: number): keyof PhaseMistakes {
  if (ply <= 20) return 'opening'
  if (ply >= totalPlies - 20) return 'endgame'
  return 'middlegame'
}

export function aggregate(analyses: GameAnalysis[]): AggregateStats {
  const stats: AggregateStats = {
    gamesAnalyzed: analyses.length,
    totalMoves: 0,
    byClass: { best: 0, great: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 0, book: 0 },
    avgCpLossUser: 0,
    avgCpLossOpponent: 0,
    blundersByPhase: { opening: 0, middlegame: 0, endgame: 0 },
    mistakesByPhase: { opening: 0, middlegame: 0, endgame: 0 },
    inaccuraciesByPhase: { opening: 0, middlegame: 0, endgame: 0 },
    openings: [],
    openingGroups: [],
    resultsByColor: { white: { w: 0, l: 0, d: 0 }, black: { w: 0, l: 0, d: 0 } },
  }

  let userMoves = 0
  let userCpLossSum = 0
  let oppMoves = 0
  let oppCpLossSum = 0
  const openings = new Map<string, OpeningStat>()
  // parent name -> { totals, variations: Map<variationName, stat> }
  const groups = new Map<string, { stat: OpeningStat; variations: Map<string, OpeningStat> }>()

  for (const game of analyses) {
    const userIsWhite = game.userColor === 'white'
    const colorBucket = stats.resultsByColor[game.userColor]
    if (game.result === 'win') colorBucket.w++
    else if (game.result === 'loss') colorBucket.l++
    else colorBucket.d++

    const totalPlies = game.moves.length
    for (const mv of game.moves) {
      stats.totalMoves++
      stats.byClass[mv.classification]++
      const moverIsWhite = mv.ply % 2 === 1
      const isUser = moverIsWhite === userIsWhite
      if (isUser) {
        userMoves++
        userCpLossSum += mv.cpLoss
        const phase = classifyPhase(mv.ply, totalPlies)
        if (mv.classification === 'blunder') stats.blundersByPhase[phase]++
        else if (mv.classification === 'mistake') stats.mistakesByPhase[phase]++
        else if (mv.classification === 'inaccuracy') stats.inaccuraciesByPhase[phase]++
      } else {
        oppMoves++
        oppCpLossSum += mv.cpLoss
      }
    }

    const variationName = (game.opening || game.ecoCode || 'Inconnue').trim()
    const parentName = getParentOpening(game.ecoCode, game.opening)

    // Flat (legacy) bucket
    if (!openings.has(variationName)) {
      openings.set(variationName, {
        name: variationName,
        ecoCode: game.ecoCode,
        played: 0, wins: 0, losses: 0, draws: 0,
      })
    }
    const o = openings.get(variationName)!
    o.played++
    if (game.result === 'win') o.wins++
    else if (game.result === 'loss') o.losses++
    else o.draws++

    // Grouped bucket
    if (!groups.has(parentName)) {
      groups.set(parentName, {
        stat: { name: parentName, played: 0, wins: 0, losses: 0, draws: 0 },
        variations: new Map(),
      })
    }
    const g = groups.get(parentName)!
    g.stat.played++
    if (game.result === 'win') g.stat.wins++
    else if (game.result === 'loss') g.stat.losses++
    else g.stat.draws++

    if (!g.variations.has(variationName)) {
      g.variations.set(variationName, {
        name: variationName,
        ecoCode: game.ecoCode,
        played: 0, wins: 0, losses: 0, draws: 0,
      })
    }
    const v = g.variations.get(variationName)!
    v.played++
    if (game.result === 'win') v.wins++
    else if (game.result === 'loss') v.losses++
    else v.draws++
  }

  stats.avgCpLossUser = userMoves ? userCpLossSum / userMoves : 0
  stats.avgCpLossOpponent = oppMoves ? oppCpLossSum / oppMoves : 0
  stats.openings = Array.from(openings.values()).sort((a, b) => b.played - a.played)
  stats.openingGroups = Array.from(groups.values())
    .map(g => ({
      ...g.stat,
      variations: Array.from(g.variations.values()).sort((a, b) => b.played - a.played),
    }))
    .sort((a, b) => b.played - a.played)
  return stats
}

export interface InsightLine {
  kind: 'strength' | 'weakness' | 'fact'
  text: string
}

export function deriveInsights(stats: AggregateStats): InsightLine[] {
  const lines: InsightLine[] = []
  if (stats.gamesAnalyzed === 0) return lines

  const userBlunders = stats.blundersByPhase.opening + stats.blundersByPhase.middlegame + stats.blundersByPhase.endgame
  const userMistakes = stats.mistakesByPhase.opening + stats.mistakesByPhase.middlegame + stats.mistakesByPhase.endgame

  // CP loss comparison
  if (stats.avgCpLossUser < stats.avgCpLossOpponent - 5) {
    lines.push({ kind: 'strength', text: `Précision supérieure à l'adversaire (${stats.avgCpLossUser.toFixed(0)} vs ${stats.avgCpLossOpponent.toFixed(0)} cp/coup).` })
  } else if (stats.avgCpLossUser > stats.avgCpLossOpponent + 5) {
    lines.push({ kind: 'weakness', text: `Tu perds plus de centipawns par coup que l'adversaire en moyenne (${stats.avgCpLossUser.toFixed(0)} vs ${stats.avgCpLossOpponent.toFixed(0)}).` })
  }

  // Phase distribution
  const phases: Array<keyof PhaseMistakes> = ['opening', 'middlegame', 'endgame']
  const phaseLabels: Record<keyof PhaseMistakes, string> = { opening: 'ouverture', middlegame: 'milieu de jeu', endgame: 'finale' }
  const worstPhase = phases.reduce((a, b) =>
    (stats.blundersByPhase[a] + stats.mistakesByPhase[a]) >= (stats.blundersByPhase[b] + stats.mistakesByPhase[b]) ? a : b
  )
  const worstCount = stats.blundersByPhase[worstPhase] + stats.mistakesByPhase[worstPhase]
  if (worstCount > 0 && stats.gamesAnalyzed >= 2) {
    lines.push({ kind: 'weakness', text: `Phase la plus faible : ${phaseLabels[worstPhase]} (${worstCount} erreurs/gaffes au total).` })
  }

  // Best opening (use parent groups so the heuristic talks about families,
  // not specific subvariations)
  const bestOpening = stats.openingGroups.find(o => o.played >= 2)
  if (bestOpening) {
    const winRate = bestOpening.wins / bestOpening.played
    if (winRate >= 0.6) {
      lines.push({ kind: 'strength', text: `Bon score avec ${bestOpening.name} (${bestOpening.wins}/${bestOpening.played}).` })
    } else if (winRate <= 0.3 && bestOpening.played >= 3) {
      lines.push({ kind: 'weakness', text: `Score faible avec ${bestOpening.name} (${bestOpening.wins}/${bestOpening.played}). Étudier des plans alternatifs.` })
    }
  }

  // Counts
  lines.push({ kind: 'fact', text: `${userBlunders} gaffe(s), ${userMistakes} erreur(s) sur ${stats.gamesAnalyzed} partie(s) analysée(s).` })

  // Color bias
  const w = stats.resultsByColor.white
  const b = stats.resultsByColor.black
  const wPlayed = w.w + w.l + w.d
  const bPlayed = b.w + b.l + b.d
  if (wPlayed >= 2 && bPlayed >= 2) {
    const wRate = w.w / wPlayed
    const bRate = b.w / bPlayed
    if (Math.abs(wRate - bRate) >= 0.25) {
      const better = wRate > bRate ? 'Blancs' : 'Noirs'
      lines.push({ kind: 'fact', text: `Tu joues mieux avec les ${better} (${(Math.max(wRate, bRate) * 100).toFixed(0)}% vs ${(Math.min(wRate, bRate) * 100).toFixed(0)}%).` })
    }
  }

  return lines
}
