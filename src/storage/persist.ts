import type { GameAnalysis } from '../types'

const VERSION = 'v1'

function analysesKey(username: string): string {
  return `chess.analyses.${username.toLowerCase()}.${VERSION}`
}
const PROGRESS_KEY = `chess.progress.${VERSION}`

export function loadAnalyses(username: string): Record<string, GameAnalysis> {
  if (!username) return {}
  try {
    const raw = localStorage.getItem(analysesKey(username))
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, GameAnalysis>
    return parsed
  } catch (e) {
    console.warn('[storage] failed to load analyses:', e)
    return {}
  }
}

export function saveAnalyses(username: string, analyses: Record<string, GameAnalysis>): void {
  if (!username) return
  try {
    localStorage.setItem(analysesKey(username), JSON.stringify(analyses))
  } catch (e) {
    console.warn('[storage] failed to save analyses (quota?):', e)
  }
}

export interface ExerciseProgress {
  attempts: number
  successes: number
  failures: number
  // Whether the *most recent* successful attempt was on the first try.
  lastFirstTry: boolean
  lastSeenAt: number
  nextDueAt: number     // unix ms; <= now means "due"
  easeFactor: number    // SM-2 ease, 1.3..3.5
}

export function loadProgress(): Record<string, ExerciseProgress> {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as Record<string, ExerciseProgress>
  } catch (e) {
    console.warn('[storage] failed to load progress:', e)
    return {}
  }
}

export function saveProgress(progress: Record<string, ExerciseProgress>): void {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress))
  } catch (e) {
    console.warn('[storage] failed to save progress:', e)
  }
}

const DAY_MS = 86400_000

// SM-2-lite: success grows the interval geometrically, failure resets it.
// First-try success boosts ease, hint/retry leaves it flat, failure shrinks it.
export function updateProgressAfterAttempt(
  prev: ExerciseProgress | undefined,
  outcome: 'first-try' | 'after-retry' | 'failed' | 'revealed',
): ExerciseProgress {
  const now = Date.now()
  const ease = prev?.easeFactor ?? 2.5
  const successes = (prev?.successes ?? 0) + (outcome === 'failed' || outcome === 'revealed' ? 0 : 1)
  const failures = (prev?.failures ?? 0) + (outcome === 'failed' || outcome === 'revealed' ? 1 : 0)
  const attempts = (prev?.attempts ?? 0) + 1

  let intervalMs: number
  let newEase = ease
  switch (outcome) {
    case 'first-try': {
      newEase = Math.min(3.5, ease + 0.1)
      // 1d → 3d → 7d → 14d → 30d → 60d
      const streak = successes
      const days = streak <= 1 ? 1 : streak === 2 ? 3 : streak === 3 ? 7 : streak === 4 ? 14 : streak === 5 ? 30 : 60
      intervalMs = days * DAY_MS * (newEase / 2.5)
      break
    }
    case 'after-retry': {
      // Don't grow ease; small interval bump
      const days = Math.max(1, Math.min(7, successes))
      intervalMs = days * DAY_MS
      break
    }
    case 'failed':
    case 'revealed': {
      newEase = Math.max(1.3, ease - 0.2)
      intervalMs = DAY_MS  // re-show tomorrow
      break
    }
  }

  return {
    attempts,
    successes,
    failures,
    lastFirstTry: outcome === 'first-try',
    lastSeenAt: now,
    nextDueAt: now + intervalMs,
    easeFactor: newEase,
  }
}

export function isDue(progress: ExerciseProgress | undefined, now: number = Date.now()): boolean {
  if (!progress) return true            // never seen → always due
  return progress.nextDueAt <= now
}

// Group/derive helpers
export function progressSummary(progress: Record<string, ExerciseProgress>) {
  const list = Object.values(progress)
  const totalSeen = list.length
  const totalAttempts = list.reduce((s, p) => s + p.attempts, 0)
  const totalSuccesses = list.reduce((s, p) => s + p.successes, 0)
  const accuracy = totalAttempts ? totalSuccesses / totalAttempts : 0
  return { totalSeen, totalAttempts, totalSuccesses, accuracy }
}
