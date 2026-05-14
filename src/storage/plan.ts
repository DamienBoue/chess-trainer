// Tracks which plan items the user has marked done today.
// Plan item ids are stable for a given (date, data) pair so we can resume
// progress across reloads.

import { loadJson, saveJson } from './json'
import { KEYS } from './keys'

const KEY = KEYS.plan

export interface PlanState {
  date: string                 // YYYY-MM-DD
  done: string[]               // ids of completed plan items
}

export function loadPlanState(today: string): PlanState {
  const parsed = loadJson<PlanState>(KEY, { date: today, done: [] })
  // Reset for a new day.
  if (parsed.date !== today) return { date: today, done: [] }
  return parsed
}

export function savePlanState(state: PlanState): void {
  saveJson(KEY, state)
}

export function markPlanItemDone(today: string, id: string): PlanState {
  const cur = loadPlanState(today)
  if (cur.done.includes(id)) return cur
  const next = { ...cur, done: [...cur.done, id] }
  savePlanState(next)
  return next
}

export function unmarkPlanItem(today: string, id: string): PlanState {
  const cur = loadPlanState(today)
  if (!cur.done.includes(id)) return cur
  const next = { ...cur, done: cur.done.filter(x => x !== id) }
  savePlanState(next)
  return next
}
