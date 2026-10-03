// Cadence (time class) and colour filters over the analysed games: the
// filter types and pure helpers. App applies them app-wide; the tabs that
// pick them live in TimeClassFilter.tsx.

import type { Color, GameAnalysis } from '../types'

export type TimeClassFilter = 'all' | string
export type ColorFilter = 'all' | Color

const LABELS: Record<string, string> = {
  rapid: 'Rapide',
  blitz: 'Blitz',
  bullet: 'Bullet',
  daily: 'Correspondance',
  pgn: 'PGN',
}

export function labelForTimeClass(tc: string): string {
  return LABELS[tc] ?? tc
}

// Display order (rarer time classes appear after the common three)
const ORDER = ['rapid', 'blitz', 'bullet', 'daily']

export function availableTimeClasses(analyses: GameAnalysis[]): string[] {
  const set = new Set<string>()
  for (const a of analyses) if (a.timeClass) set.add(a.timeClass)
  return Array.from(set).sort((a, b) => {
    const ia = ORDER.indexOf(a); const ib = ORDER.indexOf(b)
    if (ia !== -1 && ib !== -1) return ia - ib
    if (ia !== -1) return -1
    if (ib !== -1) return 1
    return a.localeCompare(b)
  })
}

export function applyTimeClassFilter(
  analyses: GameAnalysis[],
  filter: TimeClassFilter,
): GameAnalysis[] {
  if (filter === 'all') return analyses
  return analyses.filter(a => a.timeClass === filter)
}

export function applyColorFilter(
  analyses: GameAnalysis[],
  filter: ColorFilter,
): GameAnalysis[] {
  if (filter === 'all') return analyses
  return analyses.filter(a => a.userColor === filter)
}

export function applyGlobalFilters(
  analyses: GameAnalysis[],
  tc: TimeClassFilter,
  color: ColorFilter,
): GameAnalysis[] {
  return applyColorFilter(applyTimeClassFilter(analyses, tc), color)
}
