// Turns a strategic report into board decorations (square tints, rings,
// arrows) for TrainingBoard. Pure, so it is unit-tested without React.
//
// Inset box-shadows are used instead of background colours so the board
// theme's light/dark squares stay visible underneath.

import type { CSSProperties } from 'react'
import { type Side, opp, sqName } from '../strategy/board'
import type { Plan } from '../strategy/plans'
import type { StrategicReport } from '../strategy/report'
import type { StrategyOverlays } from '../storage/strategyPrefs'

export interface BoardArrow { startSquare: string; endSquare: string; color: string }

export interface BoardOverlay {
  squareStyles: Record<string, CSSProperties>
  arrows: BoardArrow[]
}

export const EMPTY_OVERLAY: BoardOverlay = { squareStyles: {}, arrows: [] }

// One colour per meaning, never reused: teal = asset, amber = weakness,
// blue = your plan, violet = the opponent's plan, green = engine move.
// Red stays reserved for blunders (move classification).
export const OVERLAY_COLORS = {
  // Bright rings (visible on every board theme, green included) + light tints.
  strong: 'rgba(45, 212, 191, 0.95)',
  strongTint: 'rgba(20, 184, 166, 0.28)',
  weak: 'rgba(251, 191, 36, 0.95)',
  weakTint: 'rgba(245, 158, 11, 0.30)',
  passed: 'rgba(45, 212, 191, 0.95)',
  weakPawn: 'rgba(251, 191, 36, 0.95)',
  plan: 'rgba(56, 132, 255, 0.85)',
  // Opponent's intentions: violet, so red stays reserved for blunders.
  threat: 'rgba(167, 139, 250, 0.85)',
  engine: 'rgba(95, 160, 82, 0.9)',
  focus: 'rgba(255, 221, 0, 0.95)',
}

export function buildStrategyOverlay(
  report: StrategicReport,
  perspective: Side,
  overlays: StrategyOverlays,
  plan: Plan | null,
  focus: number[] | null,
): BoardOverlay {
  const shadows = new Map<number, string[]>()
  const add = (sq: number, shadow: string) => {
    const list = shadows.get(sq) ?? []
    list.push(shadow)
    shadows.set(sq, list)
  }
  const tint = (c: string) => `inset 0 0 0 100px ${c}`
  const ring = (c: string, w = 3) => `inset 0 0 0 ${w}px ${c}`

  if (overlays.strong) {
    for (const o of report.squares.outposts[perspective].filter(x => x.pawnProtected && x.score >= 6).slice(0, 3)) {
      add(o.sq, ring(OVERLAY_COLORS.strong, 3))
      add(o.sq, tint(OVERLAY_COLORS.strongTint))
    }
  }
  if (overlays.weak) {
    for (const w of report.squares.weak[perspective].filter(x => x.score >= 6).slice(0, 3)) {
      add(w.sq, ring(OVERLAY_COLORS.weak, 3))
      add(w.sq, tint(OVERLAY_COLORS.weakTint))
    }
  }
  if (overlays.pawns) {
    for (const side of [perspective, opp(perspective)]) {
      for (const p of (side === 'w' ? report.pawns.w : report.pawns.b).pawns) {
        if (p.passed) add(p.sq, ring(OVERLAY_COLORS.passed))
        else if (p.isolated || p.backward) add(p.sq, ring(OVERLAY_COLORS.weakPawn))
      }
    }
  }

  const arrows: BoardArrow[] = []
  if (overlays.plans && plan) {
    const color = plan.arrowsAreThreats || plan.side !== perspective ? OVERLAY_COLORS.threat : OVERLAY_COLORS.plan
    for (const [from, to] of plan.arrows) arrows.push({ startSquare: sqName(from), endSquare: sqName(to), color })
    for (const sq of plan.squares) add(sq, ring(color, 2))
  }
  for (const sq of focus ?? []) add(sq, ring(OVERLAY_COLORS.focus, 4))

  const squareStyles: Record<string, CSSProperties> = {}
  for (const [sq, list] of shadows) squareStyles[sqName(sq)] = { boxShadow: list.join(', ') }
  return { squareStyles, arrows }
}

/** Style for a highlighted key square (atlas, trainer answers). */
export function strongSquareStyle(): CSSProperties {
  return { boxShadow: `inset 0 0 0 3px ${OVERLAY_COLORS.strong}, inset 0 0 0 100px ${OVERLAY_COLORS.strongTint}` }
}

export function weakSquareStyle(): CSSProperties {
  return { boxShadow: `inset 0 0 0 3px ${OVERLAY_COLORS.weak}, inset 0 0 0 100px ${OVERLAY_COLORS.weakTint}` }
}
