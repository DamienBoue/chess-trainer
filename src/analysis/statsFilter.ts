// Which games the stats look at: a time window and a time control. How you
// play now says more than the whole history (a habit from two years ago is
// often gone), so the screen opens on the last 30 days; "Toujours" stays
// one tap away.

import type { GameAnalysis } from '../types'

export type Period = '7d' | '30d' | '90d' | '1y' | 'all'

export const PERIODS: ReadonlyArray<{ id: Period; label: string; days: number | null; long: string }> = [
  { id: '7d', label: '7 j', days: 7, long: 'sur 7 jours' },
  { id: '30d', label: '30 j', days: 30, long: 'sur 30 jours' },
  { id: '90d', label: '90 j', days: 90, long: 'sur 90 jours' },
  { id: '1y', label: '1 an', days: 365, long: 'sur un an' },
  { id: 'all', label: 'Toujours', days: null, long: 'depuis toujours' },
]

export const DEFAULT_PERIOD: Period = '30d'

export type TimeClassFilter = 'all' | 'bullet' | 'blitz' | 'rapid' | 'daily'

export const TIME_CLASS_LABELS: Record<string, string> = {
  all: 'Toutes',
  bullet: 'Bullet',
  blitz: 'Blitz',
  rapid: 'Rapide',
  daily: 'Daily',
}

export interface StatsFilter {
  period: Period
  timeClass: TimeClassFilter
}

export const DEFAULT_FILTER: StatsFilter = { period: DEFAULT_PERIOD, timeClass: 'all' }

const DAY_MS = 86_400_000

/** First instant (ms) inside the period; null for "Toujours". */
export function periodStart(period: Period, now: number): number | null {
  const days = PERIODS.find(p => p.id === period)?.days ?? null
  return days === null ? null : now - days * DAY_MS
}

export function periodLong(period: Period): string {
  return PERIODS.find(p => p.id === period)?.long ?? ''
}

/** endTimeMs: when the game ended. */
export function matchesFilter(endTimeMs: number, timeClass: string, f: StatsFilter, now: number): boolean {
  if (f.timeClass !== 'all' && timeClass !== f.timeClass) return false
  const start = periodStart(f.period, now)
  return start === null || endTimeMs >= start
}

/** Analyses keep chess.com's end time, in seconds. */
export function filterAnalyses(list: GameAnalysis[], f: StatsFilter, now: number): GameAnalysis[] {
  return list.filter(a => matchesFilter(a.endTime * 1000, a.timeClass, f, now))
}

/** The time-control chips worth showing: "Toutes" plus each one played,
 *  most played first. A single time control needs no chip at all. */
export function timeClassOptions(classes: Iterable<string>): TimeClassFilter[] {
  const counts = new Map<TimeClassFilter, number>()
  for (const c of classes) {
    if (c in TIME_CLASS_LABELS && c !== 'all') counts.set(c as TimeClassFilter, (counts.get(c as TimeClassFilter) ?? 0) + 1)
  }
  if (counts.size < 2) return []
  return ['all', ...[...counts.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c)]
}

/** Stored filter, defaults when missing or unreadable. */
export function parseFilter(raw: string | null): StatsFilter {
  try {
    const v = JSON.parse(raw ?? 'null') as Partial<StatsFilter> | null
    return {
      period: PERIODS.some(p => p.id === v?.period) ? (v!.period as Period) : DEFAULT_PERIOD,
      timeClass: v?.timeClass && v.timeClass in TIME_CLASS_LABELS ? v.timeClass : 'all',
    }
  } catch {
    return DEFAULT_FILTER
  }
}
