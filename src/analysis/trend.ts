// Compares the most-recent activity window to a rolling baseline so the
// dashboard can show "you improved by X%" deltas.
//
// "Recent" = the most recent calendar week WITH GAMES (skip empty weeks
// to avoid penalising the user for taking a break).
// "Baseline" = the 4 preceding weeks with games, aggregated.

import type { WeekStats } from './timeline'

export interface TrendDelta {
  /** Recent value in human-readable units (cp, %, count). */
  recent: number
  /** Baseline = mean of the 4 weeks preceding `recent`. */
  baseline: number
  /** Absolute delta (recent - baseline). Negative = recent value lower. */
  delta: number
  /** Whether a smaller value is the GOOD direction (e.g. cpLoss, blunders). */
  lowerIsBetter: boolean
  /** Sample sizes feeding each side, for confidence display. */
  recentGames: number
  baselineGames: number
}

export interface Trend {
  /** Average user cpLoss per move. Lower is better. */
  cpLoss: TrendDelta
  /** Blunders per game (avg). Lower is better. */
  blundersPerGame: TrendDelta
  /** Win rate (0..1). Higher is better. */
  winRate: TrendDelta
  /** Games played in the window. Higher = more activity. */
  gamesPerWeek: TrendDelta
}

function avg(xs: number[]): number {
  return xs.length === 0 ? 0 : xs.reduce((s, x) => s + x, 0) / xs.length
}

function pickRecentAndBaseline(weeks: WeekStats[]): {
  recent: WeekStats[]
  baseline: WeekStats[]
} {
  // Take only weeks that actually had games; the user "took a break" weeks
  // shouldn't pollute either window.
  const active = weeks.filter(w => w.games > 0)
  const recent = active.slice(-1)                  // last active week
  const baseline = active.slice(-5, -1)            // 4 weeks before that
  return { recent, baseline }
}

function delta(
  recentArr: WeekStats[],
  baselineArr: WeekStats[],
  pick: (w: WeekStats) => number,
  lowerIsBetter: boolean,
): TrendDelta {
  const recentVal = avg(recentArr.map(pick))
  const baselineVal = avg(baselineArr.map(pick))
  return {
    recent: recentVal,
    baseline: baselineVal,
    delta: recentVal - baselineVal,
    lowerIsBetter,
    recentGames: recentArr.reduce((s, w) => s + w.games, 0),
    baselineGames: baselineArr.reduce((s, w) => s + w.games, 0),
  }
}

export function computeTrend(weeks: WeekStats[]): Trend | null {
  const { recent, baseline } = pickRecentAndBaseline(weeks)
  if (recent.length === 0 || baseline.length === 0) return null
  return {
    cpLoss: delta(recent, baseline,
      w => (w.userMoves > 0 ? w.cpLossSum / w.userMoves : 0), true),
    blundersPerGame: delta(recent, baseline,
      w => (w.games > 0 ? w.blunders / w.games : 0), true),
    winRate: delta(recent, baseline,
      w => (w.games > 0 ? (w.wins + 0.5 * w.draws) / w.games : 0), false),
    gamesPerWeek: delta(recent, baseline, w => w.games, false),
  }
}

/** Should the visual treatment celebrate or warn? "improved" = delta moved
 *  in the lowerIsBetter direction by at least 5 %. */
export function trendDirection(d: TrendDelta): 'improved' | 'worsened' | 'flat' {
  if (d.baseline === 0) return 'flat'
  const relative = d.delta / Math.max(1e-6, Math.abs(d.baseline))
  if (Math.abs(relative) < 0.05) return 'flat'
  const reduced = d.delta < 0
  return (reduced === d.lowerIsBetter) ? 'improved' : 'worsened'
}
