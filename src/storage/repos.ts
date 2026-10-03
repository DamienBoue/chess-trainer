// Concrete repository implementations.
//
// `localRepos()` is the production wiring: every port forwards to the
// existing localStorage-backed modules. Components should depend on the
// `Repos` interface (see `./ports`), not on the underlying modules
// directly. That keeps storage decisions reversible.
//
// `inMemoryRepos()` is for tests: same shape, all state in a JS object,
// no localStorage stubbing needed. The interfaces are the same so a test
// can build a small `Repos` object, drop it into a consumer, and assert
// on what got saved.

import type { DailyRepo, NotesRepo, PlanRepo, ProgressRepo, Repos } from './ports'
import { loadProgress, saveProgress, type ExerciseProgress } from './persist'
import { loadPlanState, savePlanState, type PlanState } from './plan'
import { loadNotes, getNote, setNote, type NotesStore, type PositionNote } from './notes'
import { loadDaily, saveDaily, type DailyState } from './daily'

// ---------- Production wiring ---------------------------------------------

const localProgressRepo: ProgressRepo = {
  load: () => loadProgress(),
  save: p => saveProgress(p),
}

const localPlanRepo: PlanRepo = {
  load: today => loadPlanState(today),
  save: s => savePlanState(s),
}

const localNotesRepo: NotesRepo = {
  load: () => loadNotes(),
  get: fen => getNote(fen),
  set: (fen, text) => setNote(fen, text),
}

const localDailyRepo: DailyRepo = {
  load: () => loadDaily(),
  save: s => saveDaily(s),
}

export function localRepos(): Repos {
  return {
    progress: localProgressRepo,
    plan: localPlanRepo,
    notes: localNotesRepo,
    daily: localDailyRepo,
  }
}

// ---------- In-memory implementation (tests) ------------------------------

export function inMemoryRepos(initial: Partial<{
  progress: Record<string, ExerciseProgress>
  plan: PlanState | null
  notes: NotesStore
  daily: DailyState | null
}> = {}): Repos {
  let progress = { ...(initial.progress ?? {}) }
  let plan: PlanState | null = initial.plan ?? null
  const notes: NotesStore = { ...(initial.notes ?? {}) }
  let daily: DailyState | null = initial.daily ?? null

  // Match notes.ts: an empty FEN key is identical to its positionKey here.
  // Tests can use whatever key shape they want as long as they're consistent.
  function noteKey(fen: string): string {
    // Strip move counters from FEN to align with positionKey() semantics
    // without importing chess.js.
    return fen.split(' ').slice(0, 4).join(' ')
  }

  // Deep-clone on read AND write so callers can't mutate stored state by
  // holding onto a reference. Matches localStorage's JSON round-trip
  // semantics.
  const clone = <T>(v: T): T => structuredClone(v)

  return {
    progress: {
      load: () => clone(progress),
      save: p => { progress = clone(p) },
    },
    plan: {
      load: today => plan && plan.date === today ? plan : { date: today, done: [] },
      save: s => { plan = s },
    },
    notes: {
      load: () => ({ ...notes }),
      get: fen => notes[noteKey(fen)],
      set: (fen, text) => {
        const k = noteKey(fen)
        const t = text.trim()
        if (t.length === 0) delete notes[k]
        else notes[k] = { text: t, updatedAt: Date.now() } satisfies PositionNote
        return { ...notes }
      },
    },
    daily: {
      load: () => daily,
      save: s => { daily = s },
    },
  }
}
