import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import type { ChessComGame, GameAnalysis } from './types'
import { StockfishEngine } from './engine/stockfish'
import Home from './components/Home'
import { ToastHost } from './components/Toast'
import { toast } from './components/toastBus'
import KeyboardShortcutsModal from './components/KeyboardShortcutsModal'
import { openShortcutsHelp } from './components/shortcutsHelpEvents'
import Onboarding from './components/Onboarding'
import ConceptModal from './components/ConceptModal'
import CommandPalette, { type CommandTarget } from './components/CommandPalette'
import { openCommandPalette } from './components/commandPaletteEvents'
import MobileTabBar from './components/MobileTabBar'
import HubView from './components/HubView'
import BottomSheet from './components/BottomSheet'
import Breadcrumbs from './components/Breadcrumbs'
import { getEngineDepth } from './storage/settings'
import GamesList from './components/GamesList'
import SharedExerciseView from './components/SharedExerciseView'
import DailyView from './components/DailyView'
import PlanView from './components/PlanView'
import RoadmapView from './components/RoadmapView'

import { FILTERED_VIEWS, NAV, type NavCounts, type NavTarget, hubGroup, isGroupActive, isItemActive, parentOf, titleOf } from './components/navModel'
import { type AnalysisTabId, findGameBySlug, formatRoute, gameSlug, parseHash, sameScreen, writeHash } from './components/route'
import type { StrategyTab } from './components/StrategyView'

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
const ConceptsView = lazy(() => import('./components/ConceptsView'))
const OpeningLabView = lazy(() => import('./components/OpeningLabView'))
const ReverseDrillView = lazy(() => import('./components/ReverseDrillView'))
const StrategyView = lazy(() => import('./components/StrategyView'))
import { GlobalFilters } from './components/TimeClassFilter'
import {
  applyGlobalFilters,
  labelForTimeClass,
  type TimeClassFilter,
  type ColorFilter,
} from './components/gameFilters'
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

type View = 'home' | 'games' | 'trainHub' | 'theoryHub' | 'progressHub' | 'analysis' | 'stats' | 'exercises' | 'rush' | 'daily' | 'roadmap' | 'compare' | 'repertoire' | 'library' | 'book' | 'scouting' | 'play' | 'blunder' | 'calc' | 'players' | 'settings' | 'concepts' | 'openingLab' | 'reverseDrill' | 'strategy'

// One long-lived Stockfish worker per page load, created on App's first render.
// App holds it in state, which survives Fast Refresh re-running this module;
// the module-level cache makes the initializer idempotent, since StrictMode
// double-invokes it in dev and would otherwise spawn a second worker.
let sharedEngine: StockfishEngine | null = null
function getSharedEngine(): StockfishEngine {
  if (!sharedEngine) sharedEngine = new StockfishEngine()
  return sharedEngine
}

