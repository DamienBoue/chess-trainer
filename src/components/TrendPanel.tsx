// 4-card "tendance récente" panel. Compares the latest active week to
// the 4 preceding active weeks. Extracted from StatsView.

import { trendDirection, type Trend, type TrendDelta } from '../analysis/trend'

interface Props {
  trend: Trend
}

export default function TrendPanel({ trend }: Props) {
  return (
    <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-4">
      <div className="flex items-baseline justify-between flex-wrap gap-2 mb-3">
        <h3 className="font-semibold">Tendance récente</h3>
        <span className="text-xs text-neutral-500">
          Semaine dernière active vs les 4 précédentes
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <TrendCard
          label="Précision (cp/coup)"
          delta={trend.cpLoss}
          formatRecent={v => v.toFixed(0)}
          formatDelta={d => `${d > 0 ? '+' : ''}${d.toFixed(0)} cp`}
        />
        <TrendCard
          label="Blunders / partie"
          delta={trend.blundersPerGame}
          formatRecent={v => v.toFixed(2)}
          formatDelta={d => `${d > 0 ? '+' : ''}${d.toFixed(2)}`}
        />
        <TrendCard
          label="Win rate"
          delta={trend.winRate}
          formatRecent={v => `${(v * 100).toFixed(0)}%`}
          formatDelta={d => `${d > 0 ? '+' : ''}${(d * 100).toFixed(0)} pt`}
        />
        <TrendCard
          label="Parties / semaine"
          delta={trend.gamesPerWeek}
          formatRecent={v => v.toFixed(0)}
          formatDelta={d => `${d > 0 ? '+' : ''}${d.toFixed(0)}`}
        />
      </div>
      <p className="text-[10px] text-neutral-500 mt-2">
        Comparaison sur la dernière semaine active ({trend.cpLoss.recentGames} partie{trend.cpLoss.recentGames > 1 ? 's' : ''}) face aux 4 d'avant ({trend.cpLoss.baselineGames} parties).
      </p>
    </div>
  )
}

function TrendCard({
  label, delta, formatRecent, formatDelta,
}: {
  label: string
  delta: TrendDelta
  formatRecent: (v: number) => string
  formatDelta: (d: number) => string
}) {
  const dir = trendDirection(delta)
  const colorClass = dir === 'improved' ? 'text-green-400'
    : dir === 'worsened' ? 'text-red-400'
    : 'text-neutral-400'
  const arrow = dir === 'improved' ? (delta.delta < 0 ? '↓' : '↑')
    : dir === 'worsened' ? (delta.delta < 0 ? '↓' : '↑')
    : '·'
  return (
    <div className="bg-neutral-900/60 border border-[var(--color-border)] rounded-md p-3">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="text-2xl font-bold mt-1">{formatRecent(delta.recent)}</div>
      <div className={`text-xs mt-1 flex items-center gap-1 ${colorClass}`}>
        <span>{arrow}</span>
        <span className="font-mono">{formatDelta(delta.delta)}</span>
      </div>
    </div>
  )
}
