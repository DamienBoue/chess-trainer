import { describe, expect, it } from 'vitest'
import type { GameAnalysis } from '../types'
import type { ExerciseProgress } from '../storage/persist'
import { isDue } from '../storage/persist'
import { sampleCorpus } from './__fixtures__'
import { emptyIndex, indexExercises, withAnalyses } from './digest'
import { isCurrent, recencyOf, recentGameUrls, resolveDailySession } from './dailyQueue'
import { computeDay, dailyState, emptyToday, staleParts } from './today'

const NOW = Date.UTC(2026, 9, 16, 12)
const DAY_S = 86400
const TODAY = '2026-10-16'

/** 40 games over 160 days, cloned from the sample corpus. */
function history(): GameAnalysis[] {
  const base = sampleCorpus()
  return Array.from({ length: 40 }, (_, i) => {
    const a = base[i % base.length]
    // Old games get positions of their own (no recent game reaches them).
    const moves = i < 30 ? a.moves : a.moves.map(m => ({ ...m, fenBefore: m.fenBefore.split(' ').map((f, k) => (k === 3 ? `o${i}` : f)).join(' ') }))
    return { ...a, moves, url: `${a.url}-${i}`, endTime: Math.round(NOW / 1000 - i * 4 * DAY_S) }
  })
}

describe('the day from the recent games only', () => {
  it('picks the same session and counts as with every analysis', () => {
    const all = history()
    const index = withAnalyses(emptyIndex(), all)
    const exercises = indexExercises(index)
    const urls = new Set(recentGameUrls(Object.values(index.games), NOW))
    expect(urls.size).toBeLessThan(all.length)
    const recent = all.filter(a => urls.has(a.url))

    // Some progress: a solved old one (retired), a due one, one seen today.
    const progress: Record<string, ExerciseProgress> = {}
    const old = exercises[exercises.length - 1]
    progress[old.id] = { attempts: 1, successes: 1, failures: 0, lastFirstTry: true, lastSeenAt: NOW - 9e9, nextDueAt: NOW - 1, easeFactor: 2.5 }
    progress[exercises[3].id] = { attempts: 1, successes: 0, failures: 1, lastFirstTry: false, lastSeenAt: NOW - 3 * 864e5, nextDueAt: NOW - 1, easeFactor: 2.5 }

    const { day, session } = computeDay({ index, exercises, recent, progress, stored: null, today: TODAY, now: NOW })
    const full = recencyOf(all, NOW)
    expect(session).toEqual(resolveDailySession(null, exercises, progress, full, TODAY, NOW))

    const startOfDay = new Date(NOW).setHours(0, 0, 0, 0)
    const state = dailyState(day, session, exercises, progress, TODAY, startOfDay)
    const inSession = new Set(session.ids)
    let archived = 0, reserve = 0
    const currentDue: string[] = []
    for (const e of exercises) {
      if (!isCurrent(e, full, progress)) { archived++; continue }
      if (!isDue(progress[e.id])) continue
      currentDue.push(e.id)
      if (!inSession.has(e.id)) reserve++
    }
    expect(state).toMatchObject({ preparing: false, archived, reserve, currentDue, total: session.ids.length })
    expect(archived).toBeGreaterThan(0)
    expect(day.sessionExercises.map(e => e.id).sort()).toEqual([...session.ids].sort())
  })

  it('keeps a session already picked today', () => {
    const all = history()
    const index = withAnalyses(emptyIndex(), all)
    const exercises = indexExercises(index)
    const stored = { date: TODAY, ids: [exercises[5].id] }
    expect(computeDay({ index, exercises, recent: all, progress: {}, stored, today: TODAY, now: NOW }).session).toEqual(stored)
  })

  it('is preparing until the day is worked out', () => {
    expect(dailyState(null, null, [], {}, TODAY, 0).preparing).toBe(true)
    const all = history()
    const index = withAnalyses(emptyIndex(), all)
    const exercises = indexExercises(index)
    const { day, session } = computeDay({ index, exercises, recent: all, progress: {}, stored: null, today: TODAY, now: NOW })
    expect(dailyState(day, session, [], {}, '2026-10-17', 0).preparing).toBe(true)
  })

  it('says what is stale: a new day, new analyses', () => {
    const all = history()
    const index = withAnalyses(emptyIndex(), all.slice(1))
    const exercises = indexExercises(index)
    const { day } = computeDay({ index, exercises, recent: all, progress: {}, stored: null, today: TODAY, now: NOW })
    const cache = { ...emptyToday(), day, plan: { basedOn: day.basedOn, inputs: {} as never } }
    expect(staleParts(cache, index, TODAY)).toEqual({ day: false, plan: false })
    expect(staleParts(cache, index, '2026-10-17')).toEqual({ day: true, plan: false })
    expect(staleParts(cache, withAnalyses(index, all.slice(0, 1)), TODAY)).toEqual({ day: true, plan: true })
    expect(staleParts(emptyToday(), index, TODAY)).toEqual({ day: true, plan: true })
  })
})
