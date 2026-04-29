import { useEffect, useMemo, useRef, useState } from 'react'
import { Chess } from 'chess.js'
import { Chessboard } from 'react-chessboard'
import type { Exercise } from '../analysis/exercises'
import { CATEGORY_COLORS, CATEGORY_LABELS } from '../analysis/exercises'

type Mode = 'idle' | 'running' | 'finished'

interface Props {
  exercises: Exercise[]
  onAttempt: (id: string, outcome: 'first-try' | 'after-retry' | 'failed' | 'revealed') => void
  onExit: () => void
}

interface RushConfig {
  durationSec: number
  maxStrikes: number  // 0 = unlimited
  label: string
}

const MODES: RushConfig[] = [
  { durationSec: 180, maxStrikes: 3, label: '3 minutes / 3 vies' },
  { durationSec: 300, maxStrikes: 3, label: '5 minutes / 3 vies' },
  { durationSec: 300, maxStrikes: 0, label: '5 minutes / illimité' },
  { durationSec: 0,   maxStrikes: 3, label: '3 vies / pas de chrono' },
]

interface AttemptRecord {
  exerciseId: string
  category: Exercise['category']
  correct: boolean
}

export default function PuzzleRushView({ exercises, onAttempt, onExit }: Props) {
  const [mode, setMode] = useState<Mode>('idle')
  const [config, setConfig] = useState<RushConfig>(MODES[1])
  const [queue, setQueue] = useState<Exercise[]>([])
  const [cursor, setCursor] = useState(0)
  const [score, setScore] = useState(0)
  const [strikes, setStrikes] = useState(0)
  const [streak, setStreak] = useState(0)
  const [bestStreak, setBestStreak] = useState(0)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [history, setHistory] = useState<AttemptRecord[]>([])
  const startedAtRef = useRef<number>(0)

  // Timer
  useEffect(() => {
    if (mode !== 'running' || config.durationSec === 0) return
    const id = setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) {
          clearInterval(id)
          finish()
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, config.durationSec])

  function start() {
    const shuffled = shuffle(exercises).slice(0, Math.max(20, exercises.length))
    setQueue(shuffled)
    setCursor(0)
    setScore(0)
    setStrikes(0)
    setStreak(0)
    setBestStreak(0)
    setHistory([])
    setSecondsLeft(config.durationSec)
    startedAtRef.current = Date.now()
    setMode('running')
  }

  function finish() {
    setMode('finished')
  }

  function recordAttempt(correct: boolean) {
    const ex = queue[cursor]
    if (!ex) return
    onAttempt(ex.id, correct ? 'first-try' : 'failed')
    setHistory(h => [...h, { exerciseId: ex.id, category: ex.category, correct }])
    if (correct) {
      setScore(s => s + 1)
      setStreak(s => {
        const ns = s + 1
        setBestStreak(b => Math.max(b, ns))
        return ns
      })
    } else {
      setStreak(0)
      setStrikes(s => {
        const ns = s + 1
        if (config.maxStrikes > 0 && ns >= config.maxStrikes) {
          finish()
        }
        return ns
      })
    }
    setCursor(c => c + 1)
  }

  if (exercises.length < 5) {
    return (
      <div className="p-8 max-w-3xl mx-auto text-neutral-400">
        Il faut au moins 5 exercices pour lancer un Puzzle Rush. Analyse plus de parties d'abord.
      </div>
    )
  }

  if (mode === 'idle') {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <button onClick={onExit} className="text-neutral-400 hover:text-white text-sm mb-4">← Retour aux exercices</button>
        <h2 className="text-2xl font-semibold mb-2">Puzzle Rush</h2>
        <p className="text-neutral-400 mb-6">Enchaîne le maximum d'exercices avant que le chrono ou les vies ne s'épuisent. Une seule tentative par puzzle.</p>
        <div className="grid sm:grid-cols-2 gap-3">
          {MODES.map(m => (
            <button
              key={m.label}
              onClick={() => setConfig(m)}
              className={`text-left p-4 rounded-md border transition-colors ${
                config.label === m.label
                  ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10'
                  : 'border-[var(--color-border)] hover:bg-neutral-800'
              }`}
            >
              <div className="font-semibold">{m.label}</div>
              <div className="text-xs text-neutral-500 mt-1">
                {m.durationSec > 0 ? `${m.durationSec}s` : 'pas de limite de temps'}
                {' · '}
                {m.maxStrikes > 0 ? `${m.maxStrikes} vies` : 'erreurs illimitées'}
              </div>
            </button>
          ))}
        </div>
        <button onClick={start} className="mt-6 w-full px-4 py-3 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white rounded-md font-semibold">
          C'est parti
        </button>
        <p className="text-xs text-neutral-500 mt-3">
          Pool : {exercises.length} puzzles · ordre aléatoire à chaque session
        </p>
      </div>
    )
  }

  if (mode === 'finished') {
    const total = history.length
    const correct = history.filter(a => a.correct).length
    const acc = total ? (correct / total) * 100 : 0
    const elapsed = Math.round((Date.now() - startedAtRef.current) / 1000)
    const byCategory = (['missed', 'punishment', 'defense'] as const).map(cat => {
      const list = history.filter(a => a.category === cat)
      const okCount = list.filter(a => a.correct).length
      return { cat, total: list.length, correct: okCount }
    })
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <h2 className="text-2xl font-semibold mb-4">Session terminée</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <Stat label="Score" value={score} />
          <Stat label="Précision" value={`${acc.toFixed(0)}%`} />
          <Stat label="Meilleure série" value={bestStreak} />
          <Stat label="Temps" value={`${elapsed}s`} />
        </div>

        <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-4 mb-4">
          <h3 className="font-semibold mb-3">Par catégorie</h3>
          <div className="space-y-2">
            {byCategory.map(({ cat, total, correct }) => (
              <div key={cat} className="flex items-center gap-3 text-sm">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[cat] }} />
                <span className="flex-1">{CATEGORY_LABELS[cat]}</span>
                <span className="font-mono">{correct}/{total}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <button onClick={() => setMode('idle')} className="flex-1 px-4 py-2 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white rounded-md">Rejouer</button>
          <button onClick={onExit} className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 rounded-md">Retour</button>
        </div>
      </div>
    )
  }

  // running
  const current = queue[cursor]
  if (!current) {
    return (
      <div className="p-6 max-w-3xl mx-auto text-neutral-400">
        Pool épuisé.
        <button onClick={finish} className="ml-3 px-3 py-1 bg-[var(--color-accent)] rounded">Voir le résultat</button>
      </div>
    )
  }

  return (
    <RushBoard
      exercise={current}
      onResult={recordAttempt}
      score={score}
      strikes={strikes}
      maxStrikes={config.maxStrikes}
      streak={streak}
      secondsLeft={secondsLeft}
      hasTimer={config.durationSec > 0}
      onQuit={finish}
    />
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-3 text-center">
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-neutral-500">{label}</div>
    </div>
  )
}

