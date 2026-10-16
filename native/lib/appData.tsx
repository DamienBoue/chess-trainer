// The app's data: the chess.com account, the exercise progress, the shared
// Stockfish engine, and what is derived from the games, kept so that it is
// computed once, then only for what is new:
// - the digest index (@shared/analysis/digest): one digest per analysed
//   game (exercises, precision, result), updated game by game;
// - the today cache (lib/today): the home screen, the plan's inputs and
//   the day's facts, opened on at launch without reading any game;
// - the games' rows (lists, stats) and the full analyses are read only by
//   the screens that need them (useGameRows, useAnalyses, useAnalysis).
import { createContext, startTransition, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { AppState } from 'react-native'
import type { ChessComGame, GameAnalysis } from '@shared/types'
import { getRecentGames } from '@shared/api/chesscom'
import {
  loadAnalyses as readAnalyses, loadAnalysesOf, saveAnalyses, loadProgress, saveProgress,
  updateProgressAfterAttempt, type ExerciseProgress,
} from '@shared/storage/persist'
import { addGames, ensureGamesMigrated, loadGame, loadGameRows, loadGames } from '@shared/storage/games'
import { analyzeGame } from '@shared/analysis/analyze'
import { StockfishEngine } from '@shared/engine/stockfish'
import { getEngineDepth } from '@shared/storage/settings'
import type { Exercise } from '@shared/analysis/exercises'
import { emptyIndex, homeSummary, indexExercises, indexStamp, withAnalyses, type DigestIndex, type GameDigest } from '@shared/analysis/digest'
import { extendDailySession, type DailySession } from '@shared/analysis/dailyQueue'
import { dailyState, emptyToday, recencyOfDay, staleParts, TODAY_VERSION, type DailyExercises, type TodayCache } from '@shared/analysis/today'
import { toRow, type GameRow } from '@shared/analysis/results'
import { loadDailySession, saveDailySession } from '@shared/storage/dailyQueue'
import { todayString } from '@shared/storage/daily'
import { lastSyncAt, syncNewGames } from './sync'
import { downloadHistory as fetchHistory, loadHistoryStatus, type HistoryStatus } from './history'
import { buildIndex, loadIndex, loadTodayCache, saveIndex, saveTodayCache, workOutDay, workOutPlan } from './today'
import { syncOnce, type LocalStore } from '@shared/sync/engine'
import { KEYS } from '@shared/storage/keys'
import { supabase } from './supabase'
import { loadSyncState, saveSyncState, supabaseRemote } from './cloud'

export type { DailyExercises } from '@shared/analysis/today'

type Outcome = Parameters<typeof updateProgressAfterAttempt>[1]

export interface AnalyzeState { url: string; done: number; total: number }

/** The account the data is shared with (phone ↔ PC), when signed in. */
export interface CloudState {
  user: { id: string; email: string } | null
  syncing: boolean
  syncedAt: number | null
  error: string | null
}

interface AppData {
  username: string
  /** The digest index is loaded: the exercise pool and the counts are known. */
  ready: boolean
  /** The analysed games, by url. */
  digests: Record<string, GameDigest>
  /** Every exercise (empty until `ready`). */
  exercises: Exercise[]
  /** Exercises by id: the pool, and today's session before the pool loads. */
  exerciseById: Map<string, Exercise>
  progress: Record<string, ExerciseProgress>
  daily: DailyExercises
  /** The home screen's summary and the plan's inputs (lib/today). */
  today: TodayCache | null
  analyzing: AnalyzeState | null
  /** Checking chess.com for new games. */
  syncing: boolean
  /** When the games were last checked (ms). */
  lastSync: number
  cloud: CloudState
  /** The whole chess.com history: months downloaded, and the download in progress. */
  history: HistoryStatus & { running: boolean; added: number }
  downloadHistory(): Promise<void>
  stopHistory(): void
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
  /** Every analysis, once requested (useAnalyses); null until read. */
  analyses: Record<string, GameAnalysis> | null
  requestAnalyses(): void
  /** One analysis (game screens). */
  getAnalysis(url: string): Promise<GameAnalysis | undefined>
  /** Every game's row (lists, stats), once requested (useGameRows). */
  rows: GameRow[] | null
  requestRows(): void
  /** One stored game (to analyse it). */
  getGame(url: string, endTime: number): Promise<ChessComGame | undefined>
  /** Every stored game, PGNs included (rarely needed). */
  loadAllGames(): Promise<ChessComGame[]>
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
/** The plan waits this long after the last new analysis (they come in a row). */
const PLAN_DELAY_MS = 4000

const startOfToday = () => new Date().setHours(0, 0, 0, 0)

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const [username, setUsername] = useState(() => localStorage.getItem(USERNAME_KEY) ?? '')
  const [progress, setProgress] = useState<Record<string, ExerciseProgress>>(() => loadProgress())
  const [storedSession, setStoredSession] = useState<DailySession | null>(() => loadDailySession())
  const [today, setToday] = useState<TodayCache | null>(() => loadTodayCache(username))
  const [index, setIndex] = useState<DigestIndex | null>(null)
  const [analyses, setAnalyses] = useState<Record<string, GameAnalysis> | null>(null)
  const [rows, setRows] = useState<GameRow[] | null>(null)
  const [analyzing, setAnalyzing] = useState<AnalyzeState | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [lastSync, setLastSync] = useState(() => lastSyncAt())
  const [cloud, setCloud] = useState<CloudState>({ user: null, syncing: false, syncedAt: null, error: null })
  const [history, setHistory] = useState(() => ({ ...loadHistoryStatus(username), running: false, added: 0 }))
  const [date, setDate] = useState(todayString)
  const historyAbort = useRef<AbortController | null>(null)

  // Latest values for the async jobs.
  const userRef = useRef(username)
  const indexRef = useRef(index)
  const analysesRef = useRef(analyses)
  const rowsRef = useRef(rows)
  const progressRef = useRef(progress)
  const sessionRef = useRef(storedSession)
  useEffect(() => { userRef.current = username }, [username])
  useEffect(() => { indexRef.current = index }, [index])
  useEffect(() => { analysesRef.current = analyses }, [analyses])
  useEffect(() => { rowsRef.current = rows }, [rows])
  useEffect(() => { progressRef.current = progress }, [progress])
  useEffect(() => { sessionRef.current = storedSession }, [storedSession])

  // ---- The digest index: read at launch, built once when missing ----------
  const savedIndex = useRef<DigestIndex | null>(null)
  const loadedFor = useRef<string | null>(null)
  useEffect(() => {
    if (loadedFor.current !== null && loadedFor.current !== username) {
      // Another account: nothing of the previous one is kept.
      setIndex(null)
      setAnalyses(null)
      setRows(null)
      setToday(loadTodayCache(username))
    }
    loadedFor.current = username
    if (!username) return
    let cancelled = false
    void (async () => {
      let idx = await loadIndex(username)
      if (!idx) {
        // First launch with these rules: every analysis once, a few at a time.
        const all = await readAnalyses(username)
        if (cancelled) return
        setAnalyses(all)
        idx = await buildIndex(Object.values(all))
        if (cancelled) return
        await saveIndex(username, idx)
      }
      if (cancelled) return
      savedIndex.current = idx
      setIndex(idx)
    })()
    return () => { cancelled = true }
  }, [username])

  useEffect(() => {
    if (!username || !index || index === savedIndex.current) return
    savedIndex.current = index
    void saveIndex(username, index)
  }, [index, username])

  const exercises = useMemo(() => (index ? indexExercises(index) : []), [index])

  // ---- The today cache: the home screen at once, the day and the plan ----
  // Home: cheap, refreshed with the index.
  useEffect(() => {
    if (!username || !index) return
    setToday(prev => {
      const next: TodayCache = { ...(prev ?? emptyToday()), version: TODAY_VERSION, home: homeSummary(index), exercises: exercises.length }
      saveTodayCache(username, next)
      return next
    })
  }, [index, exercises, username])

  // The day: once a day, or after new analyses (recent games only).
  const dayJob = useRef<string | null>(null)
  useEffect(() => {
    if (!username || !index || !today) return
    if (!staleParts(today, index, date).day) return
    const job = `${username}|${date}|${indexStamp(index)}`
    if (dayJob.current === job) return
    dayJob.current = job
    void workOutDay(username, index, progressRef.current, sessionRef.current, date, Date.now()).then(({ day, session }) => {
      if (userRef.current !== username) return
      if (JSON.stringify(session) !== JSON.stringify(sessionRef.current)) {
        saveDailySession(session)
        setStoredSession(session)
      }
      setToday(prev => {
        const next = { ...(prev ?? emptyToday()), day }
        saveTodayCache(username, next)
        return next
      })
    }).catch(() => { dayJob.current = null })
  }, [username, index, today, date])

  // The plan: after new analyses only, once the analyses in a row are done.
  useEffect(() => {
    if (!username || !index || !today || analyzing) return
    if (!staleParts(today, index, date).plan) return
    const t = setTimeout(() => {
      void workOutPlan(username, index, analysesRef.current).then(inputs => {
        if (userRef.current !== username || indexRef.current !== index) return
        setToday(prev => {
          const next = { ...(prev ?? emptyToday()), plan: { basedOn: indexStamp(index), inputs } }
          saveTodayCache(username, next)
          return next
        })
      }).catch(() => undefined)
    }, today.plan ? PLAN_DELAY_MS : 0)
    return () => clearTimeout(t)
  }, [username, index, today, date, analyzing])

  // A new day while the app stays open.
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => { if (state === 'active') setDate(todayString()) })
    const t = setInterval(() => setDate(todayString()), 60_000)
    return () => { sub.remove(); clearInterval(t) }
  }, [])

  const day = today?.day ?? null
  const daily = useMemo(
    () => dailyState(day, storedSession, exercises, progress, date, startOfToday()),
    [day, storedSession, exercises, progress, date],
  )
  const exerciseById = useMemo(() => {
    const m = new Map<string, Exercise>()
    for (const e of day?.sessionExercises ?? []) m.set(e.id, e)
    for (const e of exercises) m.set(e.id, e)
    return m
  }, [day, exercises])

  useEffect(() => { saveProgress(progress) }, [progress])

  // ---- Analyses: added one by one, read whole only on request -------------
  const addAnalyses = useCallback((list: GameAnalysis[]) => {
    if (list.length === 0) return
    void saveAnalyses(userRef.current, list)
    setAnalyses(prev => (prev ? { ...prev, ...Object.fromEntries(list.map(a => [a.url, a])) } : prev))
    setIndex(prev => withAnalyses(prev ?? emptyIndex(), list))
  }, [])

  const analysesLoading = useRef(false)
  const requestAnalyses = useCallback(() => {
    if (analysesRef.current || analysesLoading.current || !userRef.current) return
    analysesLoading.current = true
    const user = userRef.current
    void readAnalyses(user).then(all => {
      if (userRef.current === user) setAnalyses(prev => ({ ...all, ...(prev ?? {}) }))
    }).finally(() => { analysesLoading.current = false })
  }, [])

  const getAnalysis = useCallback(async (url: string) => {
    const known = analysesRef.current?.[url]
    if (known) return known
    return (await loadAnalysesOf(userRef.current, [url]))[0]
  }, [])

  // ---- Games: stored by month, listed through their rows ------------------
  const addRows = useCallback((games: ChessComGame[]) => {
    const user = userRef.current
    const fresh = games.flatMap(g => toRow(g, user) ?? [])
    if (fresh.length === 0) return
    setRows(prev => {
      if (!prev) return prev
      const urls = new Set(fresh.map(r => r.url))
      return [...fresh, ...prev.filter(r => !urls.has(r.url))].sort((a, b) => b.end - a.end)
    })
  }, [])

  const rowsLoading = useRef(false)
  const requestRows = useCallback(() => {
    if (rowsRef.current || rowsLoading.current || !userRef.current) return
    rowsLoading.current = true
    const user = userRef.current
    void loadGameRows(user).then(list => {
      if (userRef.current === user) setRows(list)
    }).finally(() => { rowsLoading.current = false })
  }, [])

  const getGame = useCallback((url: string, endTime: number) => loadGame(userRef.current, url, endTime), [])
  const loadAllGames = useCallback(() => loadGames(userRef.current), [])

  // One analysis at a time (taps and automatic ones share the engine).
  const chain = useRef<Promise<unknown>>(Promise.resolve())
  const analyze = useCallback((game: ChessComGame): Promise<GameAnalysis> => {
    const run = async () => {
      setAnalyzing({ url: game.url, done: 0, total: 0 })
      try {
        const result = await analyzeGame(getEngine(), game, userRef.current, {
          depth: getEngineDepth(),
          movetimeMs: 600,
          onProgress: p => setAnalyzing({ url: game.url, done: p.done, total: p.total }),
        })
        addAnalyses([result])
        return result
      } finally {
        setAnalyzing(null)
      }
    }
    const next = chain.current.then(run, run)
    chain.current = next.catch(() => undefined)
    return next
  }, [addAnalyses])

  // New games since the last check, then their analysis: at launch, and
  // when the app comes back to the foreground (the page shown again, on the
  // web). Phones also check in the background (lib/backgroundSync.ts).
  const syncingRef = useRef(false)
  const sync = useCallback(async () => {
    const user = userRef.current
    if (!user || syncingRef.current) return
    syncingRef.current = true
    setSyncing(true)
    try {
      const { added } = await syncNewGames(user)
      setLastSync(lastSyncAt())
      if (added.length === 0) return
      addRows(added)
      const known = indexRef.current?.games ?? {}
      const toAnalyse = added.filter(g => !known[g.url]).sort((a, b) => b.end_time - a.end_time).slice(0, AUTO_ANALYSE_MAX)
      for (const g of toAnalyse) void analyze(g).catch(() => undefined)
    } catch {
      // Offline or chess.com down: the next foreground will try again.
    } finally {
      syncingRef.current = false
      setSyncing(false)
    }
  }, [analyze, addRows])

  const ready = !!index
  useEffect(() => {
    if (!ready || !username) return
    void sync()
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active' && Date.now() - lastSyncAt() > SYNC_EVERY_MS) void sync()
    })
    return () => sub.remove()
  }, [ready, username, sync])

  // ---- The whole history (Parties → "Télécharger tout l'historique") -----
  useEffect(() => { setHistory(h => ({ ...h, ...loadHistoryStatus(username) })) }, [username])
  const downloadHistory = useCallback(async () => {
    const user = userRef.current
    if (!user || historyAbort.current) return
    const abort = new AbortController()
    historyAbort.current = abort
    setHistory(h => ({ ...h, running: true, added: 0 }))
    try {
      await ensureGamesMigrated(user)
      await fetchHistory(user, async (monthGames, status) => {
        const added = await addGames(user, monthGames)
        addRows(added)
        setHistory(h => ({ ...h, ...status, added: h.added + added.length }))
      }, abort.signal)
    } finally {
      historyAbort.current = null
      setHistory(h => ({ ...h, ...loadHistoryStatus(user), running: false }))
    }
  }, [addRows])

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
  const localStore = useMemo<LocalStore>(() => ({
    analysisIds: () => Object.keys(indexRef.current?.games ?? {}),
    loadAnalyses: ids => loadAnalysesOf(userRef.current, ids),
    addAnalyses,
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
  }), [username, addAnalyses])

  const cloudBusy = useRef(false)
  const syncCloud = useCallback(async () => {
    const user = cloud.user
    if (!supabase || !user || !ready || cloudBusy.current) return
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
  }, [cloud.user, ready, localStore])

  // When signed in: at launch, back in the foreground, and a little after
  // each change of analyses or progress (an exercise solved, a game analysed).
  useEffect(() => {
    if (!cloud.user || !ready) return
    void syncCloud()
    const sub = AppState.addEventListener('change', state => { if (state === 'active') void syncCloud() })
    return () => sub.remove()
  // Keyed on the account only: syncCloud changes with the data it reads.
  }, [cloud.user, ready])
  useEffect(() => {
    if (!cloud.user || !ready) return
    const t = setTimeout(() => { void syncCloud() }, 8000)
    return () => clearTimeout(t)
  }, [index, progress])

  const value = useMemo<AppData>(() => ({
    username,
    ready,
    digests: index?.games ?? {},
    exercises,
    exerciseById,
    progress,
    daily,
    today,
    analyzing,
    syncing,
    lastSync,
    cloud,
    syncCloud,
    history,
    downloadHistory,
    stopHistory() { historyAbort.current?.abort() },
    extendDaily() {
      if (!storedSession || !day) return
      const next = extendDailySession(storedSession, exercises, progress, recencyOfDay(day), Date.now())
      saveDailySession(next)
      setStoredSession(next)
    },
    async login(name) {
      const clean = name.trim()
      const fetched = await getRecentGames(clean)
      await addGames(clean, fetched)
      localStorage.setItem(USERNAME_KEY, clean)
      setUsername(clean)
    },
    logout() {
      localStorage.removeItem(USERNAME_KEY)
      setUsername('')
    },
    reloadGames: sync,
    analyze,
    recordAttempt(id, outcome) {
      // Once the move is on screen: the progress feeds the session, the plan
      // and the badges, a re-render that must not hold the board back.
      requestAnimationFrame(() => setTimeout(() => startTransition(() => {
        setProgress(prev => ({ ...prev, [id]: updateProgressAfterAttempt(prev[id], outcome) }))
      }), 0))
    },
    engine: getEngine,
    analyses,
    requestAnalyses,
    getAnalysis,
    rows,
    requestRows,
    getGame,
    loadAllGames,
  }), [username, ready, index, exercises, exerciseById, progress, daily, today, day, analyzing, syncing, lastSync, cloud, syncCloud, history, downloadHistory, storedSession, sync, analyze, analyses, requestAnalyses, getAnalysis, rows, requestRows, getGame, loadAllGames])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAppData(): AppData {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAppData outside AppDataProvider')
  return v
}

