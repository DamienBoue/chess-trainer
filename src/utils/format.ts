// Tiny shared formatters.

/** Number of days between `endTimeSec` (Unix seconds) and now. Always
 *  non-negative — past dates only. */
export function daysAgo(endTimeSec: number): number {
  return Math.max(0, Math.floor((Date.now() / 1000 - endTimeSec) / 86400))
}

/** Locale date string from an epoch second value. */
export function formatDate(epochSec: number): string {
  return new Date(epochSec * 1000).toLocaleDateString()
}
