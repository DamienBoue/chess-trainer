import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChessComGame, GameAnalysis } from './types'
import { StockfishEngine } from './engine/stockfish'
import Home from './components/Home'
import GamesList from './components/GamesList'
import AnalysisView from './components/AnalysisView'
import StatsView from './components/StatsView'
import ExercisesView from './components/ExercisesView'
import PuzzleRushView from './components/PuzzleRushView'
import SharedExerciseView from './components/SharedExerciseView'
import DailyView from './components/DailyView'
import CompareView from './components/CompareView'
import RepertoireView from './components/RepertoireView'
import LibraryView from './components/LibraryView'
import BookView from './components/BookView'
import ScoutingView from './components/ScoutingView'
import PlayView from './components/PlayView'
import BlunderDrillView from './components/BlunderDrillView'
import {
  GlobalFilters,
  applyGlobalFilters,
  type TimeClassFilter,
  type ColorFilter,
} from './components/TimeClassFilter'
import { loadDaily, todayString } from './storage/daily'
import { extractExercises } from './analysis/exercises'
import { readSharedFromHash, clearShareHash } from './api/share'
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

type View = 'home' | 'games' | 'analysis' | 'stats' | 'exercises' | 'rush' | 'daily' | 'compare' | 'repertoire' | 'library' | 'book' | 'scouting' | 'play' | 'blunder'

