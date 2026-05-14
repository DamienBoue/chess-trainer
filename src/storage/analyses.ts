// Stockfish-analysed games per username, backed by IndexedDB.
//
// localStorage's ~5 MB quota would cap us at ~3000 analysed games. Moving
// to IDB lifts that ceiling without changing call sites.
//
// On first read we migrate from localStorage and then delete the legacy
// key so the quota is freed.

import type { GameAnalysis } from '../types'
import { recomputeMoveMetrics } from '../analysis/analyze'
import { dbTx } from './db'

const STORE = 'analyses'
const LEGACY_KEY = (username: string) => `chess.analyses.${username.toLowerCase()}.v1`

interface AnalysesRecord {
  username: string
  analyses: Record<string, GameAnalysis>
}

function migrateMoveMetrics(parsed: Record<string, GameAnalysis>): {
  fixed: Record<string, GameAnalysis>
  dirty: boolean
} {
  // Recompute cpLoss + classification from stored evals so older analyses
  // (saved before the mate-score clamp fix) get sane values. Same logic
  // the original localStorage loader did.
  let dirty = false
  for (const url of Object.keys(parsed)) {
    const a = parsed[url]
    const fixed = a.moves.map((m, i) => {
      const { cpLoss, classification } = recomputeMoveMetrics(m, i)
      if (cpLoss !== m.cpLoss || classification !== m.classification) dirty = true
      return { ...m, cpLoss, classification }
    })
    parsed[url] = { ...a, moves: fixed }
  }
  return { fixed: parsed, dirty }
}

export async function loadAnalyses(username: string): Promise<Record<string, GameAnalysis>> {
  if (!username) return {}
  const key = username.toLowerCase()
  const found = await dbTx<AnalysesRecord | undefined>(STORE, 'readonly', s => s.get(key))
  if (found) {
    const { fixed, dirty } = migrateMoveMetrics(found.analyses)
    if (dirty) await saveAnalyses(username, fixed)
    return fixed
  }
  // Lazy migrate from localStorage.
  try {
    const raw = localStorage.getItem(LEGACY_KEY(username))
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, GameAnalysis>
      const { fixed } = migrateMoveMetrics(parsed)
      await saveAnalyses(username, fixed)
      localStorage.removeItem(LEGACY_KEY(username))
      return fixed
    }
  } catch (e) {
    console.warn('[storage] legacy analyses migration failed:', e)
  }
  return {}
}

export async function saveAnalyses(
  username: string,
  analyses: Record<string, GameAnalysis>,
): Promise<void> {
  if (!username) return
  await dbTx(STORE, 'readwrite', s => s.put({ username: username.toLowerCase(), analyses }))
}

export async function clearAnalyses(username: string): Promise<void> {
  if (!username) return
  await dbTx(STORE, 'readwrite', s => s.delete(username.toLowerCase()))
}
