import type { MoveAnalysis } from '../types'
import { CLASSIFICATION_COLORS } from '../analysis/classify'

interface Props {
  moves: MoveAnalysis[]
  currentPly: number
  userColor: 'white' | 'black'
  onClickPly: (ply: number) => void
}

const W = 600
const H = 120
const PADDING = 4

export default function EvalGraph({ moves, currentPly, userColor, onClickPly }: Props) {
  if (moves.length === 0) return null
  // Build points; clamp to [-1000, 1000] cp; mate -> ±1000.
  const points = moves.map((m, i) => {
    let v = m.evalAfter
    if (Math.abs(v) > 50000) v = v > 0 ? 1000 : -1000
    v = Math.max(-1000, Math.min(1000, v))
    return { x: i + 1, y: v, m }
  })

  const xStep = (W - 2 * PADDING) / Math.max(moves.length, 1)
  const xOf = (ply: number) => PADDING + (ply - 0.5) * xStep
  const yOf = (cp: number) => {
    // From white's perspective: +1000 = top
    const norm = (cp + 1000) / 2000  // 0..1
    return PADDING + (1 - norm) * (H - 2 * PADDING)
  }

  // Build area path: from y=mid baseline up to value
  const baseline = yOf(0)
  let path = `M ${xOf(1)} ${baseline}`
  for (const p of points) {
    path += ` L ${xOf(p.x)} ${yOf(p.y)}`
  }
  path += ` L ${xOf(points.length)} ${baseline} Z`

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-32 cursor-pointer"
      onClick={(e) => {
        const rect = (e.target as SVGElement).closest('svg')!.getBoundingClientRect()
        const x = ((e.clientX - rect.left) / rect.width) * W - PADDING
        const ply = Math.round(x / xStep)
        onClickPly(Math.max(0, Math.min(moves.length, ply)))
      }}
    >
      <rect x={0} y={0} width={W} height={H} fill="#1a1a1a" />
      <line x1={PADDING} x2={W - PADDING} y1={baseline} y2={baseline} stroke="#444" strokeDasharray="2 2" />
      <path d={path} fill={userColor === 'white' ? 'rgba(238,238,210,0.18)' : 'rgba(238,238,210,0.18)'} />
      <polyline
        points={points.map(p => `${xOf(p.x)},${yOf(p.y)}`).join(' ')}
        fill="none"
        stroke="#cbd5e1"
        strokeWidth={1.5}
      />
      {points.map(p => (
        (p.m.classification === 'blunder' || p.m.classification === 'mistake') && (
          <circle
            key={p.x}
            cx={xOf(p.x)}
            cy={yOf(p.y)}
            r={3}
            fill={CLASSIFICATION_COLORS[p.m.classification]}
          />
        )
      ))}
      {currentPly > 0 && (
        <line
          x1={xOf(currentPly)}
          x2={xOf(currentPly)}
          y1={PADDING}
          y2={H - PADDING}
          stroke="#769656"
          strokeWidth={1.5}
        />
      )}
    </svg>
  )
}
