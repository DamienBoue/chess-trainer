import { useMemo, useRef, useState } from 'react'
import type { ChessComGame, GameAnalysis } from './types'
import { StockfishEngine } from './engine/stockfish'
import Home from './components/Home'
import GamesList from './components/GamesList'
import AnalysisView from './components/AnalysisView'
import StatsView from './components/StatsView'
import ExercisesView from './components/ExercisesView'
import { extractExercises } from './analysis/exercises'

type View = 'home' | 'games' | 'analysis' | 'stats' | 'exercises'

export default function App() {
  const [view, setView] = useState<View>('home')
  const [username, setUsername] = useState<string>(() => localStorage.getItem('chess.username') ?? '')
  const [games, setGames] = useState<ChessComGame[]>([])
  const [analyses, setAnalyses] = useState<Record<string, GameAnalysis>>({})
  const [activeGameUrl, setActiveGameUrl] = useState<string | null>(null)

  const engineRef = useRef<StockfishEngine | null>(null)
  if (!engineRef.current) engineRef.current = new StockfishEngine()
  // Note: we intentionally don't terminate the worker on unmount. React StrictMode
  // calls useEffect cleanups during dev, which would kill the engine while the ref
  // still points to it, leaving us with a zombie worker. The browser cleans up the
  // worker when the tab closes anyway.

  const activeAnalysis = activeGameUrl ? analyses[activeGameUrl] : null
  const allAnalyses = useMemo(() => Object.values(analyses), [analyses])
  const exerciseCount = useMemo(() => extractExercises(allAnalyses).length, [allAnalyses])

  function handleSubmitUsername(u: string, fetched: ChessComGame[]) {
    setUsername(u)
    localStorage.setItem('chess.username', u)
    setGames(fetched)
    setView('games')
  }

  function handleAnalyzeStart(game: ChessComGame) {
    setActiveGameUrl(game.url)
    setView('analysis')
  }

  function handleAnalysisComplete(analysis: GameAnalysis) {
    setAnalyses(prev => ({ ...prev, [analysis.url]: analysis }))
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
        <nav className="ml-auto flex gap-1 text-sm">
          {username && (
            <>
              <NavBtn active={view === 'games'} onClick={() => setView('games')}>Parties</NavBtn>
              <NavBtn active={view === 'exercises'} onClick={() => setView('exercises')} disabled={exerciseCount === 0}>
                Exercices {exerciseCount > 0 && `(${exerciseCount})`}
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
          <ExercisesView analyses={allAnalyses} />
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
