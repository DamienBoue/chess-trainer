// Cross-comparison between two scouting profiles.
//
// The "mutual weakness" output is the answer to: which openings should we
// drill if these two players are going to face each other in a long game?
// We pick openings that are played by either side with a poor win rate,
// then surface the strongest opportunity per colour.

import type { ScoutingProfile, OpeningStat } from './scouting'

export interface OpeningOpportunity {
  opening: string
  asWhite?: OpeningStat            // when the OWNER plays White
  asBlack?: OpeningStat            // when the OWNER plays Black
  combinedScore: number            // (1 - winRate) * sqrt(played), bigger = better attack target
}

export interface ComparisonResult {
  meVsOpp: {
    /** Opener viewpoint = ME playing white against OPP playing black.
     *  Choose an opening where OPP scores poorly with black. */
    asWhite: OpeningOpportunity[]
    /** ME playing black: pick openings where OPP scores poorly with white. */
    asBlack: OpeningOpportunity[]
  }
  oppVsMe: {
    asWhite: OpeningOpportunity[]   // openings where I am weak with black
    asBlack: OpeningOpportunity[]   // openings where I am weak with white
  }
  notes: string[]
}

function opportunitiesAgainst(
  profile: ScoutingProfile,
  playerColor: 'whiteSide' | 'blackSide',
  minGames = 3,
): OpeningOpportunity[] {
  // Pick openings from the OPP's profile on the side they're playing
  // (whiteSide = when OPP plays white) where their win rate is weak.
  const list = profile[playerColor].openings.filter(o => o.played >= minGames)
  return list
    .map(o => ({
      opening: o.name,
      [playerColor === 'whiteSide' ? 'asWhite' : 'asBlack']: o,
      combinedScore: (1 - o.winRate) * Math.sqrt(o.played),
    } as OpeningOpportunity))
    .filter(o => (o.asWhite?.winRate ?? o.asBlack?.winRate ?? 1) < 0.55)
    .sort((a, b) => b.combinedScore - a.combinedScore)
    .slice(0, 6)
}

export function compareProfiles(me: ScoutingProfile, opp: ScoutingProfile): ComparisonResult {
  // From MY perspective: when I'm White, I want OPP's weak black-side openings.
  // When I'm Black, I want OPP's weak white-side openings.
  const meAsWhite = opportunitiesAgainst(opp, 'blackSide')
  const meAsBlack = opportunitiesAgainst(opp, 'whiteSide')
  // Reverse view for the symmetric panel.
  const oppAsWhite = opportunitiesAgainst(me, 'blackSide')
  const oppAsBlack = opportunitiesAgainst(me, 'whiteSide')

  const notes: string[] = []
  if (me.games < 10) notes.push(`${me.username} : seulement ${me.games} parties, données peu fiables.`)
  if (opp.games < 10) notes.push(`${opp.username} : seulement ${opp.games} parties, données peu fiables.`)

  // Identify outright form difference.
  const formDelta = me.recentForm.filter(r => r === 'W').length
    - opp.recentForm.filter(r => r === 'W').length
  if (Math.abs(formDelta) >= 4) {
    const leader = formDelta > 0 ? me.username : opp.username
    notes.push(`${leader} est nettement en meilleure forme récente (Δ ${Math.abs(formDelta)} victoires sur 20).`)
  }

  return {
    meVsOpp: { asWhite: meAsWhite, asBlack: meAsBlack },
    oppVsMe: { asWhite: oppAsWhite, asBlack: oppAsBlack },
    notes,
  }
}
