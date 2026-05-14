import { useEffect, useMemo, useRef, useState } from 'react'
import { Chess } from 'chess.js'
import TrainingBoard from './TrainingBoard'
import type { Book, BookExercise, BookProgress } from '../library/types'
import { recordOutcome, setLastReached } from '../library/storage'
import { playSuccess, playWrong, playForMove } from '../audio/sounds'
import { cleanSan, sanMatches } from '../utils/move'

type Mode = 'idle' | 'running' | 'finished'

interface RushConfig {
  durationSec: number
  maxStrikes: number
  label: string
}

const MODES: RushConfig[] = [
  { durationSec: 180, maxStrikes: 3, label: '3 minutes / 3 vies' },
  { durationSec: 300, maxStrikes: 3, label: '5 minutes / 3 vies' },
  { durationSec: 300, maxStrikes: 0, label: '5 minutes / illimité' },
  { durationSec: 0,   maxStrikes: 3, label: '3 vies / pas de chrono' },
  { durationSec: 0,   maxStrikes: 5, label: '5 vies / pas de chrono' },
]

interface AttemptRecord {
  exerciseId: string
  exerciseN: number
  chapter?: string
  correct: boolean
}

interface Props {
  book: Book
  progress: BookProgress
  onProgressChange: (p: BookProgress) => void
  onExit: () => void
}