interface RushBoardProps {
  exercise: Exercise
  onResult: (correct: boolean) => void
  score: number
  strikes: number
  maxStrikes: number
  streak: number
  secondsLeft: number
  hasTimer: boolean
  onQuit: () => void
}

interface Feedback {
  type: 'correct' | 'wrong'
  playedSan: string
  playedFrom: string
  playedTo: string
  bestFrom?: string
  bestTo?: string
  showingBest: boolean   // for wrong answers, true once we've replayed the best move
}

const CORRECT_HOLD_MS = 1300
const WRONG_HOLD_MS = 800       // initial red flash duration before showing best
const WRONG_BEST_HOLD_MS = 1600 // how long the best move is displayed after the flash

function RushBoard({
  exercise, onResult, score, strikes, maxStrikes, streak, secondsLeft, hasTimer, onQuit,
}: RushBoardProps) {
  const [position, setPosition] = useState(exercise.fen)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const chess = useMemo(() => new Chess(exercise.fen), [exercise.fen])

  // Reset on exercise change
  useEffect(() => {
    setPosition(exercise.fen)
    setFeedback(null)
  }, [exercise.fen])

  function tryMove(from: string, to: string, promotion: string = 'q'): boolean {
    if (feedback) return false
    let attempt
    try { attempt = chess.move({ from, to, promotion }) } catch { return false }
    if (!attempt) return false

    const correct = attempt.san === exercise.bestMoveSan
    setPosition(chess.fen())

    if (correct) {
      setFeedback({
        type: 'correct',
        playedSan: attempt.san,
        playedFrom: from,
        playedTo: to,
        showingBest: false,
      })
      setTimeout(() => onResult(true), CORRECT_HOLD_MS)
    } else {
      // Compute best move squares for the upcoming reveal
      const preview = new Chess(exercise.fen)
      let bestFrom: string | undefined
      let bestTo: string | undefined
      try {
        const bm = preview.move(exercise.bestMoveSan)
        if (bm) { bestFrom = bm.from; bestTo = bm.to }
      } catch { /* noop */ }

      setFeedback({
        type: 'wrong',
        playedSan: attempt.san,
        playedFrom: from,
        playedTo: to,
        bestFrom,
        bestTo,
        showingBest: false,
      })

      // After WRONG_HOLD_MS, undo user's move and play the best move so the user sees it.
      setTimeout(() => {
        chess.undo()
        const preview2 = new Chess(exercise.fen)
        try { preview2.move(exercise.bestMoveSan) } catch { /* noop */ }
        setPosition(preview2.fen())
        setFeedback(f => f && { ...f, showingBest: true })
      }, WRONG_HOLD_MS)

      setTimeout(() => onResult(false), WRONG_HOLD_MS + WRONG_BEST_HOLD_MS)
    }
    return true
  }

  // Square highlights driven by feedback state
  const squareStyles: Record<string, React.CSSProperties> = {}
  if (feedback) {
    if (feedback.type === 'correct') {
      squareStyles[feedback.playedFrom] = { backgroundColor: 'rgba(95, 160, 82, 0.55)' }
      squareStyles[feedback.playedTo] = { backgroundColor: 'rgba(95, 160, 82, 0.75)' }
    } else if (feedback.showingBest && feedback.bestFrom && feedback.bestTo) {
      squareStyles[feedback.bestFrom] = { backgroundColor: 'rgba(95, 160, 82, 0.55)' }
      squareStyles[feedback.bestTo] = { backgroundColor: 'rgba(95, 160, 82, 0.75)' }
    } else {
      squareStyles[feedback.playedFrom] = { backgroundColor: 'rgba(208, 74, 74, 0.55)' }
      squareStyles[feedback.playedTo] = { backgroundColor: 'rgba(208, 74, 74, 0.75)' }
    }
  }

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex gap-3 items-center">
          <span className="text-3xl font-bold" style={{ color: '#5fa052' }}>{score}</span>
          <span className="text-xs text-neutral-500">SCORE</span>
          {streak >= 3 && (
            <span className="ml-2 text-sm text-orange-400">🔥 série {streak}</span>
          )}
        </div>
        <div className="flex gap-3 items-center">
          {hasTimer && (
            <span
              className={`text-2xl font-mono ${secondsLeft <= 10 ? 'text-red-400' : 'text-neutral-200'}`}
            >
              {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}
            </span>
          )}
          {maxStrikes > 0 && (
            <span className="text-sm">
              {Array.from({ length: maxStrikes }).map((_, i) => (
                <span key={i} className={i < strikes ? 'text-neutral-700' : 'text-red-400'}>♥</span>
              ))}
            </span>
          )}
          <button onClick={onQuit} className="text-xs text-neutral-500 hover:text-neutral-200 px-2 py-1">
            Arrêter
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-3 flex-wrap text-sm">
        <span
          className="px-2 py-1 rounded text-xs font-medium"
          style={{ backgroundColor: CATEGORY_COLORS[exercise.category] + '33', color: CATEGORY_COLORS[exercise.category] }}
        >
          {CATEGORY_LABELS[exercise.category]}
        </span>
        <span className="text-neutral-400">Trait aux {exercise.sideToMove === 'w' ? 'Blancs' : 'Noirs'}</span>
      </div>

      <div className="flex justify-center">
        <div className="relative w-[min(85vw,560px)]">
          <Chessboard
            options={{
              position,
              boardOrientation: exercise.userColor,
              allowDragging: !feedback,
              animationDurationInMs: 200,
              squareStyles,
              darkSquareStyle: { backgroundColor: '#769656' },
              lightSquareStyle: { backgroundColor: '#eeeed2' },
              onPieceDrop: ({ sourceSquare, targetSquare }) => {
                if (!targetSquare) return false
                return tryMove(sourceSquare, targetSquare)
              },
            }}
          />
          {feedback && <FeedbackBadge feedback={feedback} />}
        </div>
      </div>

      {feedback && (
        <div className="text-center mt-4 space-y-1">
          {feedback.type === 'correct' ? (
            <p className="text-lg font-semibold text-green-400">
              ✓ {feedback.playedSan} — bien joué !
            </p>
          ) : feedback.showingBest ? (
            <p className="text-lg font-semibold text-green-400">
              Le bon coup était <span className="font-mono">{exercise.bestMoveSan}</span>
            </p>
          ) : (
            <p className="text-lg font-semibold text-red-400">
              ✗ {feedback.playedSan} n'est pas le meilleur coup
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function FeedbackBadge({ feedback }: { feedback: Feedback }) {
  // Big centered icon overlay over the board, fades in with a subtle scale.
  const isCorrect = feedback.type === 'correct'
  // For wrong answers we hide the X once we start showing the best move
  if (!isCorrect && feedback.showingBest) return null
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div
        className="rounded-full flex items-center justify-center text-white text-5xl font-bold shadow-2xl animate-[pop_180ms_ease-out]"
        style={{
          width: '128px',
          height: '128px',
          backgroundColor: isCorrect ? 'rgba(95, 160, 82, 0.92)' : 'rgba(208, 74, 74, 0.92)',
        }}
      >
        {isCorrect ? '✓' : '✗'}
      </div>
    </div>
  )
}

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
