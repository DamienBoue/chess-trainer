// Storage ports (DDD-light): every consumer that needs to persist or read
// user data depends on one of these interfaces, not on a concrete module.
//
// Why bother:
//   - The domain has no business knowing whether storage lives in
//     localStorage, IndexedDB, or someday a server.
//   - Tests can swap a real port for an in-memory fake instead of
//     `vi.stubGlobal('localStorage', ...)` every time.
//   - When we ever add cloud sync, every consumer keeps working — only
//     the implementation changes.
//
// Concrete implementations live in `src/storage/repos.ts`.
// See ARCHITECTURE.md → "Storage layer" for the migration plan.

import type { ExerciseProgress } from './persist'
import type { PlanState } from './plan'
import type { NotesStore, PositionNote } from './notes'
import type { DailyState } from './daily'

/** Spaced-repetition progress for individual exercises (your own blunders). */
export interface ProgressRepo {
  load(): Record<string, ExerciseProgress>
  save(progress: Record<string, ExerciseProgress>): void
}

/** Today's plan: which suggested actions the user has ticked off. */
export interface PlanRepo {
  load(today: string): PlanState
  save(state: PlanState): void
}

/** Personal notes attached to chess positions (keyed by truncated FEN).
 *  An empty/whitespace `text` removes the note. */
export interface NotesRepo {
  load(): NotesStore
  get(fen: string): PositionNote | undefined
  set(fen: string, text: string): NotesStore
}

/** The user's daily-puzzle streak + which puzzle was selected today. */
export interface DailyRepo {
  load(): DailyState | null
  save(state: DailyState): void
}

/** Bundle of all repositories a consumer might need. Tests can pass a
 *  partial bundle, since most consumers only touch one or two. */
export interface Repos {
  progress: ProgressRepo
  plan: PlanRepo
  notes: NotesRepo
  daily: DailyRepo
}
