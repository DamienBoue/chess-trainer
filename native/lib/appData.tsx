// The app's data, as on the website (src/App.tsx): the chess.com account,
// its games and analyses (persisted per user), the exercise progress and
// the shared Stockfish engine.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { AppState } from 'react-native'
import type { ChessComGame, GameAnalysis } from '@shared/types'
import { getRecentGames } from '@shared/api/chesscom'
import {
  loadAnalyses, saveAnalyses, loadGames, saveGames, loadProgress, saveProgress,
  updateProgressAfterAttempt, type ExerciseProgress,
} from '@shared/storage/persist'
import { analyzeGame } from '@shared/analysis/analyze'
import { StockfishEngine } from '@shared/engine/stockfish'
import { getEngineDepth } from '@shared/storage/settings'
import { extractExercises, type Exercise } from '@shared/analysis/exercises'
import {
  extendDailySession, isCurrent, recencyOf, resolveDailySession, sessionProgress, type DailySession,
} from '@shared/analysis/dailyQueue'
import { loadDailySession, saveDailySession } from '@shared/storage/dailyQueue'
import { todayString } from '@shared/storage/daily'
import { isDue } from '@shared/storage/persist'
import { lastSyncAt, syncNewGames } from './sync'
import { syncOnce, type LocalStore } from '@shared/sync/engine'
import { KEYS } from '@shared/storage/keys'
import { supabase } from './supabase'
import { loadSyncState, saveSyncState, supabaseRemote } from './cloud'

type Outcome = Parameters<typeof updateProgressAfterAttempt>[1]

export interface AnalyzeState { url: string; done: number; total: number }

/** The account the data is shared with (phone ↔ PC), when signed in. */
export interface CloudState {
  user: { id: string; email: string } | null
  syncing: boolean
  syncedAt: number | null
  error: string | null
}

/** Today's exercise session (see @shared/analysis/dailyQueue). */
export interface DailyExercises {
  /** Ids in play order; `remaining` are the ones not attempted today. */
  ids: string[]
  remaining: string[]
  done: number
  total: number
  /** Current exercises due but not in today's session. */
  reserve: number
  /** Every current exercise that is due (today's remaining + the reserve). */
  currentDue: string[]
  /** Exercises no longer current (old mistakes), out of every count. */
  archived: number
}

interface AppData {
  username: string
  /** Games and analyses are loaded from storage. */
  hydrated: boolean
  games: ChessComGame[]
  analyses: Record<string, GameAnalysis>
  progress: Record<string, ExerciseProgress>
  analyzing: AnalyzeState | null
  /** Checking chess.com for new games. */
  syncing: boolean
  /** When the games were last checked (ms). */
  lastSync: number
  exercises: Exercise[]
  daily: DailyExercises
  cloud: CloudState
  /** Pulls and pushes the shared data now. */
  syncCloud(): Promise<void>
  /** "Encore": a few more exercises in today's session. */
  extendDaily(): void
  login(username: string): Promise<void>
  logout(): void
  /** Fetches the games played since the last one (and analyses them). */
  reloadGames(): Promise<void>
  analyze(game: ChessComGame): Promise<GameAnalysis>
  recordAttempt(id: string, outcome: Outcome): void
  engine(): StockfishEngine
}

const Ctx = createContext<AppData | null>(null)

let sharedEngine: StockfishEngine | null = null
function getEngine(): StockfishEngine {
  if (!sharedEngine) sharedEngine = new StockfishEngine()
  return sharedEngine
}

