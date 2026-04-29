import type { Exercise } from '../analysis/exercises'

const KEY = 'chess.daily.v1'

export interface DailyState {
  date: string                     // YYYY-MM-DD of the puzzle currently selected
  exerciseId: string | null
  solved: boolean
  streak: number
  lastSolvedDate: string | null    // YYYY-MM-DD
}

export function todayString(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function pad(n: number): string { return n.toString().padStart(2, '0') }

function yesterdayOf(today: string): string {
  const [y, m, d] = today.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() - 1)
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`
}

export function loadDaily(): DailyState | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) as DailyState : null
  } catch { return null }
}

export function saveDaily(s: DailyState): void {
  try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* noop */ }
}

// Pick a deterministic puzzle for a given date out of the available exercises.
// Same date + same exercise pool = same puzzle, so reloading does not re-roll.
export function pickDaily(exercises: Exercise[], date: string): Exercise | null {
  if (exercises.length === 0) return null
  let h = 0x811c9dc5
  for (let i = 0; i < date.length; i++) {
    h ^= date.charCodeAt(i)
    h = Math.imul(h, 16777619) >>> 0
  }
  return exercises[h % exercises.length]
}

// Compute the next streak after marking today solved.
export function bumpStreak(prev: DailyState | null, today: string): number {
  if (prev?.lastSolvedDate === today) return prev.streak       // already counted
  if (prev?.lastSolvedDate === yesterdayOf(today)) return (prev.streak ?? 0) + 1
  return 1
}

// If the user missed yesterday's puzzle, reset streak to 0 on app boot.
export function decayStreakIfMissed(prev: DailyState | null, today: string): DailyState | null {
  if (!prev) return prev
  if (prev.solved && prev.date === today) return prev
  const last = prev.lastSolvedDate
  if (!last) return prev
  if (last === today || last === yesterdayOf(today)) return prev
  return { ...prev, streak: 0 }
}
