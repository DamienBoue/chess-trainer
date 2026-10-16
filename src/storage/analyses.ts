// Stockfish analyses per username, one record per game
// ("<user>|<game url>"): a new analysis writes itself only, and a screen
// that shows one game reads that game only.
//
// Older layouts migrate on first read (one record per user in IndexedDB
// v3, before it a localStorage key), with the move metrics fix below
// applied once on the way.

import type { GameAnalysis } from '../types'
import { recomputeMoveMetrics } from '../analysis/analyze'
import { dbDeleteMany, dbGetAllByPrefix, dbPutMany, dbTx } from './db'

const STORE = 'analysisItems'
const LEGACY_STORE = 'analyses'
const LEGACY_KEY = (username: string) => `chess.analyses.${username.toLowerCase()}.v1`

interface AnalysisRecord { key: string; username: string; analysis: GameAnalysis }
interface LegacyRecord { username: string; analyses: Record<string, GameAnalysis> }

const userOf = (username: string) => username.toLowerCase()
const keyOf = (username: string, url: string) => `${userOf(username)}|${url}`

// Analyses saved before the "mate 0" sign fix scored a checkmate on the
// board as won by the mated side, so the mating move read as a blunder.
function checkmateEval(m: { san: string; fenBefore: string; evalAfter: number }): number {
  if (!m.san.endsWith('#')) return m.evalAfter
  const moverSign = m.fenBefore.split(' ')[1] === 'w' ? 1 : -1
  return moverSign * m.evalAfter < 0 ? -m.evalAfter : m.evalAfter
}

export function migrateMoveMetrics(parsed: Record<string, GameAnalysis>): {
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
      const evalAfter = checkmateEval(m)
      const { cpLoss, classification } = recomputeMoveMetrics({ ...m, evalAfter }, i)
      if (evalAfter !== m.evalAfter || cpLoss !== m.cpLoss || classification !== m.classification) dirty = true
      return { ...m, evalAfter, cpLoss, classification }
    })
    parsed[url] = { ...a, moves: fixed }
  }
  return { fixed: parsed, dirty }
}

let migrated = new Set<string>()

async function migrate(username: string): Promise<void> {
  const user = userOf(username)
  if (migrated.has(user)) return
  migrated.add(user)
  let found: Record<string, GameAnalysis> | null = null
  const old = await dbTx<LegacyRecord | undefined>(LEGACY_STORE, 'readonly', s => s.get(user))
  if (old) found = old.analyses
  else {
    try {
      const raw = localStorage.getItem(LEGACY_KEY(username))
      if (raw) found = JSON.parse(raw) as Record<string, GameAnalysis>
    } catch (e) {
      console.warn('[storage] legacy analyses migration failed:', e)
    }
  }
  if (!found) return
  const { fixed } = migrateMoveMetrics(found)
  await saveAnalyses(username, Object.values(fixed))
  if (old) await dbTx(LEGACY_STORE, 'readwrite', s => s.delete(user))
  localStorage.removeItem(LEGACY_KEY(username))
}

/** Every analysis of the user, by game url. */
export async function loadAnalyses(username: string): Promise<Record<string, GameAnalysis>> {
  if (!username) return {}
  await migrate(username)
  const records = await dbGetAllByPrefix<AnalysisRecord>(STORE, `${userOf(username)}|`)
  return Object.fromEntries(records.map(r => [r.analysis.url, r.analysis]))
}

/** The analyses of these games (the ones stored). */
export async function loadAnalysesOf(username: string, urls: string[]): Promise<GameAnalysis[]> {
  if (!username || urls.length === 0) return []
  await migrate(username)
  const out: GameAnalysis[] = []
  for (const url of urls) {
    const r = await dbTx<AnalysisRecord | undefined>(STORE, 'readonly', s => s.get(keyOf(username, url)))
    if (r) out.push(r.analysis)
  }
  return out
}

/** Stores these analyses (a game analysed again replaces its record). */
export async function saveAnalyses(username: string, list: GameAnalysis[]): Promise<void> {
  if (!username || list.length === 0) return
  const user = userOf(username)
  await dbPutMany(STORE, list.map(a => ({ key: keyOf(username, a.url), username: user, analysis: a })))
}

export async function clearAnalyses(username: string): Promise<void> {
  if (!username) return
  const records = await dbGetAllByPrefix<AnalysisRecord>(STORE, `${userOf(username)}|`)
  await dbDeleteMany(STORE, records.map(r => r.key))
  await dbTx(LEGACY_STORE, 'readwrite', s => s.delete(userOf(username)))
}

/** Tests: forget which users were migrated. */
export function resetAnalysesMigration() {
  migrated = new Set()
}