/** Every analysis, read on first use; null while reading. */
export function useAnalyses(enabled = true): Record<string, GameAnalysis> | null {
  const { analyses, requestAnalyses } = useAppData()
  useEffect(() => { if (enabled) requestAnalyses() }, [enabled, requestAnalyses])
  return analyses
}

/** One game's analysis; undefined while reading, null when there is none. */
export function useAnalysis(url: string | undefined): GameAnalysis | null | undefined {
  const { analyses, getAnalysis, digests } = useAppData()
  const [found, setFound] = useState<{ url: string; stamp?: string; a: GameAnalysis | null } | null>(null)
  const inMemory = url ? analyses?.[url] : undefined
  const stamp = url ? digests[url]?.stamp : undefined
  useEffect(() => {
    if (!url || inMemory) return
    let cancelled = false
    void getAnalysis(url).then(a => { if (!cancelled) setFound({ url, stamp, a: a ?? null }) })
    return () => { cancelled = true }
  }, [url, inMemory, getAnalysis, stamp])
  if (!url) return null
  if (inMemory) return inMemory
  return found && found.url === url && found.stamp === stamp ? found.a : undefined
}

/** Every game's row, read on first use; null while reading. */
export function useGameRows(): GameRow[] | null {
  const { rows, requestRows } = useAppData()
  useEffect(() => { requestRows() }, [requestRows])
  return rows
}
