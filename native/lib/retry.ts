import type { GameAnalysis } from '@shared/types'
import { buildRetryItems, type RetryItem } from '@shared/analysis/retry'
import { strategyReviewOf } from './analysis'

/** The positions to replay in "Revoir mes erreurs" (errors + missed plans). */
export function retryItemsFor(a: GameAnalysis): RetryItem[] {
  return buildRetryItems(a, strategyReviewOf(a)?.events ?? [])
}
