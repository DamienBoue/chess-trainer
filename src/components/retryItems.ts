// Review items of a game (player's mistakes + strategic misses), using the
// cached strategic review so the list is cheap to recompute.

import type { GameAnalysis } from '../types'
import { buildRetryItems, type RetryItem } from '../analysis/retry'
import type { GameEvent } from '../strategy/game'
import { reviewOf } from './useStrategyReviews'

export function retryItemsFor(analysis: GameAnalysis): RetryItem[] {
  let events: GameEvent[] = []
  try { events = reviewOf(analysis).events } catch { /* strategic review is optional */ }
  return buildRetryItems(analysis, events)
}
