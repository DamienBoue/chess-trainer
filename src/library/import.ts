// Book import + migration helpers.

import type { Book, BookExercise } from './types'
import { saveBook, listBooks, saveProgress, getProgress } from './storage'

// Validate that an arbitrary parsed JSON looks like a Book before saving.
// Throws with a user-friendly message if not.
export function validateBookJson(raw: unknown): Book {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Le fichier ne contient pas un objet JSON valide.')
  }
  const obj = raw as Record<string, unknown>
  const exercises = obj.exercises
  if (!Array.isArray(exercises) || exercises.length === 0) {
    throw new Error('Le fichier ne contient aucun exercice (clé "exercises" manquante ou vide).')
  }
  const validated: BookExercise[] = []
  for (const e of exercises as Record<string, unknown>[]) {
    if (typeof e.fen !== 'string' || !e.fen.includes(' ')) continue
    const moves = Array.isArray(e.moves) ? e.moves.filter(m => typeof m === 'string') as string[] : []
    validated.push({
      id: typeof e.id === 'string' ? e.id : `ex-${(e.n as number | undefined) ?? validated.length + 1}`,
      n: typeof e.n === 'number' ? e.n : validated.length + 1,
      fen: e.fen,
      side: (e.fen.split(' ')[1] === 'b' ? 'b' : 'w'),
      moves,
      firstMoveSan: typeof e.firstMoveSan === 'string' ? e.firstMoveSan : moves[0],
      chapter: typeof e.chapter === 'string' ? e.chapter : undefined,
      page: typeof e.page === 'number' ? e.page : undefined,
      solutionProse: typeof e.solutionProse === 'string'
        ? e.solutionProse
        : typeof (e as Record<string, unknown>).line === 'string'
          ? (e as { line: string }).line
          : undefined,
    })
  }
  if (validated.length === 0) {
    throw new Error('Aucun exercice exploitable trouvé (FEN manquante sur toutes les entrées).')
  }
  const title = typeof obj.title === 'string' && obj.title ? obj.title : 'Livre sans titre'
  const id = typeof obj.id === 'string' && obj.id ? obj.id : slugify(title)
  return {
    id,
    title,
    source: (obj.source === 'pgn' || obj.source === 'manual') ? obj.source : 'pdf',
    importedAt: typeof obj.importedAt === 'string' ? obj.importedAt : new Date().toISOString(),
    exercises: validated,
    notes: typeof obj.notes === 'string' ? obj.notes : undefined,
  }
}

function slugify(s: string): string {
  return s.normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'book'
}

// One-shot migration from the old localStorage-based "woodpecker.progress"
// key (set by the previous WoodpeckerView) into the new per-book progress
// store. Idempotent: runs only when no Woodpecker progress exists in IndexedDB
// AND a local woodpecker.json bundle is available (the user re-imported it).
export async function migrateLegacyWoodpeckerProgress(): Promise<void> {
  const legacyKey = 'woodpecker.progress'
  const raw = localStorage.getItem(legacyKey)
  if (!raw) return
  let legacy: Record<string, 'solved' | 'wrong' | 'revealed'>
  try { legacy = JSON.parse(raw) } catch { return }
  // Find a book whose ids resemble the legacy ones (wp-<n>).
  const books = await listBooks()
  const candidate = books.find(b => b.exercises.some(e => /^wp-\d+$/.test(e.id)))
  if (!candidate) return
  const progress = await getProgress(candidate.id)
  for (const [exId, outcome] of Object.entries(legacy)) {
    if (progress.byExercise[exId]) continue
    progress.byExercise[exId] = {
      outcome,
      attempts: 1,
      successes: outcome === 'solved' ? 1 : 0,
      lastSeenAt: Date.now(),
    }
  }
  await saveProgress(progress)
  // Keep the legacy key around for safety; nuke only after a release cycle.
}

// Read a File (from <input type=file>) as JSON and save the resulting book.
export async function importBookFromFile(file: File): Promise<Book> {
  const text = await file.text()
  let raw: unknown
  try { raw = JSON.parse(text) }
  catch { throw new Error('Fichier JSON invalide.') }
  const book = validateBookJson(raw)
  await saveBook(book)
  return book
}
