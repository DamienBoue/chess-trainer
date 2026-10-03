// Strategic profile across all analysed games: in which structures and
// which kinds of centre the player scores badly or bleeds centipawns,
// which structural concessions keep coming back, and which kinds of
// plans he keeps missing. The headline findings are phrased as training
// advice.

import type { GameAnalysis } from '../types'
import type { Side } from './board'
import { CENTER_LABELS, type CenterType } from './center'
import { type GameEventKind, type GameStrategyReview, reviewGameStrategy } from './game'
import type { PlanKind } from './plans'
import { STRUCTURES } from './structures'

export interface StructureStat {
  id: string
  name: string
  conceptId?: string
  /** The user's role in the structure ("A" = the side the pattern is written for). */
  role: 'A' | 'B'
  roleLabel: string
  games: number
  wins: number
  draws: number
  losses: number
  /** (wins + draws / 2) / games */
  score: number
  /** Average cp lost per user move while the structure was on the board. */
  avgCpLoss: number
  moves: number
  gameUrls: string[]
}

export interface CenterStat {
  type: CenterType
  label: string
  moves: number
  avgCpLoss: number
}

export interface HabitStat {
  kind: GameEventKind
  label: string
  conceptId?: string
  /** Times the user did it. */
  count: number
  /** …of which the engine judged costly (≥ 50 cp). */
  costly: number
  /** Times the opponents did it, for comparison. */
  oppCount: number
}

export interface MissedPlanStat {
  kind: PlanKind
  label: string
  conceptId?: string
  count: number
  totalCp: number
  examples: { url: string; ply: number; title: string }[]
}

export interface StrategyProfile {
  games: number
  structures: StructureStat[]
  centers: CenterStat[]
  habits: HabitStat[]
  missed: MissedPlanStat[]
  /** Headline findings, most important first. */
  headlines: string[]
  /** User moves considered (opening book moves excluded). */
  moves: number
  avgCpLoss: number
}

const HABIT_LABELS: Partial<Record<GameEventKind, { label: string; conceptId: string }>> = {
  isolated: { label: 'Pions isolés créés', conceptId: 'isolated-pawn' },
  doubled: { label: 'Pions doublés', conceptId: 'doubled-pawns' },
  backward: { label: 'Pions arriérés créés', conceptId: 'backward-pawn' },
  holes: { label: 'Cases faibles créées', conceptId: 'weak-square' },
  'king-shelter': { label: 'Abri du roi affaibli', conceptId: 'king-safety' },
  'bishop-pair': { label: 'Paire de fous cédée', conceptId: 'bishop-pair' },
  'passed-allowed': { label: 'Pions passés concédés', conceptId: 'blockade' },
}

const PLAN_LABELS: Partial<Record<PlanKind, { label: string; conceptId: string }>> = {
  'central-break': { label: 'Ruptures centrales', conceptId: 'pawn-break' },
  'wing-play': { label: 'Jeu sur l\'aile (centre fermé)', conceptId: 'pawn-chain' },
  'minority-attack': { label: 'Attaque de minorité', conceptId: 'minority-attack' },
  majority: { label: 'Majorités de pions', conceptId: 'pawn-majority' },
  'passed-pawn': { label: 'Poussée du pion passé', conceptId: 'passed-pawn' },
  blockade: { label: 'Blocus des pions passés', conceptId: 'blockade' },
  outpost: { label: 'Avant-postes', conceptId: 'outpost' },
  'weak-pawn': { label: 'Attaque des pions faibles', conceptId: 'backward-pawn' },
  'open-file': { label: 'Colonnes ouvertes', conceptId: 'open-file' },
  'seventh-rank': { label: 'Tour en 7e', conceptId: 'rook-seventh' },
  'pawn-storm': { label: 'Tempêtes de pions', conceptId: 'pawn-storm' },
  'open-center': { label: 'Ouvrir le centre contre un roi exposé', conceptId: 'initiative' },
  structure: { label: 'Plans types de la structure', conceptId: 'pawn-structure' },
  'king-activity': { label: 'Activité du roi en finale', conceptId: 'king-activity' },
  castle: { label: 'Roque / sécurité du roi', conceptId: 'castling' },
  development: { label: 'Développement', conceptId: 'development' },
  'bishop-pair': { label: 'Jeu avec la paire de fous', conceptId: 'bishop-pair' },
  'bad-bishop': { label: 'Amélioration du mauvais fou', conceptId: 'bad-bishop' },
}