export default function BookRushView({ book, progress, onProgressChange, onExit }: Props) {
  const chapters = useMemo(() => {
    const set = new Set<string>()
    for (const e of book.exercises) if (e.chapter) set.add(e.chapter)
    return Array.from(set)
  }, [book])

  const [mode, setMode] = useState<Mode>('idle')
  const [config, setConfig] = useState<RushConfig>(MODES[1])
  const [chapterFilter, setChapterFilter] = useState<string>('all')
  const [startFromN, setStartFromN] = useState<number>(progress.lastReachedN ?? 1)
  const [resume, setResume] = useState<boolean>((progress.lastReachedN ?? 1) > 1)

  const [queue, setQueue] = useState<BookExercise[]>([])
  const [cursor, setCursor] = useState(0)
  const [score, setScore] = useState(0)
  const [strikes, setStrikes] = useState(0)
  const [streak, setStreak] = useState(0)
  const [bestStreak, setBestStreak] = useState(0)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [history, setHistory] = useState<AttemptRecord[]>([])
  const startedAtRef = useRef<number>(0)

  useEffect(() => {
    if (mode !== 'running' || config.durationSec === 0) return
    const id = setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) { clearInterval(id); finish(); return 0 }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, config.durationSec])

  function start() {
    let pool = book.exercises
    if (chapterFilter !== 'all') pool = pool.filter(e => e.chapter === chapterFilter)
    pool = [...pool].sort((a, b) => a.n - b.n)
    if (resume) pool = pool.filter(e => e.n >= startFromN)
    setQueue(pool)
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

  function finish() { setMode('finished') }

  async function recordAttempt(correct: boolean) {
    const ex = queue[cursor]
    if (!ex) return
    setHistory(h => [...h, { exerciseId: ex.id, exerciseN: ex.n, chapter: ex.chapter, correct }])
    const updated = await recordOutcome(book.id, ex.id, correct ? 'solved' : 'wrong')
    await setLastReached(book.id, ex.n + 1)
    onProgressChange({ ...updated, lastReachedN: ex.n + 1 })

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
        if (config.maxStrikes > 0 && ns >= config.maxStrikes) finish()
        return ns
      })
    }
    setCursor(c => c + 1)
  }

  if (mode === 'idle') {
    const filteredCount = chapterFilter === 'all'
      ? book.exercises.length
      : book.exercises.filter(e => e.chapter === chapterFilter).length
    const remaining = resume
      ? book.exercises.filter(e =>
          (chapterFilter === 'all' || e.chapter === chapterFilter) && e.n >= startFromN
        ).length
      : filteredCount

    return (
      <div className="p-6 max-w-3xl mx-auto">
        <button onClick={onExit} className="text-neutral-400 hover:text-white text-sm mb-4">← Retour au livre</button>
        <h2 className="text-2xl font-semibold mb-2">{book.title} — Rush</h2>
        <p className="text-neutral-400 mb-6">
          Enchaîne les exercices <span className="font-medium">dans l'ordre du livre</span>. Une seule tentative par puzzle (premier coup uniquement).
        </p>

        {chapters.length > 1 && (
          <>
            <h3 className="text-sm font-semibold text-neutral-300 mb-2">Chapitre</h3>
            <div className="flex flex-wrap gap-2 mb-5">
              <button
                onClick={() => setChapterFilter('all')}
                className={`px-3 py-2 rounded text-sm ${chapterFilter === 'all' ? 'bg-[var(--color-accent)] text-white' : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300'}`}
              >Tous</button>
              {chapters.map(c => (
                <button
                  key={c}
                  onClick={() => setChapterFilter(c)}
                  className={`px-3 py-2 rounded text-sm ${chapterFilter === c ? 'bg-[var(--color-accent)] text-white' : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300'}`}
                >{c}</button>
              ))}
            </div>
          </>
        )}

        <h3 className="text-sm font-semibold text-neutral-300 mb-2">Format</h3>
        <div className="grid sm:grid-cols-2 gap-3 mb-5">
          {MODES.map(m => (
            <button
              key={m.label}
              onClick={() => setConfig(m)}
              className={`text-left p-3 rounded-md border transition-colors ${
                config.label === m.label
                  ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10'
                  : 'border-[var(--color-border)] hover:bg-neutral-800'
              }`}
            >
              <div className="font-semibold text-sm">{m.label}</div>
              <div className="text-xs text-neutral-500 mt-1">
                {m.durationSec > 0 ? `${m.durationSec}s` : 'pas de limite'}
                {' · '}
                {m.maxStrikes > 0 ? `${m.maxStrikes} vies` : 'erreurs illimitées'}
              </div>
            </button>
          ))}
        </div>

        <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-3 mb-5 flex items-center justify-between flex-wrap gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={resume}
              onChange={e => setResume(e.target.checked)}
              className="w-4 h-4"
            />
            Reprendre à partir de l'exercice
            <input
              type="number"
              min={1}
              max={book.exercises.length}
              value={startFromN}
              onChange={e => setStartFromN(Math.max(1, Math.min(
                book.exercises.length,
                parseInt(e.target.value || '1', 10),
              )))}
              disabled={!resume}
              className="w-20 px-2 py-0.5 rounded bg-neutral-900 border border-neutral-700 text-center disabled:opacity-40"
            />
          </label>
          <button
            onClick={() => { setStartFromN(1); setResume(false) }}
            className="text-xs text-neutral-400 hover:text-white underline"
          >
            Recommencer depuis le début
          </button>
        </div>

        <button
          onClick={start}
          className="w-full px-4 py-3 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white rounded-md font-semibold"
        >
          C'est parti — {remaining} exercices dans la file
        </button>
      </div>
    )
  }

  if (mode === 'finished') {
    const total = history.length
    const correct = history.filter(a => a.correct).length
    const acc = total ? (correct / total) * 100 : 0
    const elapsed = Math.round((Date.now() - startedAtRef.current) / 1000)
    const lastReached = history.length > 0 ? history[history.length - 1].exerciseN : (queue[cursor]?.n ?? 1)
    const nextN = lastReached + 1

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
          <h3 className="font-semibold mb-2">Avancement</h3>
          <p className="text-sm text-neutral-400">
            Tu es allé jusqu'à l'exercice <span className="font-mono text-neutral-200">#{lastReached}</span>.
            La prochaine session reprendra à <span className="font-mono text-neutral-200">#{nextN}</span>.
          </p>
        </div>

        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => { setStartFromN(nextN); setResume(true); setMode('idle') }}
            className="flex-1 px-4 py-2 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white rounded-md"
          >
            Continuer (#{nextN})
          </button>
          <button onClick={() => setMode('idle')} className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 rounded-md">
            Configurer
          </button>
          <button onClick={onExit} className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 rounded-md">
            Sortir
          </button>
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
      total={queue.length}
      cursor={cursor}
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
  exercise: BookExercise
  total: number
  cursor: number
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
  showingBest: boolean
}

