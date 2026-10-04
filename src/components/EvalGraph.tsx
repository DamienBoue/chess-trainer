// Evaluation curve of the analysed game, from White's point of view (±10
// pawns, mates pinned to the edges). As on Lichess / chess.com, every
// inaccuracy, mistake and blunder is dotted on the curve in its
// classification colour: the player's own moves bigger and opaque, the
// opponent's smaller and dimmed (an opponent blunder left unpunished is a
// lesson too). Key moments are ticked along the top edge. Markers seek to
// their move on click and explain themselves in a tooltip; nothing is
// labelled permanently, so the curve stays readable.

import type { MoveAnalysis, MoveClassification } from '../types'
import { CLASSIFICATION_COLORS, CLASSIFICATION_GLYPHS, CLASSIFICATION_LABELS } from '../analysis/classify'

interface Props {
  moves: MoveAnalysis[]
  currentPly: number
  userColor: 'white' | 'black'
  onClickPly: (ply: number) => void
  /** Plies ticked along the top edge (AnalysisView's key moments). */
  keyMoments?: number[]
}

const W = 600
const H = 120
const PADDING = 4

// Error dots, in viewBox units: small, so they don't drown the curve.
const USER_DOT_R = 3.5
const OPPONENT_DOT_R = 2.5
const OPPONENT_DOT_OPACITY = 0.5
// Invisible click area around each marker: the marks alone are tiny targets.
const HIT_R = 6
// Key-moment ticks: small downward triangles on the top edge, in the
// curve's own neutral ink so they don't read as a classification.
const KEY_MOMENT_COLOR = '#cbd5e1'
const KEY_TICK_W = 7
const KEY_TICK_H = 5

interface ErrorDot {
  ply: number
  cx: number
  cy: number
  isUser: boolean
  color: string
  tooltip: string
}

/** "12. Nf3" for a White move, "12... Rc8" for a Black one. */
function moveLabel(ply: number, san: string): string {
  return `${Math.ceil(ply / 2)}${ply % 2 === 1 ? '.' : '...'} ${san}`
}

/** "0 gaffe", "1 gaffe", "2 gaffes". */
function countLabel(n: number, noun: string): string {
  return `${n} ${noun}${n > 1 ? 's' : ''}`
}

export default function EvalGraph({ moves, currentPly, userColor, onClickPly, keyMoments = [] }: Props) {
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

  // Error dots: a move is dotted iff it carries an annotation glyph
  // (?! ? ??), as in the move list. The opponent's are drawn first so the
  // player's own stay on top (and win the click) where they overlap.
  const userIsWhite = userColor === 'white'
  const userErrors: Partial<Record<MoveClassification, number>> = {}
  const dots: ErrorDot[] = []
  for (const p of points) {
    const c = p.m.classification
    const glyph = CLASSIFICATION_GLYPHS[c]
    if (!glyph) continue
    const isUser = (p.x % 2 === 1) === userIsWhite
    if (isUser) userErrors[c] = (userErrors[c] ?? 0) + 1
    dots.push({
      ply: p.x,
      cx: xOf(p.x),
      cy: yOf(p.y),
      isUser,
      color: CLASSIFICATION_COLORS[c],
      tooltip: `${moveLabel(p.x, p.m.san)} ${glyph} — ${CLASSIFICATION_LABELS[c]}${isUser ? '' : " de l'adversaire"} (−${Math.round(p.m.cpLoss)} cp)`,
    })
  }
  dots.sort((a, b) => Number(a.isUser) - Number(b.isUser))

  // Key-moment ticks: each valid ply once, in game order.
  const keyPlies = [...new Set(keyMoments)]
    .filter(k => Number.isInteger(k) && k >= 1 && k <= moves.length)
    .sort((a, b) => a - b)

  // The graph's spoken summary: the player's own errors (the dots carry
  // the detail for sighted users; the move list is the accessible route).
  const ariaLabel = `Courbe d'évaluation : ${countLabel(userErrors.blunder ?? 0, 'gaffe')}, `
    + `${countLabel(userErrors.mistake ?? 0, 'erreur')}, `
    + `${countLabel(userErrors.inaccuracy ?? 0, 'inexactitude')} de ta part`

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-32 cursor-pointer"
      role="img"
      aria-label={ariaLabel}
      onClick={(e) => {
        // Back to viewBox units. The drawing keeps its 5:1 ratio
        // (preserveAspectRatio "meet"), so a wider element letterboxes it.
        const rect = e.currentTarget.getBoundingClientRect()
        const scale = Math.min(rect.width / W, rect.height / H)
        if (!scale) return
        const x = (e.clientX - rect.left - (rect.width - W * scale) / 2) / scale - PADDING
        // The move whose point is nearest; the left margin is the start position.
        const ply = Math.round(x / xStep + 0.5)
        onClickPly(Math.max(0, Math.min(moves.length, ply)))
      }}
    >
      <rect x={0} y={0} width={W} height={H} fill="#1a1a1a" />
      <line x1={PADDING} x2={W - PADDING} y1={baseline} y2={baseline} stroke="#444" strokeDasharray="2 2" />
      <path d={path} fill="rgba(238,238,210,0.18)" />
      <polyline
        points={points.map(p => `${xOf(p.x)},${yOf(p.y)}`).join(' ')}
        fill="none"
        stroke="#cbd5e1"
        strokeWidth={1.5}
      />
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
      {keyPlies.map(ply => {
        const x = xOf(ply)
        return (
          <g key={ply} onClick={(e) => { e.stopPropagation(); onClickPly(ply) }}>
            <title>{`Moment clé — ${moveLabel(ply, moves[ply - 1].san)}`}</title>
            <rect x={x - HIT_R} y={0} width={2 * HIT_R} height={2 * HIT_R} fill="transparent" />
            <path
              data-key-moment={ply}
              d={`M ${x - KEY_TICK_W / 2} 0 L ${x + KEY_TICK_W / 2} 0 L ${x} ${KEY_TICK_H} Z`}
              fill={KEY_MOMENT_COLOR}
              opacity={ply === currentPly ? 1 : 0.6}
            />
          </g>
        )
      })}
      {dots.map(d => (
        <g key={d.ply} onClick={(e) => { e.stopPropagation(); onClickPly(d.ply) }}>
          <title>{d.tooltip}</title>
          <circle cx={d.cx} cy={d.cy} r={HIT_R} fill="transparent" />
          {/* A thin halo in the background colour detaches the dot from the curve. */}
          <circle
            data-side={d.isUser ? 'user' : 'opponent'}
            cx={d.cx}
            cy={d.cy}
            r={d.isUser ? USER_DOT_R : OPPONENT_DOT_R}
            fill={d.color}
            opacity={d.isUser ? 1 : OPPONENT_DOT_OPACITY}
            stroke="#1a1a1a"
            strokeWidth={0.75}
          />
        </g>
      ))}
    </svg>
  )
}
