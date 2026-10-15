// The app's data, as on the website (src/App.tsx): the chess.com account,
// its games and analyses (persisted per user), the exercise progress and
// the shared Stockfish engine.
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ChessComGame, GameAnalysis } from '@shared/types'
import { getRecentGames } from '@shared/api/chesscom'
import {
  loadAnalyses, saveAnalyses, loadGames, saveGames, loadProgress, saveProgress,
  updateProgressAfterAttempt, type ExerciseProgress,
} from '@shared/storage/persist'
import { analyzeGame } from '@shared/analysis/analyze'
import { StockfishEngine } from '@shared/engine/stockfish'
import { getEngineDepth } from '@shared/storage/settings'

type Outcome = Parameters<typeof updateProgressAfterAttempt>[1]

export interface AnalyzeState { url: string; done: number; total: number }

interface AppData {
  username: string
  /** Games and analyses are loaded from storage. */
  hydrated: boolean
  games: ChessComGame[]
  analyses: Record<string, GameAnalysis>
  progress: Record<string, ExerciseProgress>
  analyzing: AnalyzeState | null
  login(username: string): Promise<void>
  logout(): void
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

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const [username, setUsername] = useState(() => localStorage.getItem(USERNAME_KEY) ?? '')
  const [games, setGames] = useState<ChessComGame[]>([])
  const [analyses, setAnalyses] = useState<Record<string, GameAnalysis>>({})
  const [progress, setProgress] = useState<Record<string, ExerciseProgress>>(() => loadProgress())
  const [hydrated, setHydrated] = useState(false)
  const [analyzing, setAnalyzing] = useState<AnalyzeState | null>(null)
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
  useEffect(() => { saveProgress(progress) }, [progress])

  const value = useMemo<AppData>(() => ({
    username,
    hydrated: !username || hydrated,
    games,
    analyses,
    progress,
    analyzing,
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
    async reloadGames() {
      if (!username) return
      const fetched = await getRecentGames(username)
      setGames(prev => {
        const seen = new Set(fetched.map(g => g.url))
        return [...fetched, ...prev.filter(g => !seen.has(g.url))]
      })
    },
    async analyze(game) {
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
    },
    recordAttempt(id, outcome) {
      setProgress(prev => ({ ...prev, [id]: updateProgressAfterAttempt(prev[id], outcome) }))
    },
    engine: getEngine,
  }), [username, hydrated, games, analyses, progress, analyzing])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAppData(): AppData {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAppData outside AppDataProvider')
  return v
}
