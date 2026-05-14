// Games + analyses storage has moved to IndexedDB (see ../storage/games.ts
// and ../storage/analyses.ts). Re-exported here so existing import paths
// keep working.

import { loadJson, saveJson } from './json'
import { KEYS } from './keys'
export { loadGames, saveGames, clearGames } from './games'
export { loadAnalyses, saveAnalyses, clearAnalyses } from './analyses'

const PROGRESS_KEY = KEYS.exerciseProgress

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
  return loadJson(PROGRESS_KEY, {})
}

export function saveProgress(progress: Record<string, ExerciseProgress>): void {
  saveJson(PROGRESS_KEY, progress)
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

// Repertoire SRS progress lives under its own key — same shape, separate
// namespace so an exercise id never collides with a drill-card id.
const REPERTOIRE_PROGRESS_KEY = KEYS.repertoireProgress

export function loadRepertoireProgress(): Record<string, ExerciseProgress> {
  return loadJson(REPERTOIRE_PROGRESS_KEY, {})
}

export function saveRepertoireProgress(progress: Record<string, ExerciseProgress>): void {
  saveJson(REPERTOIRE_PROGRESS_KEY, progress)
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