export function buildStrategyProfile(
  analyses: GameAnalysis[],
  review: (a: GameAnalysis) => GameStrategyReview = reviewGameStrategy,
): StrategyProfile {
  const structures = new Map<string, StructureStat & { cpSum: number }>()
  const centers = new Map<CenterType, { moves: number; cpSum: number }>()
  const habits = new Map<GameEventKind, HabitStat>()
  const missed = new Map<PlanKind, MissedPlanStat>()
  let moves = 0, cpSum = 0

  for (const a of analyses) {
    if (a.moves.length === 0) continue
    let r: GameStrategyReview
    try { r = review(a) } catch { continue }
    const userSide: Side = a.userColor === 'white' ? 'w' : 'b'
    const isUserPly = (ply: number) => (ply % 2 === 1) === (userSide === 'w')
    const userMoves = a.moves.filter(m => isUserPly(m.ply) && m.classification !== 'book')
    for (const m of userMoves) { moves++; cpSum += Math.min(m.cpLoss, 1000) }

    // Centre type of the position in which each user move was played.
    const centerAt = (ply: number) => r.centers.find(c => ply >= c.fromPly && ply <= c.toPly)?.type
    for (const m of userMoves) {
      const t = centerAt(m.ply - 1)
      if (!t) continue
      const c = centers.get(t) ?? { moves: 0, cpSum: 0 }
      c.moves++; c.cpSum += Math.min(m.cpLoss, 1000)
      centers.set(t, c)
    }

    // Structures (one entry per game, per structure and role).
    const seen = new Set<string>()
    for (const sg of r.structures) {
      const role: 'A' | 'B' = sg.sideA === userSide ? 'A' : 'B'
      const key = `${sg.id}:${role}`
      const pattern = STRUCTURES.find(p => p.id === sg.id)
      const st = structures.get(key) ?? {
        id: sg.id, name: sg.name, conceptId: sg.conceptId, role,
        roleLabel: pattern ? (role === 'A' ? pattern.aRole : pattern.bRole) : '',
        games: 0, wins: 0, draws: 0, losses: 0, score: 0, avgCpLoss: 0, moves: 0, gameUrls: [], cpSum: 0,
      }
      for (const m of userMoves) {
        if (m.ply < sg.fromPly || m.ply > sg.toPly) continue
        st.moves++; st.cpSum += Math.min(m.cpLoss, 1000)
      }
      if (!seen.has(key)) {
        seen.add(key)
        st.games++
        if (a.result === 'win') st.wins++
        else if (a.result === 'loss') st.losses++
        else st.draws++
        st.gameUrls.push(a.url)
      }
      structures.set(key, st)
    }

    // Habits and missed plans.
    for (const e of r.events) {
      if (e.kind === 'missed-plan') {
        if (e.side !== userSide || !e.planKind) continue
        const meta = PLAN_LABELS[e.planKind]
        const st = missed.get(e.planKind) ?? { kind: e.planKind, label: meta?.label ?? e.planKind, conceptId: meta?.conceptId, count: 0, totalCp: 0, examples: [] }
        st.count++; st.totalCp += e.cpLoss
        if (st.examples.length < 5) st.examples.push({ url: a.url, ply: e.focusPly, title: e.title })
        missed.set(e.planKind, st)
        continue
      }
      const meta = HABIT_LABELS[e.kind]
      if (!meta) continue
      const st = habits.get(e.kind) ?? { kind: e.kind, label: meta.label, conceptId: meta.conceptId, count: 0, costly: 0, oppCount: 0 }
      if (e.side === userSide) {
        st.count++
        if (e.cpLoss >= 50) st.costly++
      } else {
        st.oppCount++
      }
      habits.set(e.kind, st)
    }
  }

  const structList = [...structures.values()].map(({ cpSum: cs, ...s }) => ({
    ...s,
    score: s.games ? (s.wins + s.draws / 2) / s.games : 0,
    avgCpLoss: s.moves ? cs / s.moves : 0,
  })).sort((a, b) => b.games - a.games)
  const centerList: CenterStat[] = [...centers.entries()]
    .map(([type, c]) => ({ type, label: CENTER_LABELS[type], moves: c.moves, avgCpLoss: c.moves ? c.cpSum / c.moves : 0 }))
    .sort((a, b) => b.moves - a.moves)
  const habitList = [...habits.values()].sort((a, b) => b.costly - a.costly || b.count - a.count)
  const missedList = [...missed.values()].sort((a, b) => b.totalCp - a.totalCp)
  const avgCpLoss = moves ? cpSum / moves : 0

  return {
    games: analyses.length,
    structures: structList,
    centers: centerList,
    habits: habitList,
    missed: missedList,
    headlines: headlines(structList, centerList, habitList, missedList, avgCpLoss),
    moves,
    avgCpLoss,
  }
}

function pct(x: number) { return `${Math.round(x * 100)} %` }

function headlines(
  structs: StructureStat[], centers: CenterStat[], habits: HabitStat[], missed: MissedPlanStat[], avg: number,
): string[] {
  const out: string[] = []
  const frequent = structs.filter(s => s.games >= 3)
  const worst = [...frequent].sort((a, b) => a.score - b.score)[0]
  if (worst && worst.score < 0.45) {
    out.push(`Structure à travailler : ${worst.name} (${worst.roleLabel}) — ${pct(worst.score)} de score sur ${worst.games} parties. Revois ses plans types dans l'onglet Structures.`)
  }
  const best = [...frequent].sort((a, b) => b.score - a.score)[0]
  if (best && best !== worst && best.score >= 0.6) {
    out.push(`Ta structure de prédilection : ${best.name} (${best.roleLabel}) — ${pct(best.score)} sur ${best.games} parties. Oriente ton répertoire vers elle.`)
  }
  const worstCenter = centers.filter(c => c.moves >= 30).sort((a, b) => b.avgCpLoss - a.avgCpLoss)[0]
  if (worstCenter && avg > 0 && worstCenter.avgCpLoss >= avg * 1.25) {
    out.push(`Tu perds ${Math.round(worstCenter.avgCpLoss)} cp/coup en position « ${worstCenter.label.toLowerCase()} » contre ${Math.round(avg)} en moyenne : c'est le type de position à étudier en priorité.`)
  }
  const topMissed = missed[0]
  if (topMissed && topMissed.count >= 2) {
    out.push(`Plan le plus souvent manqué : ${topMissed.label.toLowerCase()} (${topMissed.count} fois, ${topMissed.totalCp} cp au total). Entraîne-toi à le repérer dans l'onglet S'entraîner.`)
  }
  const habit = habits.find(h => h.costly >= 2 && h.count > h.oppCount)
  if (habit) {
    out.push(`Concession récurrente : ${habit.label.toLowerCase()} (${habit.count} fois, dont ${habit.costly} coûteuses ; tes adversaires : ${habit.oppCount}).`)
  }
  return out
}