export default function App() {
  // Screen restored from the URL (#/…): reload, shared link, back/forward.
  const [initialRoute] = useState(() => parseHash(window.location.hash))
  const [view, setView] = useState<View>(() => (initialRoute?.view as View | undefined) ?? 'home')
  const [activeBookId, setActiveBookId] = useState<string | null>(initialRoute?.bookId ?? null)
  // Cross-view deep link: clicking a motif in Stats jumps to Exercises with
  // that motif preselected.
  const [drillMotif, setDrillMotif] = useState<import('./analysis/motifs').MotifTag | null>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [filterSheetOpen, setFilterSheetOpen] = useState(false)
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
  // Ply to open the analysis at (deep links from the strategy profile/trainer).
  const [analysisStartPly, setAnalysisStartPly] = useState<number | null>(null)
  // From a URL, no tab means the default one, Bilan (see formatRoute).
  // Straight into "Revoir mes erreurs" (home's last-game card); never from a URL.
  const [analysisStartReview, setAnalysisStartReview] = useState(false)
  const [analysisStartTab, setAnalysisStartTab] = useState<AnalysisTabId | null>(
    initialRoute?.view === 'analysis' ? initialRoute.tab ?? 'review' : null)
  // A game link (#/partie/…) waits for the games to come out of IndexedDB.
  const [pendingGame, setPendingGame] = useState(() =>
    initialRoute?.view === 'analysis' && initialRoute.gameSlug
      ? { slug: initialRoute.gameSlug, ply: initialRoute.ply }
      : null)
  const [hydrated, setHydrated] = useState(false)
  if (pendingGame && hydrated) {
    const g = findGameBySlug([...games, ...Object.values(analyses)], pendingGame.slug)
    setPendingGame(null)
    if (g) {
      setActiveGameUrl(g.url)
      setAnalysisStartPly(pendingGame.ply ?? null)
    } else {
      setView('games')
    }
  }
  const [strategyTab, setStrategyTab] = useState<StrategyTab>(initialRoute?.strategyTab ?? 'profile')
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

  const [engine] = useState(getSharedEngine)
  // Note: we intentionally don't terminate the worker on unmount. React StrictMode
  // calls useEffect cleanups during dev, which would kill the engine while App
  // still holds it, leaving us with a zombie worker. The browser cleans up the
  // worker when the tab closes anyway.

  // Hydrate games + analyses from IndexedDB whenever the username changes.
  useEffect(() => {
    hydratedRef.current = false
    if (!username) {
      // Logged out: nothing to load. games/analyses are already empty (initial
      // state, or cleared by handleLogout).
      hydratedRef.current = true
      return
    }
    let cancelled = false
    Promise.all([loadGames(username), loadAnalyses(username)]).then(([g, a]) => {
      if (cancelled) return
      // Games fetched at login are fresher than the cache: keep them and
      // only add cached games they don't include (first login: cache empty).
      setGames(prev => {
        if (prev.length === 0) return g
        const seen = new Set(prev.map(x => x.url))
        return [...prev, ...g.filter(x => !seen.has(x.url))]
      })
      setAnalyses(a)
      hydratedRef.current = true
      setHydrated(true)
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

  const navCounts: NavCounts = { analyses: filteredAnalyses.length, exercises: exerciseCount, due: dueCount }

  function navigate(target: NavTarget) {
    if (target.strategyTab) setStrategyTab(target.strategyTab)
    if (target.view === 'library') setActiveBookId(null)
    setView(target.view as View)
  }

  function handleAnalyzeStart(game: ChessComGame) {
    openGameAt(game.url)
  }

  function openGameAt(url: string, ply?: number, opts?: { review?: boolean }) {
    setActiveGameUrl(url)
    setAnalysisStartPly(ply ?? null)
    setAnalysisStartTab(null)
    setAnalysisStartReview(!!opts?.review)
    setView('analysis')
  }

  // ---- URL routing ------------------------------------------------------
  // Logged out, every route lands on the login screen.
  const shownView: View = username ? view : 'home'
  const activeGame = activeGameUrl
    ? games.find(g => g.url === activeGameUrl) ?? (analyses[activeGameUrl] ? gameFromAnalysis(analyses[activeGameUrl], username) : undefined)
    : undefined
  const screenHash = formatRoute({
    view: shownView,
    gameSlug: activeGameUrl ? gameSlug(activeGameUrl) : undefined,
    strategyTab,
    bookId: activeBookId ?? undefined,
  })

  // State → URL. Moving to another screen adds a history entry; the move and
  // tab inside an analysis only replace it (see onRouteState below). The
  // landing URL (an alias, a game that is gone…) is corrected in place.
  const urlSyncedRef = useRef(false)
  useEffect(() => {
    if (sharedExercise || pendingGame) return
    const current = window.location.hash
    const landing = !urlSyncedRef.current
    urlSyncedRef.current = true
    if (sameScreen(current, screenHash)) return
    writeHash(screenHash, !landing && current.startsWith('#/') ? 'push' : 'replace')
  }, [screenHash, sharedExercise, pendingGame])

  // URL → state on back/forward (or a hand-edited hash).
  useEffect(() => {
    function onPop() {
      const r = parseHash(window.location.hash)
      if (!r) return
      if (r.view === 'analysis') {
        const g = r.gameSlug ? findGameBySlug([...games, ...Object.values(analyses)], r.gameSlug) : undefined
        if (!g) { setView('games'); return }
        setActiveGameUrl(g.url)
        setAnalysisStartPly(r.ply ?? null)
        setAnalysisStartTab(r.tab ?? 'review')
        setAnalysisStartReview(false)
      }
      if (r.strategyTab) setStrategyTab(r.strategyTab)
      if (r.view === 'book') setActiveBookId(r.bookId ?? null)
      setView(r.view as View)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [games, analyses])

  // The analysis reports its move and tab. Same game: its entry is updated
  // in place. A game just opened: its entry is added here, since this runs
  // before the screen sync above (child effects first).
  function replaceAnalysisRoute(s: { ply: number; tab: AnalysisTabId }) {
    if (!activeGameUrl) return
    const hash = formatRoute({ view: 'analysis', gameSlug: gameSlug(activeGameUrl), ply: s.ply, tab: s.tab })
    const current = window.location.hash
    if (current === hash) return
    writeHash(hash, sameScreen(current, hash) || !current.startsWith('#/') ? 'replace' : 'push')
  }

  function handleAnalysisComplete(analysis: GameAnalysis) {
    setAnalyses(prev => ({ ...prev, [analysis.url]: analysis }))
  }

  function handleExerciseAttempt(id: string, outcome: Parameters<typeof updateProgressAfterAttempt>[1]) {
    setProgress(prev => ({ ...prev, [id]: updateProgressAfterAttempt(prev[id], outcome) }))
  }

  async function handleStartBatch() {
    if (batch) return
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
        const result = await analyzeGame(engine, game, username, {
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

  // ---- Navigation chrome --------------------------------------------------
  const hub = hubGroup(shownView)
  const upScreen = username ? parentOf(shownView, strategyTab) : null
  const crumbHere = shownView === 'analysis' && activeGame
    ? `vs ${activeGame.white.username.toLowerCase() === username.toLowerCase() ? activeGame.black.username : activeGame.white.username}`
    : shownView === 'book' ? 'Livre' : titleOf(shownView, strategyTab) ?? ''
  const showFilters = !!username && allAnalyses.length > 0 && FILTERED_VIEWS.has(shownView)
  const filtersActive = tcFilter !== 'all' || colorFilter !== 'all'
  const filterSummary = filtersActive
    ? [tcFilter !== 'all' ? labelForTimeClass(tcFilter) : null, colorFilter === 'white' ? 'Blancs' : colorFilter === 'black' ? 'Noirs' : null]
      .filter(Boolean).join(' · ')
    : 'Tout'
  // The analysis is a full-screen board task: its own move bar replaces the tab bar.
  const showTabBar = !!username && shownView !== 'analysis'

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
      <header className="max-sm:sticky max-sm:top-0 z-20 border-b border-[var(--color-border)] bg-[var(--color-panel)] px-3 sm:px-6 py-1.5 sm:py-3 flex items-center gap-2 sm:gap-4">
        <h1 className={`${username ? 'hidden sm:block' : 'py-1.5 pl-1 sm:p-0'} text-lg font-semibold tracking-tight`}>
          ♞ Chess Trainer
        </h1>
        {/* Phones: where am I, and the way up (the part's hub, the games list…). */}
        {username && (upScreen ? (
          <button
            onClick={() => navigate(upScreen.target)}
            className="sm:hidden flex items-center min-w-0 h-11 pr-2 rounded-md text-neutral-200 hover:bg-neutral-800"
            aria-label={`Retour : ${upScreen.title}`}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
            <span className="truncate font-medium">{upScreen.title}</span>
          </button>
        ) : (
          <span className="sm:hidden pl-1 text-lg font-semibold truncate">{titleOf(shownView, strategyTab) ?? 'Chess Trainer'}</span>
        ))}
        {username && (
          <div className="sm:hidden ml-auto flex items-center gap-0.5 shrink-0">
            {showFilters && (
              <button
                onClick={() => setFilterSheetOpen(true)}
                className={`h-8 mr-1 px-2.5 rounded-full border text-xs flex items-center gap-1 ${
                  filtersActive
                    ? 'border-[var(--color-accent)]/60 bg-[var(--color-accent)]/15 text-[var(--color-accent-hover)]'
                    : 'border-[var(--color-border)] text-neutral-300'
                }`}
                aria-label={`Filtrer mes parties : ${filterSummary}`}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 5h18l-7 8v6l-4 2v-8z" /></svg>
                {filterSummary}
              </button>
            )}
            <button
              onClick={openCommandPalette}
              className="w-11 h-11 grid place-items-center rounded-md text-neutral-300 hover:bg-neutral-800"
              aria-label="Rechercher"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </button>
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="w-11 h-11 grid place-items-center rounded-md text-neutral-300 hover:bg-neutral-800"
              aria-label="Compte et préférences"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>
            </button>
          </div>
        )}
        <nav className={`${username ? 'hidden sm:flex' : 'flex'} ml-auto items-center gap-1 text-sm flex-wrap`}>
          {username && (
            <>
              {NAV.map(entry => entry.kind === 'item' ? (
                <NavBtn
                  key={entry.item.key}
                  active={isItemActive(entry.item, view, strategyTab)}
                  onClick={() => navigate(entry.item.target)}
                >{entry.item.label}</NavBtn>
              ) : (
                <NavGroup
                  key={entry.group.key}
                  label={entry.group.label}
                  active={isGroupActive(entry.group, view, strategyTab)}
                  items={[
                    {
                      key: 'hub',
                      label: 'Vue d\'ensemble',
                      description: entry.group.intro,
                      onClick: () => navigate({ view: entry.group.hub }),
                      active: view === entry.group.hub,
                    },
                    ...entry.group.sections.flatMap((section, si) => [
                      section.label ? { key: `h-${si}`, heading: section.label } : { key: `d-${si}`, divider: true },
                      ...section.items.map(it => {
                        const reason = it.unavailable?.(navCounts) ?? null
                        const status = reason === null ? it.status?.(navCounts) ?? null : null
                        return {
                          key: it.key,
                          label: status ? `${it.label} (${status})` : it.label,
                          description: reason ?? it.description,
                          onClick: () => navigate(it.target),
                          disabled: reason !== null,
                          active: isItemActive(it, view, strategyTab),
                        }
                      }),
                    ]),
                  ]}
                />
              ))}
              <span className="mx-1 h-5 w-px bg-neutral-700/60" aria-hidden="true" />
              <button
                onClick={openCommandPalette}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-[var(--color-border)] text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 text-xs"
                title="Rechercher une vue, une partie, un livre (Ctrl/⌘ K)"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                Rechercher
                <kbd className="font-mono text-[11px] px-1 rounded bg-neutral-800 text-neutral-400">⌘K</kbd>
              </button>
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
              <NavGroup
                label={`@${username}`}
                active={false}
                items={[
                  { key: 'shortcuts', label: 'Raccourcis clavier', description: 'Touche ? n\'importe où.', onClick: openShortcutsHelp },
                  { key: 'github', label: 'Code source', description: 'Le dépôt GitHub du projet.', onClick: () => window.open('https://github.com/DamienBoue/chess-trainer', '_blank', 'noopener,noreferrer') },
                  { key: 'd-logout', divider: true },
                  { key: 'logout', label: 'Changer de compte', description: 'Se déconnecter (tes données restent sur cet appareil).', onClick: handleLogout },
                ]}
              />
            </>
          )}
          {!username && (
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
          )}
        </nav>
      </header>

      {showFilters && (
        <div className="hidden sm:flex border-b border-[var(--color-border)] bg-[var(--color-panel)]/60 px-6 py-2 items-center gap-3 flex-wrap">
          <GlobalFilters
            tcValue={tcFilter}
            onTcChange={setTcFilter}
            colorValue={colorFilter}
            onColorChange={setColorFilter}
            analyses={allAnalyses}
          />
          {filtersActive && (
            <button
              onClick={() => { setTcFilter('all'); setColorFilter('all') }}
              className="text-xs text-neutral-400 hover:text-neutral-200 underline ml-auto"
            >
              Réinitialiser
            </button>
          )}
        </div>
      )}

      {/* Phones have the way up in the top bar. */}
      <div className="hidden sm:block">
        <Breadcrumbs crumbs={username ? buildCrumbs(shownView, strategyTab, crumbHere, navigate) : []} />
      </div>

      <main className={`flex-1 overflow-auto ${showTabBar ? 'pb-20 sm:pb-0' : ''}`}>
        <Suspense fallback={<LazyFallback />}>
        {hub && <HubView group={hub} counts={navCounts} onNavigate={navigate} />}
        {shownView === 'home' && (
          username ? (
            <PlanView
              username={username}
              analyses={filteredAnalyses}
              progress={progress}
              onOpenGame={(url, opts) => openGameAt(url, undefined, opts)}
              onNavigate={(target, opts) => {
                if (opts?.motif) setDrillMotif(opts.motif)
                if (target === 'home') handleLogout()
                else if (target === 'strategy') navigate({ view: 'strategy', strategyTab: 'trainer' })
                else if (target === 'strategyProfile') navigate({ view: 'strategy', strategyTab: 'profile' })
                else setView(target as View)
              }}
            />
          ) : (
            <Home initialUsername={username} onSubmit={handleSubmitUsername} />
          )
        )}
        {shownView === 'games' && (
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
        {shownView === 'analysis' && activeGame && (
          <AnalysisView
            // One instance per game (and per deep link) so navigation state resets.
            key={`${activeGame.url}:${analysisStartPly ?? ''}:${analysisStartTab ?? ''}${analysisStartReview ? ':revue' : ''}`}
            initialPly={analysisStartPly ?? undefined}
            initialTab={analysisStartTab ?? undefined}
            initialReviewing={analysisStartReview}
            onRouteState={replaceAnalysisRoute}
            engine={engine}
            username={username}
            game={activeGame}
            existingAnalysis={activeAnalysis}
            allAnalyses={allAnalyses}
            onAnalysisComplete={handleAnalysisComplete}
            onBack={() => setView('games')}
          />
        )}
        {shownView === 'strategy' && (
          <StrategyView analyses={filteredAnalyses} onOpenGame={openGameAt} tab={strategyTab} onTabChange={setStrategyTab} />
        )}
        {shownView === 'stats' && (
          <StatsView
            analyses={filteredAnalyses}
            onDrillMotif={motif => { setDrillMotif(motif); setView('exercises') }}
            onGoToGames={() => setView('games')}
          />
        )}
        {shownView === 'exercises' && (
          <ExercisesView
            analyses={filteredAnalyses}
            progress={progress}
            onAttempt={handleExerciseAttempt}
            initialMotif={drillMotif ?? undefined}
            onGoToGames={() => setView('games')}
          />
        )}
        {shownView === 'rush' && (
          <PuzzleRushView
            exercises={exercises}
            onAttempt={handleExerciseAttempt}
            onExit={() => setView('exercises')}
          />
        )}
        {shownView === 'daily' && (
          <DailyView exercises={exercises} onGoToGames={() => setView('games')} />
        )}
        {shownView === 'concepts' && (
          <ConceptsView />
        )}
        {shownView === 'openingLab' && (
          <OpeningLabView analyses={filteredAnalyses} onBack={() => setView('repertoire')} />
        )}
        {shownView === 'roadmap' && (
          <RoadmapView
            analyses={filteredAnalyses}
            onNavigate={target => setView(target as View)}
          />
        )}
        {shownView === 'compare' && (
          <CompareView username={username} games={games} />
        )}
        {shownView === 'repertoire' && (
          <RepertoireView
            analyses={filteredAnalyses}
            onGoToGames={() => setView('games')}
            onOpenLab={() => setView('openingLab')}
          />
        )}
        {shownView === 'library' && (
          <LibraryView onOpenBook={id => { setActiveBookId(id); setView('book') }} />
        )}
        {shownView === 'scouting' && (
          <ScoutingView />
        )}
        {shownView === 'play' && (
          <PlayView engine={engine} />
        )}
        {shownView === 'blunder' && (
          <BlunderDrillView analyses={filteredAnalyses} onExit={() => setView('exercises')} />
        )}
        {shownView === 'calc' && (
          <CalcDepthView analyses={filteredAnalyses} onExit={() => setView('exercises')} />
        )}
        {shownView === 'reverseDrill' && (
          <ReverseDrillView
            analyses={filteredAnalyses}
            onGoToGames={() => setView('games')}
          />
        )}
        {shownView === 'players' && (
          <PlayersView />
        )}
        {shownView === 'settings' && (
          <SettingsView
            username={username}
            onPurgeAnalyses={purgeAnalyses}
            onResetProgress={resetProgress}
          />
        )}
        {shownView === 'book' && activeBookId && (
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
      <ConceptModal />
      {username && (
        <CommandPalette
          username={username}
          analyses={allAnalyses}
          games={games}
          onNavigate={(t: CommandTarget) => {
            if (t.kind === 'view') {
              navigate({ view: t.view, strategyTab: t.strategyTab as StrategyTab | undefined })
            } else if (t.kind === 'game') {
              openGameAt(t.gameUrl)
            } else if (t.kind === 'book') {
              setActiveBookId(t.bookId)
              setView('book')
            }
          }}
        />
      )}
      {showTabBar && (
        <MobileTabBar view={shownView} strategyTab={strategyTab} counts={navCounts} onNavigate={navigate} />
      )}
      {mobileMenuOpen && username && (
        <BottomSheet title={`@${username}`} onClose={() => setMobileMenuOpen(false)}>
          <AccountActions
            onOpenSettings={() => { setView('settings'); setMobileMenuOpen(false) }}
            onLogout={() => { handleLogout(); setMobileMenuOpen(false) }}
          />
        </BottomSheet>
      )}
      {filterSheetOpen && showFilters && (
        <BottomSheet title="Filtrer mes parties" onClose={() => setFilterSheetOpen(false)}>
          <div className="px-4 pb-4 space-y-4">
            <p className="text-xs text-neutral-400">S'applique aux statistiques, aux exercices, au répertoire et aux entraînements.</p>
            <GlobalFilters
              tcValue={tcFilter}
              onTcChange={setTcFilter}
              colorValue={colorFilter}
              onColorChange={setColorFilter}
              analyses={allAnalyses}
            />
            <div className="flex items-center gap-2">
              {filtersActive && (
                <button
                  onClick={() => { setTcFilter('all'); setColorFilter('all') }}
                  className="h-11 px-3 text-sm text-neutral-300 hover:text-white underline"
                >Réinitialiser</button>
              )}
              <button
                onClick={() => setFilterSheetOpen(false)}
                className="ml-auto h-11 px-5 rounded-md bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white text-sm font-medium"
              >OK</button>
            </div>
          </div>
        </BottomSheet>
      )}
    </div>
  )
}

// Phones: navigation lives in the tab bar and the hubs; the account sheet
// keeps the account-level actions (no keyboard shortcuts on a phone).
function AccountActions({ onOpenSettings, onLogout }: { onOpenSettings: () => void; onLogout: () => void }) {
  const row = 'w-full text-left px-4 py-3.5 border-t border-[var(--color-border)] hover:bg-neutral-800 text-neutral-200'
  return (
    <div className="pb-2">
      <button onClick={onOpenSettings} className={row}>Préférences</button>
      <a href="https://github.com/DamienBoue/chess-trainer" target="_blank" rel="noopener noreferrer" className={`block ${row}`}>Code source (GitHub)</a>
      <button onClick={onLogout} className="w-full text-left px-4 py-3.5 border-t border-[var(--color-border)] hover:bg-red-900/40 text-red-300">
        Changer de compte
      </button>
    </div>
  )
}

// Desktop trail: the chain of parent screens, then the current one.
function buildCrumbs(
  view: string,
  strategyTab: StrategyTab,
  here: string,
  navigate: (t: NavTarget) => void,
): Array<{ label: string; onClick?: () => void }> {
  const trail: Array<{ label: string; onClick?: () => void }> = []
  for (let up = parentOf(view, strategyTab); up; up = parentOf(up.target.view, up.target.strategyTab)) {
    const target = up.target
    trail.unshift({ label: up.title, onClick: () => navigate(target) })
  }
  return [...trail, { label: here }]
}

// A game whose analysis outlived the games list (older than the months
// fetched from chess.com): enough of a record to show that analysis.
function gameFromAnalysis(a: GameAnalysis, username: string): ChessComGame {
  const side = (name: string, rating: number | undefined, won: boolean) => ({
    username: name, rating: rating ?? 0, result: a.result === 'draw' ? 'agreed' : won ? 'win' : 'lose', '@id': '',
  })
  const user = side(username, a.userRating, a.result === 'win')
  const opponent = side(a.opponent, a.opponentRating, a.result === 'loss')
  return {
    url: a.url, pgn: a.pgn, time_control: '', end_time: a.endTime, rated: true, time_class: a.timeClass, rules: 'chess',
    white: a.userColor === 'white' ? user : opponent,
    black: a.userColor === 'white' ? opponent : user,
  }
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
  description?: string
  onClick?: () => void
  disabled?: boolean
  active?: boolean
  divider?: boolean
  /** Small section title inside the menu. */
  heading?: string
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
            if (item.heading) {
              return (
                <div key={item.key} className="px-3 pt-2 pb-0.5 text-[11px] uppercase tracking-wider text-neutral-500 border-t border-[var(--color-border)] first:border-t-0 mt-1 first:mt-0">
                  {item.heading}
                </div>
              )
            }
            return (
              <button
                key={item.key}
                role="menuitem"
                disabled={item.disabled}
                onClick={() => { setOpen(false); item.onClick?.() }}
                className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                  item.active
                    ? 'bg-[var(--color-accent)] text-white'
                    : 'text-neutral-300 hover:bg-neutral-800 disabled:opacity-40 disabled:hover:bg-transparent'
                }`}
              >
                <div className="font-medium">{item.label}</div>
                {item.description && (
                  <div className={`text-[11px] mt-0.5 ${item.active ? 'text-white/80' : 'text-neutral-500'}`}>
                    {item.description}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
