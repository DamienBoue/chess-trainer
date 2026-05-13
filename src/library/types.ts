// Shared types for the user's local "library" of imported chess books.

export interface BookExercise {
  id: string                 // unique within the book (e.g. "ex-0001")
  n: number                  // book-printed exercise number
  fen: string                // full FEN with side to move
  side: 'w' | 'b'
  moves: string[]            // SAN sequence (user move, opponent move, …)
  firstMoveSan?: string      // first user move SAN, with annotations
  chapter?: string           // book heading at the diagram's position
  page?: number              // PDF page (for diagnostics / "open at page")
  solutionProse?: string     // prose snippet from the solution chapter
}

export interface Book {
  id: string                 // slug derived from title
  title: string              // human-readable
  source: 'pdf' | 'pgn' | 'manual'
  importedAt: string         // ISO timestamp
  exercises: BookExercise[]
  // Optional: notes the user can edit per book (saved on update).
  notes?: string
}

// Per-exercise progress, scoped by book.
export type ExerciseOutcome = 'solved' | 'wrong' | 'revealed'

export interface ExerciseProgress {
  outcome: ExerciseOutcome
  attempts: number
  successes: number
  lastSeenAt: number         // epoch ms
}

export interface BookProgress {
  bookId: string
  // exerciseId → progress
  byExercise: Record<string, ExerciseProgress>
  // Rush sessions store the last reached exercise # per book so the user
  // can "continue where I left off".
  lastReachedN?: number
}
