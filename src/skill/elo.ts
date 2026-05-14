// User skill rating: declared (in Settings) or inferred (from analyzed
// games). Drives adaptivity throughout the app — drill difficulty,
// roadmap focus, recommendations.

import type { GameAnalysis } from '../types'
import { loadJson, saveJson } from '../storage/json'

const ELO_KEY = 'chess.elo.v1'

export interface SkillBracket {
  id: 'beginner' | 'casual' | 'club' | 'tournament' | 'expert' | 'master'
  min: number
  max: number
  label: string
  description: string
}

export const BRACKETS: SkillBracket[] = [
  { id: 'beginner',   min: 0,    max: 999,  label: 'Débutant',     description: 'Tu apprends à ne pas perdre une pièce par coup.' },
  { id: 'casual',     min: 1000, max: 1399, label: 'Joueur loisir', description: 'Tu connais les ouvertures basiques et les tactiques 1-2 coups.' },
  { id: 'club',       min: 1400, max: 1799, label: 'Club',          description: 'Tu construis des plans, tu vois la plupart des fourchettes.' },
  { id: 'tournament', min: 1800, max: 2099, label: 'Tournoi',       description: 'Tu gères les structures de pions et le calcul à 3-4 coups.' },
  { id: 'expert',     min: 2100, max: 2299, label: 'Expert',        description: 'Tu prépares tes parties et tu domines les finales théoriques.' },
  { id: 'master',     min: 2300, max: 9999, label: 'Maître',        description: 'Tu raffines la prophylaxie et les positions complexes.' },
]

export interface EloPreference {
  /** User-declared Elo. null means use inferred only. */
  declared: number | null
  /** Optional context (chess.com rapid / chess.com blitz / FIDE / Lichess / OTB / autre). */
  source?: string
}

export function loadEloPreference(): EloPreference {
  return loadJson<EloPreference>(ELO_KEY, { declared: null })
}

export function saveEloPreference(pref: EloPreference): void {
  saveJson(ELO_KEY, pref)
}

/** Median Elo across the most recent N analyzed games' user ratings.
 *  Returns null if there aren't enough data points (< 3). */
export function inferEloFromGames(analyses: GameAnalysis[], lookbackN = 20): number | null {
  const ratings = analyses
    .slice()
    .sort((a, b) => b.endTime - a.endTime)
    .slice(0, lookbackN)
    .map(g => g.userRating)
    .filter((r): r is number => typeof r === 'number' && r > 0)
  if (ratings.length < 3) return null
  const sorted = [...ratings].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

/** Pick the effective Elo to use: declared if set, else inferred, else null. */
export function effectiveElo(pref: EloPreference, analyses: GameAnalysis[]): number | null {
  if (pref.declared != null) return pref.declared
  return inferEloFromGames(analyses)
}

export function bracketForElo(elo: number | null): SkillBracket {
  if (elo == null) return BRACKETS[1] // default to casual when unknown
  return BRACKETS.find(b => elo >= b.min && elo <= b.max) ?? BRACKETS[BRACKETS.length - 1]
}

/** Suggest a bracket change when the declared Elo and the inferred Elo
 *  (from recent games) disagree by more than 100 points — likely the
 *  user has moved up (or down) since they last declared.
 *
 *  Returns null when nothing significant to suggest. */
export function suggestBracketChange(
  pref: EloPreference,
  analyses: GameAnalysis[],
): { kind: 'promote' | 'demote'; declared: number; inferred: number; nextBracket: SkillBracket } | null {
  if (pref.declared == null) return null      // user hasn't declared, nothing to compare
  const inferred = inferEloFromGames(analyses)
  if (inferred == null) return null
  const diff = inferred - pref.declared
  if (Math.abs(diff) < 100) return null
  const currentBracket = bracketForElo(pref.declared)
  const inferredBracket = bracketForElo(inferred)
  if (currentBracket.id === inferredBracket.id) return null
  return {
    kind: diff > 0 ? 'promote' : 'demote',
    declared: pref.declared,
    inferred,
    nextBracket: inferredBracket,
  }
}
