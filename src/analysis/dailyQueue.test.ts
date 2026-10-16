import { describe, expect, it } from 'vitest'
import type { GameAnalysis } from '../types'
import type { Exercise } from './exercises'
import type { ExerciseProgress } from '../storage/persist'
import {
  DAILY_EXERCISES, extendDailySession, isCurrent, pickDailyExercises, recencyOf, resolveDailySession, sessionProgress,
  type Recency,
} from './dailyQueue'

const NOW = Date.UTC(2026, 9, 16, 12) // 16 Oct 2026, noon
const DAY = 86400
const daysAgo = (d: number) => NOW / 1000 - d * DAY

function ex(id: string, game: string, ageDays: number, cpSwing = 200, fen = `fen-${id} w - - 0 1`): Exercise {
  return { id, fen, cpSwing, context: { gameUrl: game, endTime: daysAgo(ageDays), opponent: 'x', ply: 1, moveLabel: '1.' } } as unknown as Exercise
}
const seen = (o: Partial<ExerciseProgress>): ExerciseProgress =>
  ({ attempts: 1, successes: 0, failures: 1, lastFirstTry: false, lastSeenAt: NOW - 2 * DAY * 1000, nextDueAt: NOW - 1000, easeFactor: 2.5, ...o })
const recent = (games: string[], positions: string[] = []): Recency =>
  ({ games: new Set(games), positions: new Set(positions), retireBefore: daysAgo(182) })

describe('daily exercises', () => {
  it('puts reviews first, then new ones from the most recent game, two per game before a third, the costliest first', () => {
    const exercises = [
      ex('old-review', 'g0', 3), ex('older-review', 'g0', 3),
      ex('a1', 'gA', 1, 100), ex('a2', 'gA', 1, 500), ex('a3', 'gA', 1, 300),
      ex('b1', 'gB', 2, 900),
    ]
    const progress = {
      'old-review': seen({ nextDueAt: NOW - 1000 }),
      'older-review': seen({ nextDueAt: NOW - 5000 }),
    }
    const ids = pickDailyExercises(exercises, progress, recent(['g0', 'gA', 'gB']), NOW)
    expect(ids).toEqual(['older-review', 'old-review', 'a2', 'a3', 'b1', 'a1'])
  })

  it('caps the day at 20 and skips a position already picked', () => {
    const many = Array.from({ length: 40 }, (_, i) => ex(`e${i}`, `g${i}`, 1))
    expect(pickDailyExercises(many, {}, recent(many.map(e => e.context.gameUrl)), NOW)).toHaveLength(DAILY_EXERCISES)
    const twins = [ex('x', 'g1', 1, 300, 'same w - - 0 1'), ex('y', 'g2', 1, 200, 'same w - - 0 9')]
    expect(pickDailyExercises(twins, {}, recent(['g1', 'g2']), NOW)).toEqual(['x'])
  })

  it('keeps only current mistakes: old ones come back if their position is reached again', () => {
    const r = recent(['recent-game'], ['line w - -'])
    expect(isCurrent(ex('new', 'recent-game', 2), r, {})).toBe(true)
    expect(isCurrent(ex('stale', 'old-game', 120), r, {})).toBe(false)
    expect(isCurrent(ex('again', 'old-game', 120, 200, 'line w - - 0 12'), r, {})).toBe(true)
    // Already met: solved long ago retires, still failing stays.
    expect(isCurrent(ex('mastered', 'old-game', 200), r, { mastered: seen({ successes: 2 }) })).toBe(false)
    expect(isCurrent(ex('weak', 'old-game', 200), r, { weak: seen({ successes: 0 }) })).toBe(true)
  })

  it('finds the recent games: the last 30 days, and at least the last 20 games', () => {
    const game = (url: string, age: number, fen = `${url} w - -`) =>
      ({ url, endTime: daysAgo(age), moves: [{ fenBefore: `${fen} 0 1` }] }) as unknown as GameAnalysis
    const lastMonth = recencyOf([game('fresh', 5), ...Array.from({ length: 25 }, (_, i) => game(`old${i}`, 60 + i))], NOW)
    expect(lastMonth.games.has('fresh')).toBe(true)
    expect(lastMonth.games.has('old0')).toBe(true)   // among the 20 last games
    expect(lastMonth.games.has('old24')).toBe(false)
    expect(lastMonth.positions.has('fresh w - -')).toBe(true)
  })

  it('freezes the session for the day, picks again the next day, and can add more', () => {
    const exercises = Array.from({ length: 30 }, (_, i) => ex(`e${i}`, `g${i}`, 1))
    const r = recent(exercises.map(e => e.context.gameUrl))
    const first = resolveDailySession(null, exercises, {}, r, '2026-10-16', NOW)
    expect(first.ids).toHaveLength(20)
    // Solving one doesn't change the day's list.
    const progress = { [first.ids[0]]: seen({ successes: 1, lastSeenAt: NOW, nextDueAt: NOW + 3 * DAY * 1000 }) }
    expect(resolveDailySession(first, exercises, progress, r, '2026-10-16', NOW)).toBe(first)
    expect(sessionProgress(first, progress, NOW - 3600_000)).toMatchObject({ total: 20, done: 1 })
    // An empty session (no games yet) is picked again; a new day too.
    expect(resolveDailySession({ date: '2026-10-16', ids: [] }, exercises, {}, r, '2026-10-16', NOW).ids).toHaveLength(20)
    expect(resolveDailySession(first, exercises, progress, r, '2026-10-17', NOW).date).toBe('2026-10-17')
    // "Encore": ten more, none already in the session.
    const more = extendDailySession(first, exercises, progress, r, NOW)
    expect(more.ids).toHaveLength(30)
    expect(new Set(more.ids).size).toBe(30)
  })
})