const CORRECT_HOLD_MS = 900
const WRONG_HOLD_MS = 800
const WRONG_BEST_HOLD_MS = 1500

function RushBoard({
  exercise, total, cursor, onResult, score, strikes, maxStrikes, streak,
  secondsLeft, hasTimer, onQuit,
}: RushBoardProps) {
  const [position, setPosition] = useState(exercise.fen)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const chess = useMemo(() => new Chess(exercise.fen), [exercise.fen])
  const expectedSan = exercise.moves[0] ?? exercise.firstMoveSan ?? ''

  useEffect(() => {
    setPosition(exercise.fen)
    setFeedback(null)
  }, [exercise.fen])

  function tryMove(from: string, to: string, promotion: string = 'q'): boolean {
    if (feedback || !expectedSan) return false
    let attempt
    try { attempt = chess.move({ from, to, promotion }) } catch { return false }
    if (!attempt) return false

    const correct = sanMatches(attempt.san, expectedSan)
    setPosition(chess.fen())

    if (correct) {
      setFeedback({
        type: 'correct',
        playedSan: attempt.san, playedFrom: from, playedTo: to,
        showingBest: false,
      })
      playSuccess()
      setTimeout(() => onResult(true), CORRECT_HOLD_MS)
    } else {
      playWrong()
      const preview = new Chess(exercise.fen)
      let bestFrom: string | undefined, bestTo: string | undefined
      try {
        const bm = preview.move(cleanSan(expectedSan))
        if (bm) { bestFrom = bm.from; bestTo = bm.to }
      } catch { /* noop */ }

      setFeedback({
        type: 'wrong', playedSan: attempt.san,
        playedFrom: from, playedTo: to,
        bestFrom, bestTo, showingBest: false,
      })

      setTimeout(() => {
        chess.undo()
        const preview2 = new Chess(exercise.fen)
        let bm
        try { bm = preview2.move(cleanSan(expectedSan)) } catch { /* noop */ }
        setPosition(preview2.fen())
        setFeedback(f => f && { ...f, showingBest: true })
        if (bm) playForMove(bm.flags)
      }, WRONG_HOLD_MS)

      setTimeout(() => onResult(false), WRONG_HOLD_MS + WRONG_BEST_HOLD_MS)
    }
    return true
  }

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
          {streak >= 3 && <span className="ml-2 text-sm text-orange-400">🔥 série {streak}</span>}
        </div>
        <div className="flex gap-3 items-center">
          {hasTimer && (
            <span className={`text-2xl font-mono ${secondsLeft <= 10 ? 'text-red-400' : 'text-neutral-200'}`}>
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
        <span className="px-2 py-1 rounded bg-neutral-800 text-xs font-mono">#{exercise.n}</span>
        {exercise.chapter && (
          <span className="text-xs text-neutral-500">({exercise.chapter})</span>
        )}
        <span className="text-xs text-neutral-500">· {cursor + 1}/{total}</span>
        <span className="text-neutral-400">Trait aux {exercise.side === 'w' ? 'Blancs' : 'Noirs'}</span>
      </div>

      <TrainingBoard
        position={position}
        orientation={exercise.side}
        allowDragging={!feedback}
        squareStyles={squareStyles}
        onPieceDrop={({ sourceSquare, targetSquare }) => {
          if (!targetSquare) return false
          return tryMove(sourceSquare, targetSquare)
        }}
        overlay={feedback ? <FeedbackBadge feedback={feedback} /> : null}
      />

      {feedback && (
        <div className="text-center mt-4 space-y-1">
          {feedback.type === 'correct' ? (
            <p className="text-lg font-semibold text-green-400">✓ {feedback.playedSan} — bien joué !</p>
          ) : feedback.showingBest ? (
            <p className="text-lg font-semibold text-green-400">
              Le bon coup était <span className="font-mono">{expectedSan}</span>
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
  const isCorrect = feedback.type === 'correct'
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
