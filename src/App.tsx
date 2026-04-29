import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChessComGame, GameAnalysis } from './types'
import { StockfishEngine } from './engine/stockfish'
import Home from './components/Home'
import GamesList from './components/GamesList'
import AnalysisView from './components/AnalysisView'
import StatsView from './components/StatsView'
import ExercisesView from './components/ExercisesView'
import PuzzleRushView from './components/PuzzleRushView'
import { extractExercises } from './analysis/exercises'
import { analyzeGame } from './analysis/analyze'
import {
  loadAnalyses, saveAnalyses,
  loadGames, saveGames,
  loadProgress, saveProgress,
  type ExerciseProgress, updateProgressAfterAttempt, isDue,
} from './storage/persist'
import { getRecentGames } from './api/chesscom'

export interface BatchState {
  total: number
  done: number
  currentGameUrl: string | null
  currentMove: { done: number; total: number; currentSan?: string } | null
  failed: number
}

type View = 'home' | 'games' | 'analysis' | 'stats' | 'exercises' | 'rush'

export default function App() {
  const [view, setView] = useState<View>('home')
  const [username, setUsername] = useState<string>(() => localStorage.getItem('chess.username') ?? '')
  const [games, setGames] = useState<ChessComGame[]>(() =>
    username ? loadGames(username) : [],
  )
  const [reloading, setReloading] = useState(false)
  const [analyses, setAnalyses] = useState<Record<string, GameAnalysis>>(() =>
    username ? loadAnalyses(username) : {},
  )
  const [progress, setProgress] = useState<Record<string, ExerciseProgress>>(() => loadProgress())
  const [activeGameUrl, setActiveGameUrl] = useState<string | null>(null)
  const [batch, setBatch] = useState<BatchState | null>(null)
  const batchAbortRef = useRef<AbortController | null>(null)

  const engineRef = useRef<StockfishEngine | null>(null)
  if (!engineRef.current) engineRef.current = new StockfishEngine()
  // Note: we intentionally don't terminate the worker on unmount. React StrictMode
  // calls useEffect cleanups during dev, which would kill the engine while the ref
  // still points to it, leaving us with a zombie worker. The browser cleans up the
  // worker when the tab closes anyway.

  // Persist analyses whenever they change (debounced via effect batching)
  useEffect(() => {
    if (username) saveAnalyses(username, analyses)
  }, [analyses, username])

  useEffect(() => {
    if (username) saveGames(username, games)
  }, [games, username])

  useEffect(() => {
    saveProgress(progress)
  }, [progress])

  const activeAnalysis = activeGameUrl ? analyses[activeGameUrl] : null
  const allAnalyses = useMemo(() => Object.values(analyses), [analyses])
  const exercises = useMemo(() => extractExercises(allAnalyses), [allAnalyses])
  const exerciseCount = exercises.length
  const dueCount = useMemo(
    () => exercises.filter(e => isDue(progress[e.id])).length,
    [exercises, progress],
  )

  function handleSubmitUsername(u: string, fetched: ChessComGame[]) {
    setUsername(u)
    localStorage.setItem('chess.username', u)
    setGames(fetched)
    setAnalyses(loadAnalyses(u))   // load this user's saved analyses
    setView('games')
  }

  async function handleReloadGames(count = 30) {
    if (!username || reloading) return
    setReloading(true)
    try {
      const fresh = await getRecentGames(username, count)
      if (fresh.length > 0) setGames(fresh)
    } catch (e) {
      console.error('[reload] failed:', e)
    } finally {
      setReloading(false)
    }
  }

  function handleAnalyzeStart(game: ChessComGame) {
    setActiveGameUrl(game.url)
    setView('analysis')
  }

  function handleAnalysisComplete(analysis: GameAnalysis) {
    setAnalyses(prev => ({ ...prev, [analysis.url]: analysis }))
  }

  function handleExerciseAttempt(id: string, outcome: Parameters<typeof updateProgressAfterAttempt>[1]) {
    setProgress(prev => ({ ...prev, [id]: updateProgressAfterAttempt(prev[id], outcome) }))
  }

  async function handleStartBatch() {
    if (batch || !engineRef.current) return
    const toAnalyze = games.filter(g => !analyses[g.url])
    if (toAnalyze.length === 0) return
    const controller = new AbortController()
    batchAbortRef.current = controller
    setBatch({ total: toAnalyze.length, done: 0, currentGameUrl: null, currentMove: null, failed: 0 })

    let done = 0
    let failed = 0
    for (const game of toAnalyze) {
      if (controller.signal.aborted) break
      setBatch({ total: toAnalyze.length, done, currentGameUrl: game.url, currentMove: null, failed })
      try {
        const result = await analyzeGame(engineRef.current, game, username, {
          depth: 12,
          movetimeMs: 600,
          signal: controller.signal,
          onProgress: (p) => {
            if (controller.signal.aborted) return
            setBatch(s => s && { ...s, currentMove: p })
          },
        })
        setAnalyses(prev => ({ ...prev, [result.url]: result }))
      } catch (err) {
        if (controller.signal.aborted) break
        console.error('[batch] failed on', game.url, err)
        failed++
      }
      done++
    }
    batchAbortRef.current = null
    setBatch(null)
  }

  function handleCancelBatch() {
    batchAbortRef.current?.abort()
  }

  return (
    <div className="min-h-full flex flex-col">
      <header className="border-b border-[var(--color-border)] bg-[var(--color-panel)] px-6 py-3 flex items-center gap-4">
        <h1 className="text-lg font-semibold tracking-tight">
          ♞ Chess Trainer
        </h1>
        {username && (
          <span className="text-sm text-neutral-400">@{username}</span>
        )}
        <nav className="ml-auto flex gap-1 text-sm flex-wrap">
          {username && (
            <>
              <NavBtn active={view === 'games'} onClick={() => setView('games')}>Parties</NavBtn>
              <NavBtn active={view === 'exercises'} onClick={() => setView('exercises')} disabled={exerciseCount === 0}>
                Exercices {dueCount > 0 ? `(${dueCount} dus${exerciseCount !== dueCount ? `/${exerciseCount}` : ''})` : exerciseCount > 0 ? `(${exerciseCount})` : ''}
              </NavBtn>
              <NavBtn active={view === 'rush'} onClick={() => setView('rush')} disabled={exerciseCount < 5}>
                Puzzle Rush
              </NavBtn>
              <NavBtn active={view === 'stats'} onClick={() => setView('stats')} disabled={allAnalyses.length === 0}>
                Stats {allAnalyses.length > 0 && `(${allAnalyses.length})`}
              </NavBtn>
              <NavBtn onClick={() => { setView('home') }}>Changer de compte</NavBtn>
            </>
          )}
        </nav>
      </header>

      <main className="flex-1 overflow-auto">
        {view === 'home' && (
          <Home initialUsername={username} onSubmit={handleSubmitUsername} />
        )}
        {view === 'games' && (
          <GamesList
            username={username}
            games={games}
            analyses={analyses}
            onSelectGame={handleAnalyzeStart}
            batch={batch}
            onStartBatch={handleStartBatch}
            onCancelBatch={handleCancelBatch}
            reloading={reloading}
            onReload={handleReloadGames}
          />
        )}
        {view === 'analysis' && activeGameUrl && (
          <AnalysisView
            engine={engineRef.current!}
            username={username}
            game={games.find(g => g.url === activeGameUrl)!}
            existingAnalysis={activeAnalysis}
            onAnalysisComplete={handleAnalysisComplete}
            onBack={() => setView('games')}
          />
        )}
        {view === 'stats' && (
          <StatsView analyses={allAnalyses} />
        )}
        {view === 'exercises' && (
          <ExercisesView
            analyses={allAnalyses}
            progress={progress}
            onAttempt={handleExerciseAttempt}
          />
        )}
        {view === 'rush' && (
          <PuzzleRushView
            exercises={exercises}
            onAttempt={handleExerciseAttempt}
            onExit={() => setView('exercises')}
          />
        )}
      </main>
    </div>
  )
}

function NavBtn({ children, active, onClick, disabled }: { children: React.ReactNode; active?: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-3 py-1.5 rounded-md transition-colors ${
        active
          ? 'bg-[var(--color-accent)] text-white'
          : 'text-neutral-300 hover:bg-neutral-800 disabled:opacity-40 disabled:hover:bg-transparent'
      }`}
    >
      {children}
    </button>
  )
}
