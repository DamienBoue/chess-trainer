import type { GameAnalysis } from '../types'

export interface WeekStats {
  weekStart: number       // unix ms — Monday 00:00 UTC of that ISO week
  label: string           // e.g. "29 avr." or "S17"
  games: number
  wins: number
  losses: number
  draws: number
  cpLossSum: number       // sum of user cpLoss across all moves in the week
  userMoves: number
  avgUserCpLoss: number
  rating: number | null   // last known user rating during the week
}

function startOfWeek(ts: number): number {
  const d = new Date(ts)
  const day = (d.getUTCDay() + 6) % 7   // Monday = 0
  d.setUTCHours(0, 0, 0, 0)
  d.setUTCDate(d.getUTCDate() - day)
  return d.getTime()
}

function shortLabel(ms: number): string {
  const d = new Date(ms)
  return `${d.getUTCDate()}/${d.getUTCMonth() + 1}`
}

export function buildTimeline(analyses: GameAnalysis[]): WeekStats[] {
  if (analyses.length === 0) return []
  const sorted = [...analyses].sort((a, b) => a.endTime - b.endTime)

  const buckets = new Map<number, WeekStats>()
  for (const game of sorted) {
    const ws = startOfWeek(game.endTime * 1000)
    if (!buckets.has(ws)) {
      buckets.set(ws, {
        weekStart: ws,
        label: shortLabel(ws),
        games: 0, wins: 0, losses: 0, draws: 0,
        cpLossSum: 0, userMoves: 0, avgUserCpLoss: 0,
        rating: null,
      })
    }
    const b = buckets.get(ws)!
    b.games++
    if (game.result === 'win') b.wins++
    else if (game.result === 'loss') b.losses++
    else b.draws++
    if (game.userRating) b.rating = game.userRating

    const userIsWhite = game.userColor === 'white'
    for (const mv of game.moves) {
      const moverIsWhite = mv.ply % 2 === 1
      if (moverIsWhite === userIsWhite) {
        b.cpLossSum += mv.cpLoss
        b.userMoves++
      }
    }
  }

  return Array.from(buckets.values())
    .sort((a, b) => a.weekStart - b.weekStart)
    .map(b => ({ ...b, avgUserCpLoss: b.userMoves > 0 ? b.cpLossSum / b.userMoves : 0 }))
}
