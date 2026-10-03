// Strategic reviews of all analysed games, computed in small batches so
// the UI never freezes (~10 ms per game), and cached per game for the
// whole session (the profile and the trainer share them).

import { useEffect, useMemo, useState } from 'react'
import type { GameAnalysis } from '../types'
import { type GameStrategyReview, reviewGameStrategy } from '../strategy/game'

const cache = new Map<string, GameStrategyReview>()

/** Cache key: an analysis is immutable once computed, but re-analysing a
 *  game (deeper engine) produces a new one with the same URL. */
function keyOf(a: GameAnalysis): string {
  return `${a.url}#${a.moves.length}#${a.moves.reduce((s, m) => s + m.cpLoss, 0)}`
}

export function cachedReview(a: GameAnalysis): GameStrategyReview | undefined {
  return cache.get(keyOf(a))
}

export function reviewOf(a: GameAnalysis): GameStrategyReview {
  const k = keyOf(a)
  let r = cache.get(k)
  if (!r) {
    r = reviewGameStrategy(a)
    cache.set(k, r)
  }
  return r
}

export interface ReviewsState {
  /** Reviews keyed by game URL, available once `done`. */
  reviews: Map<string, GameStrategyReview>
  done: number
  total: number
  ready: boolean
}

const BATCH = 8

export function useStrategyReviews(analyses: GameAnalysis[]): ReviewsState {
  const total = analyses.length
  // Fast path: every game already reviewed this session.
  const cachedAll = useMemo(() => {
    const m = new Map<string, GameStrategyReview>()
    for (const a of analyses) {
      const r = cachedReview(a)
      if (!r) return null
      m.set(a.url, r)
    }
    return m
  }, [analyses])
  const [progress, setProgress] = useState<{ key: GameAnalysis[]; reviews: Map<string, GameStrategyReview>; done: number } | null>(null)

  useEffect(() => {
    if (cachedAll) return
    let cancelled = false
    let timer = 0
    const reviews = new Map<string, GameStrategyReview>()
    const todo: GameAnalysis[] = []
    for (const a of analyses) {
      const hit = cachedReview(a)
      if (hit) reviews.set(a.url, hit)
      else todo.push(a)
    }
    let i = 0
    function step() {
      if (cancelled) return
      const end = Math.min(i + BATCH, todo.length)
      for (; i < end; i++) {
        try { reviews.set(todo[i].url, reviewOf(todo[i])) } catch (e) { console.warn('[strategy] review failed', todo[i].url, e) }
      }
      const finished = i >= todo.length
      setProgress({ key: analyses, reviews: finished ? reviews : new Map(reviews), done: analyses.length - (todo.length - i) })
      if (!finished) timer = window.setTimeout(step, 0)
    }
    timer = window.setTimeout(step, 0)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [analyses, cachedAll])

  // A stable object, so consumers can memoise on it.
  return useMemo<ReviewsState>(() => {
    if (cachedAll) return { reviews: cachedAll, done: total, total, ready: true }
    if (progress && progress.key === analyses) {
      return { reviews: progress.reviews, done: progress.done, total, ready: progress.done >= total }
    }
    return { reviews: new Map(), done: 0, total, ready: total === 0 }
  }, [cachedAll, progress, analyses, total])
}