export default function App() {
  const [view, setView] = useState<View>('home')
  const [activeBookId, setActiveBookId] = useState<string | null>(null)
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
  const [sharedExercise, setSharedExercise] = useState(() => readSharedFromHash())
  const [tcFilter, setTcFilter] = useState<TimeClassFilter>(
    () => localStorage.getItem('chess.filter.tc') ?? 'all',
  )
  const [colorFilter, setColorFilter] = useState<ColorFilter>(
    () => (localStorage.getItem('chess.filter.color') as ColorFilter) ?? 'all',
  )
  useEffect(() => { localStorage.setItem('chess.filter.tc', tcFilter) }, [tcFilter])
  useEffect(() => { localStorage.setItem('chess.filter.color', colorFilter) }, [colorFilter])

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
  const filteredAnalyses = useMemo(
    () => applyGlobalFilters(allAnalyses, tcFilter, colorFilter),
    [allAnalyses, tcFilter, colorFilter],
  )
  const exercises = useMemo(() => extractExercises(filteredAnalyses), [filteredAnalyses])
  const exerciseCount = exercises.length
  const dueCount = useMemo(
    () => exercises.filter(e => isDue(progress[e.id])).length,
    [exercises, progress],
  )
  const dailyState = loadDaily()
  const today = todayString()
  const dailySolvedToday = dailyState?.date === today && dailyState.solved
  const dailyStreak = dailyState?.streak ?? 0

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

  // Shared exercise mode: short-circuit the rest of the app and show a focused
  // standalone view. The user can close it to return to their own data.
  if (sharedExercise) {
    return (
      <SharedExerciseView
        exercise={sharedExercise}
        onClose={() => { clearShareHash(); setSharedExercise(null) }}
      />
    )
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
              <NavBtn active={view === 'daily'} onClick={() => setView('daily')} disabled={exerciseCount === 0}>
                {dailySolvedToday ? '✓ ' : ''}Quotidien{dailyStreak > 0 ? ` 🔥${dailyStreak}` : ''}
              </NavBtn>
              <NavBtn active={view === 'exercises'} onClick={() => setView('exercises')} disabled={exerciseCount === 0}>
                Exercices {dueCount > 0 ? `(${dueCount} dus${exerciseCount !== dueCount ? `/${exerciseCount}` : ''})` : exerciseCount > 0 ? `(${exerciseCount})` : ''}
              </NavBtn>
              <NavBtn active={view === 'rush'} onClick={() => setView('rush')} disabled={exerciseCount < 5}>
                Puzzle Rush
              </NavBtn>
              <NavBtn active={view === 'blunder'} onClick={() => setView('blunder')} disabled={exerciseCount < 3}>
                Blunder
              </NavBtn>
              <NavBtn active={view === 'stats'} onClick={() => setView('stats')} disabled={filteredAnalyses.length === 0}>
                Stats {filteredAnalyses.length > 0 && `(${filteredAnalyses.length})`}
              </NavBtn>
              <NavBtn active={view === 'repertoire'} onClick={() => setView('repertoire')} disabled={filteredAnalyses.length < 3}>
                Répertoire
              </NavBtn>
              <NavBtn
                active={view === 'library' || view === 'book'}
                onClick={() => { setActiveBookId(null); setView('library') }}
              >Bibliothèque</NavBtn>
              <NavBtn active={view === 'compare'} onClick={() => setView('compare')}>Comparer</NavBtn>
              <NavBtn active={view === 'scouting'} onClick={() => setView('scouting')}>Scouting</NavBtn>
              <NavBtn active={view === 'play'} onClick={() => setView('play')}>Jouer</NavBtn>
              <NavBtn onClick={() => { setView('home') }}>Changer de compte</NavBtn>
            </>
          )}
          <a
            href="https://github.com/DamienBoue/chess-trainer"
            target="_blank"
            rel="noopener noreferrer"
            title="Voir le code source sur GitHub"
            className="px-3 py-1.5 rounded-md text-neutral-300 hover:bg-neutral-800 transition-colors flex items-center gap-1.5"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.69-3.87-1.54-3.87-1.54-.52-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.51-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.05 11.05 0 0 1 5.79 0c2.21-1.49 3.18-1.18 3.18-1.18.62 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.42-2.69 5.4-5.25 5.68.41.36.78 1.06.78 2.14 0 1.55-.01 2.8-.01 3.18 0 .31.21.68.8.56 4.57-1.52 7.85-5.83 7.85-10.91C23.5 5.65 18.35.5 12 .5z"/>
            </svg>
            <span className="hidden sm:inline">GitHub</span>
          </a>
        </nav>
      </header>

      {username && allAnalyses.length > 0 && view !== 'home' && view !== 'analysis' && view !== 'library' && view !== 'book' && (
        <div className="border-b border-[var(--color-border)] bg-[var(--color-panel)]/60 px-6 py-2 flex items-center gap-3 flex-wrap">
          <GlobalFilters
            tcValue={tcFilter}
            onTcChange={setTcFilter}
            colorValue={colorFilter}
            onColorChange={setColorFilter}
            analyses={allAnalyses}
          />
          {(tcFilter !== 'all' || colorFilter !== 'all') && (
            <button
              onClick={() => { setTcFilter('all'); setColorFilter('all') }}
              className="text-xs text-neutral-400 hover:text-neutral-200 underline ml-auto"
            >
              Réinitialiser
            </button>
          )}
        </div>
      )}

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
            allAnalyses={allAnalyses}
            onAnalysisComplete={handleAnalysisComplete}
            onBack={() => setView('games')}
          />
        )}
        {view === 'stats' && (
          <StatsView analyses={filteredAnalyses} />
        )}
        {view === 'exercises' && (
          <ExercisesView
            analyses={filteredAnalyses}
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
        {view === 'daily' && (
          <DailyView exercises={exercises} />
        )}
        {view === 'compare' && (
          <CompareView username={username} games={games} />
        )}
        {view === 'repertoire' && (
          <RepertoireView analyses={filteredAnalyses} />
        )}
        {view === 'library' && (
          <LibraryView onOpenBook={id => { setActiveBookId(id); setView('book') }} />
        )}
        {view === 'scouting' && (
          <ScoutingView />
        )}
        {view === 'play' && (
          <PlayView engine={engineRef.current!} />
        )}
        {view === 'blunder' && (
          <BlunderDrillView analyses={filteredAnalyses} onExit={() => setView('exercises')} />
        )}
        {view === 'book' && activeBookId && (
          <BookView
            bookId={activeBookId}
            onBack={() => { setActiveBookId(null); setView('library') }}
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
