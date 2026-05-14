// Personal annotations per position. Keyed by truncated FEN so the
// same position reached in different games shares the same note.
// Stored as a single localStorage blob — these are short text snippets.

import { loadJson, saveJson } from './json'
import { positionKey } from '../utils/move'

const KEY = 'chess.notes.v1'

export interface PositionNote {
  text: string
  updatedAt: number
}

export type NotesStore = Record<string, PositionNote>

export function loadNotes(): NotesStore {
  return loadJson<NotesStore>(KEY, {})
}

export function getNote(fen: string): PositionNote | undefined {
  return loadNotes()[positionKey(fen)]
}

export function setNote(fen: string, text: string): NotesStore {
  const k = positionKey(fen)
  const all = loadNotes()
  const trimmed = text.trim()
  if (trimmed.length === 0) {
    delete all[k]
  } else {
    all[k] = { text: trimmed, updatedAt: Date.now() }
  }
  saveJson(KEY, all)
  return all
}

export function listNotesWithFen(): Array<{ key: string; note: PositionNote }> {
  return Object.entries(loadNotes())
    .map(([key, note]) => ({ key, note }))
    .sort((a, b) => b.note.updatedAt - a.note.updatedAt)
}
