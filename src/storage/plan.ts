// Tracks which plan items the user has marked done today.
// Plan item ids are stable for a given (date, data) pair so we can resume
// progress across reloads.

const KEY = 'chess.plan.v1'

export interface PlanState {
  date: string                 // YYYY-MM-DD
  done: string[]               // ids of completed plan items
}

export function loadPlanState(today: string): PlanState {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { date: today, done: [] }
    const parsed = JSON.parse(raw) as PlanState
    // Reset for a new day.
    if (parsed.date !== today) return { date: today, done: [] }
    return parsed
  } catch {
    return { date: today, done: [] }
  }
}

export function savePlanState(state: PlanState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch (e) {
    console.warn('[plan] save failed:', e)
  }
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
