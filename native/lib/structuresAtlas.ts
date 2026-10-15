// Atlas data shared by the two structure screens: the families (same
// grouping as the website) and the player's record per structure.
import { useMemo } from 'react'
import type { GameAnalysis } from '@shared/types'
import { buildStrategyProfile, type StructureStat } from '@shared/strategy/profile'
import { strategyReviewOf } from '@/lib/analysis'

export const STRUCTURE_FAMILIES: { label: string; ids: string[] }[] = [
  { label: 'Pions isolés et pendants', ids: ['iqp', 'hanging-pawns', 'panov-chain'] },
  { label: 'Structures du Gambit Dame', ids: ['carlsbad', 'slav', 'caro-slav', 'triangle', 'nimzo-doubled', 'big-center'] },
  { label: 'Siciliennes', ids: ['maroczy', 'hedgehog', 'scheveningen', 'boleslavsky', 'd5-chain', 'dragon'] },
  { label: 'Françaises', ids: ['french-chain', 'french-open', 'french-e5'] },
  { label: 'Centres fermés et Benoni', ids: ['kid-closed', 'benoni', 'benoni-sym', 'stonewall'] },
  { label: 'Majorités', ids: ['majority-3-4'] },
]

/** Per-structure stats of the player's analysed games ([] when none). */
export function useStructureStats(analyses: Record<string, GameAnalysis>): StructureStat[] {
  return useMemo(() => {
    const list = Object.values(analyses)
    if (list.length === 0) return []
    try {
      // strategyReviewOf memoises per analysis; a failed review skips the game.
      return buildStrategyProfile(list.filter(a => strategyReviewOf(a)), a => strategyReviewOf(a)!).structures
    } catch { return [] }
  }, [analyses])
}
