import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import type { ChessComGame, GameAnalysis } from './types'
import { StockfishEngine } from './engine/stockfish'
import Home from './components/Home'
import { ToastHost, toast } from './components/Toast'
import KeyboardShortcutsModal, { openShortcutsHelp } from './components/KeyboardShortcutsModal'
import Onboarding from './components/Onboarding'
import CommandPalette, { type CommandTarget } from './components/CommandPalette'
import Breadcrumbs from './components/Breadcrumbs'
import { getEngineDepth } from './storage/settings'
import GamesList from './components/GamesList'
import SharedExerciseView from './components/SharedExerciseView'
import DailyView from './components/DailyView'
import PlanView from './components/PlanView'

// Heavy or rarely-visited views are code-split: they only download when
// the user navigates to them. Cuts initial bundle from ~588 KB to ~310 KB.
const AnalysisView = lazy(() => import('./components/AnalysisView'))
const StatsView = lazy(() => import('./components/StatsView'))
const ExercisesView = lazy(() => import('./components/ExercisesView'))
const PuzzleRushView = lazy(() => import('./components/PuzzleRushView'))
const CompareView = lazy(() => import('./components/CompareView'))
const RepertoireView = lazy(() => import('./components/RepertoireView'))
const LibraryView = lazy(() => import('./components/LibraryView'))
const BookView = lazy(() => import('./components/BookView'))
const ScoutingView = lazy(() => import('./components/ScoutingView'))
const PlayView = lazy(() => import('./components/PlayView'))
const BlunderDrillView = lazy(() => import('./components/BlunderDrillView'))
const CalcDepthView = lazy(() => import('./components/CalcDepthView'))
const PlayersView = lazy(() => import('./components/PlayersView'))
const SettingsView = lazy(() => import('./components/SettingsView'))
const RoadmapView = lazy(() => import('./components/RoadmapView'))
import {
  GlobalFilters,
  applyGlobalFilters,
  type TimeClassFilter,
  type ColorFilter,
} from './components/TimeClassFilter'
import { extractExercises } from './analysis/exercises'
import { readSharedFromHash, clearShareHash } from './api/share'
import { analyzeGame } from './analysis/analyze'
import {
  loadAnalyses, saveAnalyses, clearAnalyses,
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

type View = 'home' | 'games' | 'analysis' | 'stats' | 'exercises' | 'rush' | 'daily' | 'roadmap' | 'compare' | 'repertoire' | 'library' | 'book' | 'scouting' | 'play' | 'blunder' | 'calc' | 'players' | 'settings'

export default function App() {
  const [view, setView] = useState<View>('home')
  const [activeBookId, setActiveBookId] = useState<string | null>(null)
  // Cross-view deep link: clicking a motif in Stats jumps to Exercises with
  // that motif preselected.
  const [drillMotif, setDrillMotif] = useState<import('./analysis/motifs').MotifTag | null>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [username, setUsername] = useState<string>(() => localStorage.getItem('chess.username') ?? '')
  // Games + analyses now live in IndexedDB → loaded asynchronously after
  // mount. We start empty, then hydrate from IDB in the effect below.
  const [games, setGames] = useState<ChessComGame[]>([])
  const [reloading, setReloading] = useState(false)
  const [analyses, setAnalyses] = useState<Record<string, GameAnalysis>>({})
  // Skip the first saveGames / saveAnalyses calls that fire on initial
  // mount (before hydration completes) so we don't clobber the IDB state
  // with the empty defaults.
  const hydratedRef = useRef(false)
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

  // Hydrate games + analyses from IndexedDB whenever the username changes.
  useEffect(() => {
    hydratedRef.current = false
    if (!username) {
      setGames([]); setAnalyses({})
      hydratedRef.current = true
      return
    }
    let cancelled = false
    Promise.all([loadGames(username), loadAnalyses(username)]).then(([g, a]) => {
      if (cancelled) return
      setGames(g)
      setAnalyses(a)
      hydratedRef.current = true
    })
    return () => { cancelled = true }
  }, [username])

  // Persist analyses whenever they change — but only after hydration so we
  // don't overwrite the IDB record with the empty initial state.
  useEffect(() => {
    if (username && hydratedRef.current) void saveAnalyses(username, analyses)
  }, [analyses, username])

  useEffect(() => {
    if (username && hydratedRef.current) void saveGames(username, games)
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

  function purgeAnalyses() {
    if (!username) return
    setAnalyses({})
    void clearAnalyses(username)
  }

  function resetProgress() {
    setProgress({})
    localStorage.removeItem('chess.exercise.progress')
    localStorage.removeItem('chess.repertoire.progress')
    localStorage.removeItem('chess.daily')
    localStorage.removeItem('woodpecker.progress')
    localStorage.removeItem('woodpecker.rush.lastN')
  }

  function handleLogout() {
    setUsername('')
    localStorage.removeItem('chess.username')
    setGames([])
    setAnalyses({})
    setView('home')
  }

  function handleSubmitUsername(u: string, fetched: ChessComGame[]) {
    setUsername(u)
    localStorage.setItem('chess.username', u)
    setGames(fetched)
    // The username-change effect above will hydrate analyses from IDB once
    // it's resolved; in the meantime we keep whatever is currently in state.
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
          depth: getEngineDepth(),
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
    if (!controller.signal.aborted) {
      const ok = done - failed
      if (failed === 0) toast.success(`${ok} partie${ok > 1 ? 's' : ''} analysée${ok > 1 ? 's' : ''}`)
      else toast.info(`${ok} analysée${ok > 1 ? 's' : ''}, ${failed} échec${failed > 1 ? 's' : ''}`)
    }
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
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="sm:hidden ml-auto px-2 py-1.5 rounded-md text-neutral-300 hover:bg-neutral-800"
            aria-label="Menu"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6"/>
              <line x1="3" y1="12" x2="21" y2="12"/>
              <line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
        )}
        <nav className={`${username ? 'hidden sm:flex' : 'flex'} ml-auto items-center gap-1 text-sm flex-wrap`}>
          {username && (
            <>
              <NavBtn active={view === 'home'} onClick={() => setView('home')}>Plan</NavBtn>
              <NavBtn active={view === 'roadmap'} onClick={() => setView('roadmap')}>Roadmap</NavBtn>
              <NavBtn active={view === 'games'} onClick={() => setView('games')}>Parties</NavBtn>
              <NavBtn active={view === 'stats'} onClick={() => setView('stats')} disabled={filteredAnalyses.length === 0}>
                Stats {filteredAnalyses.length > 0 && `(${filteredAnalyses.length})`}
              </NavBtn>
              <NavBtn active={view === 'repertoire'} onClick={() => setView('repertoire')} disabled={filteredAnalyses.length < 3}>
                Répertoire
              </NavBtn>
              <NavGroup
                label="Entraînement"
                active={view === 'exercises' || view === 'rush' || view === 'blunder' || view === 'calc' || view === 'library' || view === 'book'}
                items={[
                  {
                    key: 'exercises',
                    label: `Exercices${dueCount > 0 ? ` (${dueCount} dus${exerciseCount !== dueCount ? `/${exerciseCount}` : ''})` : exerciseCount > 0 ? ` (${exerciseCount})` : ''}`,
                    onClick: () => setView('exercises'),
                    disabled: exerciseCount === 0,
                    active: view === 'exercises',
                  },
                  {
                    key: 'rush',
                    label: 'Puzzle Rush',
                    onClick: () => setView('rush'),
                    disabled: exerciseCount < 5,
                    active: view === 'rush',
                  },
                  {
                    key: 'blunder',
                    label: 'Blunder reflex',
                    onClick: () => setView('blunder'),
                    disabled: exerciseCount < 3,
                    active: view === 'blunder',
                  },
                  {
                    key: 'calc',
                    label: 'Calcul (séquence)',
                    onClick: () => setView('calc'),
                    disabled: exerciseCount < 3,
                    active: view === 'calc',
                  },
                  { key: '-', divider: true } as NavMenuItem,
                  {
                    key: 'library',
                    label: 'Bibliothèque (livres)',
                    onClick: () => { setActiveBookId(null); setView('library') },
                    active: view === 'library' || view === 'book',
                  },
                ]}
              />
              <NavGroup
                label="Adversaires"
                active={view === 'compare' || view === 'scouting' || view === 'players'}
                items={[
                  {
                    key: 'compare',
                    label: 'Comparer (ami chess.com)',
                    onClick: () => setView('compare'),
                    active: view === 'compare',
                  },
                  {
                    key: 'scouting',
                    label: 'Scouting (chess.com)',
                    onClick: () => setView('scouting'),
                    active: view === 'scouting',
                  },
                  {
                    key: 'players',
                    label: 'Joueurs PGN (FIDE / OTB)',
                    onClick: () => setView('players'),
                    active: view === 'players',
                  },
                ]}
              />
              <NavBtn active={view === 'play'} onClick={() => setView('play')}>Jouer</NavBtn>
              <span className="mx-1 h-5 w-px bg-neutral-700/60" aria-hidden="true" />
              <button
                onClick={openShortcutsHelp}
                className="px-2 py-1.5 rounded-md text-neutral-300 hover:bg-neutral-800 transition-colors text-xs font-mono"
                title="Aide raccourcis clavier (?)"
                aria-label="Aide raccourcis"
              >?</button>
              <button
                onClick={() => setView('settings')}
                className={`p-1.5 rounded-md transition-colors ${
                  view === 'settings'
                    ? 'bg-[var(--color-accent)] text-white'
                    : 'text-neutral-300 hover:bg-neutral-800'
                }`}
                title="Préférences"
                aria-label="Préférences"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                </svg>
              </button>
              <button
                onClick={handleLogout}
                className="px-3 py-1.5 rounded-md text-neutral-300 hover:bg-neutral-800 text-xs"
                title="Se déconnecter"
              >@{username}</button>
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

      <Breadcrumbs crumbs={buildCrumbs(view, setView, activeGameUrl, games, activeBookId, setActiveBookId)} />

      <main className="flex-1 overflow-auto">
        <Suspense fallback={<LazyFallback />}>
        {view === 'home' && (
          username ? (
            <PlanView
              username={username}
              analyses={filteredAnalyses}
              progress={progress}
              onNavigate={(target, opts) => {
                if (opts?.motif) setDrillMotif(opts.motif)
                if (target === 'home') handleLogout()
                else setView(target as View)
              }}
            />
          ) : (
            <Home initialUsername={username} onSubmit={handleSubmitUsername} />
          )
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
          <StatsView
            analyses={filteredAnalyses}
            onDrillMotif={motif => { setDrillMotif(motif); setView('exercises') }}
            onGoToGames={() => setView('games')}
          />
        )}
        {view === 'exercises' && (
          <ExercisesView
            analyses={filteredAnalyses}
            progress={progress}
            onAttempt={handleExerciseAttempt}
            initialMotif={drillMotif ?? undefined}
            onGoToGames={() => setView('games')}
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
          <DailyView exercises={exercises} onGoToGames={() => setView('games')} />
        )}
        {view === 'roadmap' && (
          <RoadmapView
            analyses={filteredAnalyses}
            onNavigate={target => setView(target as View)}
          />
        )}
        {view === 'compare' && (
          <CompareView username={username} games={games} />
        )}
        {view === 'repertoire' && (
          <RepertoireView analyses={filteredAnalyses} onGoToGames={() => setView('games')} />
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
        {view === 'calc' && (
          <CalcDepthView analyses={filteredAnalyses} onExit={() => setView('exercises')} />
        )}
        {view === 'players' && (
          <PlayersView />
        )}
        {view === 'settings' && (
          <SettingsView
            username={username}
            onPurgeAnalyses={purgeAnalyses}
            onResetProgress={resetProgress}
          />
        )}
        {view === 'book' && activeBookId && (
          <BookView
            bookId={activeBookId}
            onBack={() => { setActiveBookId(null); setView('library') }}
          />
        )}
        </Suspense>
      </main>
      <ToastHost />
      <KeyboardShortcutsModal />
      <Onboarding />
      {username && (
        <CommandPalette
          username={username}
          analyses={allAnalyses}
          games={games}
          onNavigate={(t: CommandTarget) => {
            if (t.kind === 'view') {
              setView(t.view as View)
            } else if (t.kind === 'game') {
              setActiveGameUrl(t.gameUrl)
              setView('analysis')
            } else if (t.kind === 'book') {
              setActiveBookId(t.bookId)
              setView('book')
            }
          }}
        />
      )}
      {mobileMenuOpen && username && (
        <MobileNavSheet
          username={username}
          view={view}
          counts={{ exercises: exerciseCount, due: dueCount, analyses: filteredAnalyses.length }}
          onNavigate={v => { setView(v); setMobileMenuOpen(false) }}
          onClose={() => setMobileMenuOpen(false)}
          onOpenSettings={() => { setView('settings'); setMobileMenuOpen(false) }}
          onOpenShortcuts={() => { openShortcutsHelp(); setMobileMenuOpen(false) }}
          onLogout={() => { handleLogout(); setMobileMenuOpen(false) }}
        />
      )}
    </div>
  )
}

interface MobileNavSheetProps {
  username: string
  view: View
  counts: { exercises: number; due: number; analyses: number }
  onNavigate: (v: View) => void
  onClose: () => void
  onOpenSettings: () => void
  onOpenShortcuts: () => void
  onLogout: () => void
}

function MobileNavSheet({
  username, view, counts, onNavigate, onClose, onOpenSettings, onOpenShortcuts, onLogout,
}: MobileNavSheetProps) {
  const item = (v: View, label: string, disabled?: boolean) => (
    <button
      key={v}
      onClick={() => !disabled && onNavigate(v)}
      disabled={disabled}
      className={`w-full text-left px-4 py-3 border-b border-[var(--color-border)] ${
        view === v ? 'bg-[var(--color-accent)]/20 text-white'
                  : 'text-neutral-200 hover:bg-neutral-800 disabled:opacity-40'
      }`}
    >{label}</button>
  )
  return (
    <div className="fixed inset-0 z-40 bg-black/60 sm:hidden" onClick={onClose}>
      <div
        className="absolute right-0 top-0 bottom-0 w-72 max-w-[85vw] bg-[var(--color-panel)] border-l border-[var(--color-border)] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-[var(--color-border)] flex items-center justify-between">
          <span className="font-semibold">@{username}</span>
          <button onClick={onClose} className="text-neutral-400 hover:text-white text-xl">×</button>
        </div>
        <div className="text-xs text-neutral-500 px-4 pt-3 uppercase tracking-wider">Données</div>
        {item('home', 'Plan du jour')}
        {item('roadmap', 'Roadmap')}
        {item('games', 'Parties')}
        {item('stats', `Stats (${counts.analyses})`, counts.analyses === 0)}
        {item('repertoire', 'Répertoire', counts.analyses < 3)}
        <div className="text-xs text-neutral-500 px-4 pt-3 uppercase tracking-wider">Entraînement</div>
        {item('exercises', `Exercices${counts.due > 0 ? ` (${counts.due})` : ''}`, counts.exercises === 0)}
        {item('rush', 'Puzzle Rush', counts.exercises < 5)}
        {item('blunder', 'Blunder reflex', counts.exercises < 3)}
        {item('calc', 'Calcul', counts.exercises < 3)}
        {item('library', 'Bibliothèque')}
        <div className="text-xs text-neutral-500 px-4 pt-3 uppercase tracking-wider">Adversaires</div>
        {item('compare', 'Comparer')}
        {item('scouting', 'Scouting')}
        {item('players', 'Joueurs PGN')}
        <div className="text-xs text-neutral-500 px-4 pt-3 uppercase tracking-wider">Autre</div>
        {item('play', 'Jouer vs Stockfish')}
        <button
          onClick={onOpenSettings}
          className="w-full text-left px-4 py-3 border-b border-[var(--color-border)] hover:bg-neutral-800 text-neutral-200"
        >Préférences</button>
        <button
          onClick={onOpenShortcuts}
          className="w-full text-left px-4 py-3 border-b border-[var(--color-border)] hover:bg-neutral-800 text-neutral-200"
        >Raccourcis clavier</button>
        <button
          onClick={onLogout}
          className="w-full text-left px-4 py-3 border-b border-[var(--color-border)] hover:bg-red-900/40 text-red-300"
        >Se déconnecter</button>
      </div>
    </div>
  )
}

function buildCrumbs(
  view: View,
  setView: (v: View) => void,
  activeGameUrl: string | null,
  games: ChessComGame[],
  activeBookId: string | null,
  setActiveBookId: (id: string | null) => void,
): Array<{ label: string; onClick?: () => void }> {
  // Only nested views deserve a crumb trail. Most top-level views skip it.
  if (view === 'analysis' && activeGameUrl) {
    const g = games.find(g => g.url === activeGameUrl)
    return [
      { label: 'Parties', onClick: () => setView('games') },
      { label: g ? `vs ${g.white.username === activeGameUrl ? g.black.username : g.white.username}` : 'Analyse' },
    ]
  }
  if (view === 'book' && activeBookId) {
    return [
      { label: 'Bibliothèque', onClick: () => { setActiveBookId(null); setView('library') } },
      { label: 'Livre' },
    ]
  }
  return []
}

function LazyFallback() {
  return (
    <div className="p-6 max-w-4xl mx-auto animate-pulse">
      <div className="h-7 w-48 bg-neutral-800 rounded mb-4" />
      <div className="h-4 w-72 bg-neutral-800/60 rounded mb-6" />
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="h-32 bg-neutral-800/40 rounded" />
        <div className="h-32 bg-neutral-800/40 rounded" />
      </div>
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

// Item in a NavGroup dropdown. A `divider` entry renders a horizontal rule.
interface NavMenuItem {
  key: string
  label?: string
  onClick?: () => void
  disabled?: boolean
  active?: boolean
  divider?: boolean
}

function NavGroup({ label, active, items }: { label: string; active: boolean; items: NavMenuItem[] }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onEsc(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1 ${
          active
            ? 'bg-[var(--color-accent)] text-white'
            : 'text-neutral-300 hover:bg-neutral-800'
        }`}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {label}
        <svg width="10" height="10" viewBox="0 0 12 12" className="opacity-70" aria-hidden="true">
          <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        </svg>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-1 min-w-[14rem] bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md shadow-lg z-20 py-1"
        >
          {items.map(item => {
            if (item.divider) {
              return <div key={item.key} className="my-1 border-t border-[var(--color-border)]" />
            }
            return (
              <button
                key={item.key}
                role="menuitem"
                disabled={item.disabled}
                onClick={() => { setOpen(false); item.onClick?.() }}
                className={`w-full text-left px-3 py-1.5 text-sm transition-colors ${
                  item.active
                    ? 'bg-[var(--color-accent)] text-white'
                    : 'text-neutral-300 hover:bg-neutral-800 disabled:opacity-40 disabled:hover:bg-transparent'
                }`}
              >
                {item.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
