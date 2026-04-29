import type { GameAnalysis } from '../types'
import { getParentOpening } from './openings'

export interface StudyRecommendation {
  kind: 'opening-early-loss' | 'phase-weakness' | 'opening-low-winrate'
  title: string
  detail: string
  priority: number   // higher = more urgent
}

// Build a short list of study targets from the analysed games.
export function buildRecommendations(analyses: GameAnalysis[]): StudyRecommendation[] {
  if (analyses.length < 3) return []

  const recs: StudyRecommendation[] = []

  // 1. Openings where user blunders early (within first 16 plies = move 8)
  // and has at least 2 such games.
  const earlyBlundersByOpening = new Map<string, { count: number; total: number; games: number }>()
  for (const g of analyses) {
    const parent = getParentOpening(g.ecoCode, g.opening)
    const userIsWhite = g.userColor === 'white'
    const earlyBlundered = g.moves.some(mv => {
      const isUser = (mv.ply % 2 === 1) === userIsWhite
      return isUser && mv.ply <= 16 && (mv.classification === 'mistake' || mv.classification === 'blunder')
    })
    const cur = earlyBlundersByOpening.get(parent) ?? { count: 0, total: 0, games: 0 }
    cur.games++
    if (earlyBlundered) cur.count++
    earlyBlundersByOpening.set(parent, cur)
  }
  for (const [opening, { count, games }] of earlyBlundersByOpening) {
    if (games >= 3 && count / games >= 0.4 && count >= 2) {
      recs.push({
        kind: 'opening-early-loss',
        title: `Théorie d'ouverture : ${opening}`,
        detail: `Tu commets une erreur ou gaffe dans les 8 premiers coups dans ${count}/${games} parties. Étudie les plans typiques.`,
        priority: count * 10,
      })
    }
  }

  // 2. Phase weakness — only if a phase concentrates >=60% of mistakes.
  const phaseTotals = { opening: 0, middlegame: 0, endgame: 0 }
  for (const g of analyses) {
    const userIsWhite = g.userColor === 'white'
    const totalPlies = g.moves.length
    for (const mv of g.moves) {
      const isUser = (mv.ply % 2 === 1) === userIsWhite
      if (!isUser) continue
      if (mv.classification !== 'mistake' && mv.classification !== 'blunder') continue
      const phase: keyof typeof phaseTotals = mv.ply <= 20 ? 'opening' : (mv.ply >= totalPlies - 20 ? 'endgame' : 'middlegame')
      phaseTotals[phase]++
    }
  }
  const total = phaseTotals.opening + phaseTotals.middlegame + phaseTotals.endgame
  if (total >= 5) {
    const dominant = (Object.entries(phaseTotals) as Array<[keyof typeof phaseTotals, number]>)
      .reduce((a, b) => a[1] >= b[1] ? a : b)
    if (dominant[1] / total >= 0.55) {
      const labels = { opening: 'ouverture', middlegame: 'milieu de jeu', endgame: 'finale' }
      recs.push({
        kind: 'phase-weakness',
        title: `Travailler la ${labels[dominant[0]]}`,
        detail: `${dominant[1]} de tes ${total} erreurs/gaffes (${(dominant[1] / total * 100).toFixed(0)}%) sont en ${labels[dominant[0]]}. Une étude ciblée aurait un gros impact.`,
        priority: dominant[1] * 8,
      })
    }
  }

  // 3. Openings with terrible winrate (≤25% sur 4+ parties)
  const winByOpening = new Map<string, { w: number; l: number; d: number }>()
  for (const g of analyses) {
    const parent = getParentOpening(g.ecoCode, g.opening)
    const cur = winByOpening.get(parent) ?? { w: 0, l: 0, d: 0 }
    if (g.result === 'win') cur.w++
    else if (g.result === 'loss') cur.l++
    else cur.d++
    winByOpening.set(parent, cur)
  }
  for (const [opening, r] of winByOpening) {
    const games = r.w + r.l + r.d
    const score = (r.w + r.d * 0.5) / games
    if (games >= 4 && score <= 0.30) {
      recs.push({
        kind: 'opening-low-winrate',
        title: `Score faible avec ${opening}`,
        detail: `Tu marques ${(score * 100).toFixed(0)}% sur ${games} parties (${r.w}V / ${r.l}D / ${r.d}N). Considère un autre système ou approfondis cette ligne.`,
        priority: 5 * games,
      })
    }
  }

  return recs.sort((a, b) => b.priority - a.priority)
}
