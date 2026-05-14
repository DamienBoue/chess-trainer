import { useEffect, useMemo, useState } from 'react'
import { Chess } from 'chess.js'
import TrainingBoard from './TrainingBoard'
import type { Exercise } from '../analysis/exercises'
import { CATEGORY_COLORS, CATEGORY_LABELS, CATEGORY_DESCRIPTIONS } from '../analysis/exercises'
import {
  type DailyState, todayString, loadDaily, saveDaily, pickDaily, bumpStreak, decayStreakIfMissed,
} from '../storage/daily'
import { playSuccess, playWrong } from '../audio/sounds'
import EmptyState from './EmptyState'

interface Props {
  exercises: Exercise[]
  onGoToGames?: () => void
}

export default function DailyView({ exercises, onGoToGames }: Props) {
  const today = todayString()
  const [state, setState] = useState<DailyState | null>(() => decayStreakIfMissed(loadDaily(), today))

  // Auto-pick today's puzzle on mount (or when the date rolled over).
  const exercise: Exercise | null = useMemo(() => {
    // Prefer the saved id if it's today's
    if (state && state.date === today && state.exerciseId) {
      const e = exercises.find(x => x.id === state.exerciseId)
      if (e) return e
    }
    const fresh = pickDaily(exercises, today)
    return fresh
  }, [exercises, state, today])

  useEffect(() => {
    // Persist the picked exercise for today if needed
    if (!exercise) return
    if (!state || state.date !== today || state.exerciseId !== exercise.id) {
      const next: DailyState = {
        date: today,
        exerciseId: exercise.id,
        solved: state?.date === today ? !!state.solved : false,
        streak: state?.streak ?? 0,
        lastSolvedDate: state?.lastSolvedDate ?? null,
      }
      saveDaily(next)
      setState(next)
    }
  }, [exercise, state, today])

  if (exercises.length === 0) {
    return (
      <EmptyState
        icon="📅"
        title="Pas encore de puzzle quotidien"
        description="Le quotidien tire chaque jour un exercice déterministe depuis ton pool. Il faut au moins un exercice généré pour qu'il s'active."
        steps={['Va dans Parties.', 'Analyse au moins une partie.', 'Reviens demain pour démarrer ta série.']}
        cta={onGoToGames ? { label: 'Voir mes parties', onClick: onGoToGames } : undefined}
      />
    )
  }
  if (!exercise) {
    return (
      <EmptyState
        icon="📅"
        title="Aucun puzzle pour aujourd'hui"
        description="Étrange — toutes tes exercices sont à jour mais le selector du jour n'a rien tiré. Recharge la page."
      />
    )
  }

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto">
      <div className="flex items-baseline justify-between flex-wrap gap-3 mb-4">
        <h2 className="text-2xl font-semibold">Puzzle du jour</h2>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-neutral-500">{today}</span>
          <span className="px-2 py-1 bg-orange-500/15 border border-orange-500/40 text-orange-300 rounded">
            🔥 Série : {state?.streak ?? 0} jour{(state?.streak ?? 0) > 1 ? 's' : ''}
          </span>
        </div>
      </div>

      <DailyPuzzle
        key={exercise.id + today}
        exercise={exercise}
        alreadySolved={state?.solved && state?.date === today}
        onSolved={() => {
          const newStreak = bumpStreak(state, today)
          const next: DailyState = {
            date: today,
            exerciseId: exercise.id,
            solved: true,
            streak: newStreak,
            lastSolvedDate: today,
          }
          saveDaily(next)
          setState(next)
        }}
      />
    </div>
  )
}

function DailyPuzzle({
  exercise, alreadySolved, onSolved,
}: {
  exercise: Exercise
  alreadySolved: boolean | undefined
  onSolved: () => void
}) {
  const [position, setPosition] = useState(exercise.fen)
  const [status, setStatus] = useState<'pending' | 'wrong' | 'solved'>(alreadySolved ? 'solved' : 'pending')
  const [feedback, setFeedback] = useState<string | null>(alreadySolved ? '✓ Déjà résolu aujourd\'hui — reviens demain pour le suivant.' : null)
  const chess = useMemo(() => {
    const c = new Chess(exercise.fen)
    if (alreadySolved) {
      try { c.move(exercise.bestMoveSan) } catch { /* noop */ }
    }
    return c
  }, [exercise, alreadySolved])

  useEffect(() => {
    if (alreadySolved) setPosition(chess.fen())
  }, [alreadySolved, chess])

  function tryMove(from: string, to: string): boolean {
    if (status === 'solved') return false
    let attempt
    try { attempt = chess.move({ from, to, promotion: 'q' }) } catch { return false }
    if (!attempt) return false
    if (attempt.san === exercise.bestMoveSan) {
      setStatus('solved')
      setPosition(chess.fen())
      setFeedback(`✓ ${exercise.bestMoveSan} — bien joué ! Reviens demain pour le prochain.`)
      playSuccess()
      onSolved()
      return true
    }
    chess.undo()
    setStatus('wrong')
    setFeedback(`✗ ${attempt.san} n'est pas le bon coup. Essaie encore.`)
    playWrong()
    return false
  }

  function reveal() {
    const c = new Chess(exercise.fen)
    try { c.move(exercise.bestMoveSan) } catch { /* noop */ }
    setPosition(c.fen())
    setStatus('solved')
    setFeedback(`La solution était ${exercise.bestMoveSan}. (Pas de bonus de série pour aujourd'hui.)`)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap text-sm">
        <span
          className="px-2 py-1 rounded text-xs font-medium"
          style={{ backgroundColor: CATEGORY_COLORS[exercise.category] + '33', color: CATEGORY_COLORS[exercise.category] }}
        >
          {CATEGORY_LABELS[exercise.category]}
        </span>
        <span className="text-neutral-400">vs <span className="text-neutral-200">{exercise.context.opponent}</span></span>
        {exercise.context.opening && <span className="text-xs text-neutral-500">{exercise.context.opening}</span>}
      </div>

      <p className="text-sm text-neutral-300">{CATEGORY_DESCRIPTIONS[exercise.category]}</p>

      <TrainingBoard
        position={position}
        orientation={exercise.userColor}
        allowDragging={status !== 'solved'}
        onPieceDrop={({ sourceSquare, targetSquare }) => {
          if (!targetSquare) return false
          return tryMove(sourceSquare, targetSquare)
        }}
      />
      <div className="text-xs text-neutral-500 text-center">
        Trait aux {exercise.sideToMove === 'w' ? 'Blancs' : 'Noirs'} (toi).
      </div>

      {feedback && (
        <div className={`rounded-md p-3 text-sm font-medium ${
          status === 'solved' ? 'text-green-400 bg-green-500/10 border border-green-500/30'
          : status === 'wrong' ? 'text-red-400 bg-red-500/10 border border-red-500/30'
          : ''
        }`}>{feedback}</div>
      )}

      {status !== 'solved' && (
        <button onClick={reveal} className="px-3 py-1.5 text-sm bg-neutral-800 hover:bg-neutral-700 rounded">
          Voir la solution (sans bonus de série)
        </button>
      )}
    </div>
  )
}
