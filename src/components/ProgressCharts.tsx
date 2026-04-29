import { useMemo } from 'react'
import type { GameAnalysis } from '../types'
import { buildTimeline } from '../analysis/timeline'

interface Props {
  analyses: GameAnalysis[]
}

const W = 720
const H = 140
const PAD = { left: 36, right: 12, top: 16, bottom: 26 }

export default function ProgressCharts({ analyses }: Props) {
  const timeline = useMemo(() => buildTimeline(analyses), [analyses])
  if (timeline.length < 2) return null  // need at least 2 weeks for a meaningful curve

  return (
    <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-4 space-y-4">
      <h3 className="font-semibold">Évolution dans le temps</h3>

      <div>
        <div className="flex items-baseline justify-between mb-1">
          <span className="text-sm text-neutral-300">Précision (CPL moyen, plus bas = mieux)</span>
          <span className="text-xs text-neutral-500">{timeline.length} semaine{timeline.length > 1 ? 's' : ''}</span>
        </div>
        <LineChart
          values={timeline.map(t => t.avgUserCpLoss)}
          labels={timeline.map(t => t.label)}
          color="#5fa052"
          yMin={0}
          yMax={Math.max(...timeline.map(t => t.avgUserCpLoss), 100)}
          format={v => `${v.toFixed(0)} cp`}
        />
      </div>

      <div>
        <div className="text-sm text-neutral-300 mb-1">Win rate</div>
        <LineChart
          values={timeline.map(t => t.games > 0 ? (t.wins + 0.5 * t.draws) / t.games * 100 : 0)}
          labels={timeline.map(t => t.label)}
          color="#4a90d0"
          yMin={0}
          yMax={100}
          format={v => `${v.toFixed(0)}%`}
        />
      </div>

      {timeline.some(t => t.rating != null) && (
        <div>
          <div className="text-sm text-neutral-300 mb-1">Elo chess.com</div>
          <LineChart
            values={timeline.map(t => t.rating ?? 0).map((r, i, a) => r || (i > 0 ? a[i - 1] : 0))}
            labels={timeline.map(t => t.label)}
            color="#e6c34d"
            yMin={Math.min(...timeline.map(t => t.rating ?? Infinity)) - 50}
            yMax={Math.max(...timeline.map(t => t.rating ?? -Infinity)) + 50}
            format={v => v.toFixed(0)}
          />
        </div>
      )}
    </div>
  )
}

function LineChart({
  values, labels, color, yMin, yMax, format,
}: {
  values: number[]
  labels: string[]
  color: string
  yMin: number
  yMax: number
  format: (v: number) => string
}) {
  if (values.length === 0) return null
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom
  const xStep = values.length > 1 ? innerW / (values.length - 1) : 0
  const xOf = (i: number) => PAD.left + i * xStep
  const yOf = (v: number) => {
    const norm = yMax === yMin ? 0.5 : (v - yMin) / (yMax - yMin)
    return PAD.top + (1 - Math.max(0, Math.min(1, norm))) * innerH
  }
  const points = values.map((v, i) => `${xOf(i)},${yOf(v)}`).join(' ')

  // Sparse x-axis ticks (max 6)
  const stride = Math.max(1, Math.ceil(values.length / 6))
  const ticks = labels.map((l, i) => i % stride === 0 || i === values.length - 1 ? { x: xOf(i), label: l } : null).filter(Boolean) as { x: number; label: string }[]

  // Y-axis ticks: yMin, mid, yMax
  const yTicks = [yMin, (yMin + yMax) / 2, yMax]

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      <rect x={0} y={0} width={W} height={H} fill="#1a1a1a" />
      {yTicks.map((v, i) => (
        <g key={i}>
          <line x1={PAD.left} x2={W - PAD.right} y1={yOf(v)} y2={yOf(v)} stroke="#333" strokeDasharray="2 3" />
          <text x={PAD.left - 4} y={yOf(v) + 3} fill="#777" fontSize="9" textAnchor="end">{format(v)}</text>
        </g>
      ))}
      <polyline points={points} stroke={color} strokeWidth={2} fill="none" />
      {values.map((v, i) => (
        <circle key={i} cx={xOf(i)} cy={yOf(v)} r={2.5} fill={color} />
      ))}
      {ticks.map((t, i) => (
        <text key={i} x={t.x} y={H - 8} fill="#888" fontSize="9" textAnchor="middle">{t.label}</text>
      ))}
    </svg>
  )
}
