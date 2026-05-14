// Tiny helpers for the "parse a JSON object stored in localStorage with
// a fallback if missing/corrupt" pattern. Used wherever small state
// (settings, SRS progress, plan completion) is serialised.

export function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch (e) {
    console.warn(`[storage] failed to load ${key}:`, e)
    return fallback
  }
}

export function saveJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (e) {
    console.warn(`[storage] failed to save ${key}:`, e)
  }
}