const USERNAME_KEY = 'chess.username'
/** New games are analysed on their own, this many at a time at most. */
const AUTO_ANALYSE_MAX = 10
/** Back to the foreground: check again after this long. */
const SYNC_EVERY_MS = 2 * 60_000

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const [username, setUsername] = useState(() => localStorage.getItem(USERNAME_KEY) ?? '')
  const [games, setGames] = useState<ChessComGame[]>([])
  const [analyses, setAnalyses] = useState<Record<string, GameAnalysis>>({})
  const [progress, setProgress] = useState<Record<string, ExerciseProgress>>(() => loadProgress())
  const [hydrated, setHydrated] = useState(false)
  const [analyzing, setAnalyzing] = useState<AnalyzeState | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [lastSync, setLastSync] = useState(() => lastSyncAt())
  const [cloud, setCloud] = useState<CloudState>({ user: null, syncing: false, syncedAt: null, error: null })
  // Saving starts once the stored state is loaded, never over it.
  const loadedFor = useRef<string | null>(null)

  useEffect(() => {
    loadedFor.current = null
    if (!username) return
    let cancelled = false
    Promise.all([loadGames(username), loadAnalyses(username)]).then(([g, a]) => {
      if (cancelled) return
      setGames(prev => {
        if (prev.length === 0) return g
        const seen = new Set(prev.map(x => x.url))
        return [...prev, ...g.filter(x => !seen.has(x.url))]
      })
      setAnalyses(a)
      loadedFor.current = username
      setHydrated(true)
    })
    return () => { cancelled = true }
  }, [username])

  useEffect(() => { if (username && loadedFor.current === username) void saveAnalyses(username, analyses) }, [analyses, username])
  useEffect(() => { if (username && loadedFor.current === username) void saveGames(username, games) }, [games, username])

  // The latest analyses, for the automatic ones (never analyse a game twice).
  const analysesRef = useRef(analyses)
  useEffect(() => { analysesRef.current = analyses }, [analyses])

  // One analysis at a time (taps and automatic ones share the engine).
  const chain = useRef<Promise<unknown>>(Promise.resolve())
  const analyze = useCallback((game: ChessComGame): Promise<GameAnalysis> => {
    const run = async () => {
      setAnalyzing({ url: game.url, done: 0, total: 0 })
      try {
        const result = await analyzeGame(getEngine(), game, username, {
          depth: getEngineDepth(),
          movetimeMs: 600,
          onProgress: p => setAnalyzing({ url: game.url, done: p.done, total: p.total }),
        })
        setAnalyses(prev => ({ ...prev, [result.url]: result }))
        return result
      } finally {
        setAnalyzing(null)
      }
    }
    const next = chain.current.then(run, run)
    chain.current = next.catch(() => undefined)
    return next
  }, [username])

  // New games since the last check, then their analysis: at launch, and
  // when the app comes back to the foreground (the page shown again, on the
  // web). Phones also check in the background (lib/backgroundSync.ts).
  const syncingRef = useRef(false)
  const sync = useCallback(async () => {
    if (!username || syncingRef.current) return
    syncingRef.current = true
    setSyncing(true)
    try {
      const { games: merged, added } = await syncNewGames(username)
      setGames(prev => {
        const known = new Set(merged.map(g => g.url))
        return [...merged, ...prev.filter(g => !known.has(g.url))]
      })
      setLastSync(lastSyncAt())
      const toAnalyse = added.filter(g => !analysesRef.current[g.url]).slice(0, AUTO_ANALYSE_MAX)
      for (const g of toAnalyse) void analyze(g).catch(() => undefined)
    } catch {
      // Offline or chess.com down: the next foreground will try again.
    } finally {
      syncingRef.current = false
      setSyncing(false)
    }
  }, [username, analyze])

  useEffect(() => {
    if (!hydrated || !username) return
    void sync()
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active' && Date.now() - lastSyncAt() > SYNC_EVERY_MS) void sync()
    })
    return () => sub.remove()
  }, [hydrated, username, sync])

  useEffect(() => { saveProgress(progress) }, [progress])

  // Today's session: frozen for the day, picked again once the games are
  // loaded (never from the empty state before them).
  const list = useMemo(() => Object.values(analyses), [analyses])
  const exercises = useMemo(() => extractExercises(list), [list])
  const today = todayString()
  // `today` in the deps: "recent" moves on with the calendar, not only with the games.
  const recency = useMemo(() => recencyOf(list, Date.now()), [list, today])
  const [storedSession, setStoredSession] = useState<DailySession | null>(() => loadDailySession())
  const ready = !!username && hydrated
  const session = useMemo(
    () => (ready ? resolveDailySession(storedSession, exercises, progress, recency, today, Date.now()) : storedSession),
    [ready, storedSession, exercises, progress, recency, today],
  )
  useEffect(() => {
    if (session && session !== storedSession) {
      saveDailySession(session)
      setStoredSession(session)
    }
  }, [session, storedSession])
  const daily = useMemo<DailyExercises>(() => {
    if (!session || !ready) return { ids: [], remaining: [], done: 0, total: 0, reserve: 0, currentDue: [], archived: 0 }
    const startOfDay = new Date().setHours(0, 0, 0, 0)
    const sp = sessionProgress(session, progress, startOfDay)
    const inSession = new Set(session.ids)
    let reserve = 0
    let archived = 0
    const currentDue: string[] = []
    for (const e of exercises) {
      if (!isCurrent(e, recency, progress)) { archived++; continue }
      if (!isDue(progress[e.id])) continue
      currentDue.push(e.id)
      if (!inSession.has(e.id)) reserve++
    }
    return { ids: session.ids, remaining: sp.remaining, done: sp.done, total: sp.total, reserve, currentDue, archived }
  }, [session, ready, exercises, progress, recency])

  // ---- Sharing with the account (Supabase): phone ↔ PC -------------------
  useEffect(() => {
    if (!supabase) return
    const toUser = (u: { id: string; email?: string } | null | undefined) => (u ? { id: u.id, email: u.email ?? '' } : null)
    void supabase.auth.getSession().then(({ data }) => setCloud(c => ({ ...c, user: toUser(data.session?.user) })))
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setCloud(c => ({ ...c, user: toUser(session?.user) })))
    return () => data.subscription.unsubscribe()
  }, [])

  // What the sync engine reads and writes on this device: the live state
  // (saved by the effects above), and localStorage for the rest.
  const progressRef = useRef(progress)
  useEffect(() => { progressRef.current = progress }, [progress])
  const sessionRef = useRef(storedSession)
  useEffect(() => { sessionRef.current = storedSession }, [storedSession])
  const localStore = useMemo<LocalStore>(() => ({
    analyses: () => analysesRef.current,
    addAnalyses: list => setAnalyses(prev => ({ ...prev, ...Object.fromEntries(list.map(a => [a.url, a])) })),
    document: key => {
      if (key === KEYS.exerciseProgress) return progressRef.current
      if (key === KEYS.dailyExercises) return sessionRef.current ?? undefined
      if (key === KEYS.username) return username || undefined
      const raw = localStorage.getItem(key)
      if (raw === null) return undefined
      try { return JSON.parse(raw) } catch { return raw }
    },
    setDocument: (key, value) => {
      if (key === KEYS.exerciseProgress) setProgress(value as Record<string, ExerciseProgress>)
      else if (key === KEYS.dailyExercises) { saveDailySession(value as DailySession); setStoredSession(value as DailySession) }
      else if (key === KEYS.username) {
        // Another device's chess.com account: only adopted when none is set here.
        if (!username && typeof value === 'string') { localStorage.setItem(USERNAME_KEY, value); setUsername(value) }
      } else localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value))
    },
  }), [username])

  const cloudBusy = useRef(false)
  const syncCloud = useCallback(async () => {
    const user = cloud.user
    if (!supabase || !user || !hydrated || cloudBusy.current) return
    cloudBusy.current = true
    setCloud(c => ({ ...c, syncing: true, error: null }))
    try {
      const result = await syncOnce(supabaseRemote, localStore, loadSyncState(user.id))
      saveSyncState(user.id, result.state)
      setCloud(c => ({ ...c, syncing: false, syncedAt: Date.now() }))
    } catch (e) {
      setCloud(c => ({ ...c, syncing: false, error: e instanceof Error ? e.message : String(e) }))
    } finally {
      cloudBusy.current = false
    }
  }, [cloud.user, hydrated, localStore])

  // When signed in: at launch, back in the foreground, and a little after
  // each change of analyses or progress (an exercise solved, a game analysed).
  useEffect(() => {
    if (!cloud.user || !hydrated) return
    void syncCloud()
    const sub = AppState.addEventListener('change', state => { if (state === 'active') void syncCloud() })
    return () => sub.remove()
  // Keyed on the account only: syncCloud changes with the data it reads.
  }, [cloud.user, hydrated])
  useEffect(() => {
    if (!cloud.user || !hydrated) return
    const t = setTimeout(() => { void syncCloud() }, 8000)
    return () => clearTimeout(t)
  }, [analyses, progress])

  const value = useMemo<AppData>(() => ({
    username,
    hydrated: !username || hydrated,
    games,
    analyses,
    progress,
    analyzing,
    syncing,
    lastSync,
    exercises,
    daily,
    cloud,
    syncCloud,
    extendDaily() {
      if (!session) return
      const next = extendDailySession(session, exercises, progress, recency, Date.now())
      saveDailySession(next)
      setStoredSession(next)
    },
    async login(name) {
      const clean = name.trim()
      const fetched = await getRecentGames(clean)
      localStorage.setItem(USERNAME_KEY, clean)
      setHydrated(false)
      setGames(fetched)
      setAnalyses({})
      setUsername(clean)
    },
    logout() {
      localStorage.removeItem(USERNAME_KEY)
      setUsername('')
      setGames([])
      setAnalyses({})
      setHydrated(false)
    },
    reloadGames: sync,
    analyze,
    recordAttempt(id, outcome) {
      setProgress(prev => ({ ...prev, [id]: updateProgressAfterAttempt(prev[id], outcome) }))
    },
    engine: getEngine,
  }), [username, hydrated, games, analyses, progress, analyzing, syncing, lastSync, exercises, daily, session, recency, sync, analyze, cloud, syncCloud])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAppData(): AppData {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAppData outside AppDataProvider')
  return v
}
