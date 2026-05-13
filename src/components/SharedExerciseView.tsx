import { useState } from 'react'
import { Chess } from 'chess.js'
import TrainingBoard from './TrainingBoard'
import type { Exercise } from '../analysis/exercises'
import { CATEGORY_LABELS, CATEGORY_COLORS } from '../analysis/exercises'

interface Props {
  exercise: Exercise
  onClose: () => void
}

export default function SharedExerciseView({ exercise, onClose }: Props) {
  const [position, setPosition] = useState(exercise.fen)
  const [status, setStatus] = useState<'pending' | 'correct' | 'wrong'>('pending')
  const [feedback, setFeedback] = useState<string | null>(null)
  const chess = useState(() => new Chess(exercise.fen))[0]

  function tryMove(from: string, to: string): boolean {
    if (status === 'correct') return false
    let attempt
    try { attempt = chess.move({ from, to, promotion: 'q' }) } catch { return false }
    if (!attempt) return false
    if (attempt.san === exercise.bestMoveSan) {
      setStatus('correct')
      setPosition(chess.fen())
      setFeedback(`✓ Excellent ! ${exercise.bestMoveSan} était bien le bon coup.`)
      return true
    }
    chess.undo()
    setStatus('wrong')
    setFeedback(`✗ ${attempt.san} n'est pas le meilleur coup. Réessaie.`)
    return false
  }

  function reveal() {
    const c = new Chess(exercise.fen)
    try { c.move(exercise.bestMoveSan) } catch { /* noop */ }
    setPosition(c.fen())
    setFeedback(`La solution était ${exercise.bestMoveSan}.`)
    setStatus('correct')
  }

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto">
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="text-2xl font-semibold">Exercice partagé</h2>
        <button onClick={onClose} className="text-sm text-neutral-400 hover:text-white">Fermer ✕</button>
      </div>

      <div className="flex items-center gap-2 mb-4 flex-wrap text-sm">
        <span
          className="px-2 py-1 rounded text-xs font-medium"
          style={{ backgroundColor: CATEGORY_COLORS[exercise.category] + '33', color: CATEGORY_COLORS[exercise.category] }}
        >
          {CATEGORY_LABELS[exercise.category]}
        </span>
        {exercise.context.opponent !== '?' && (
          <span className="text-neutral-400">vs <span className="text-neutral-200">{exercise.context.opponent}</span></span>
        )}
        {exercise.context.opening && <span className="text-xs text-neutral-500">{exercise.context.opening}</span>}
      </div>

      <TrainingBoard
        position={position}
        orientation={exercise.userColor}
        allowDragging={status !== 'correct'}
        onPieceDrop={({ sourceSquare, targetSquare }) => {
          if (!targetSquare) return false
          return tryMove(sourceSquare, targetSquare)
        }}
      />
      <div className="text-xs text-neutral-500 text-center mb-3">
        Trait aux {exercise.sideToMove === 'w' ? 'Blancs' : 'Noirs'} (toi).
      </div>

      {feedback && (
        <div className={`rounded-md p-3 text-sm font-medium mb-3 ${
          status === 'correct' ? 'text-green-400 bg-green-500/10 border border-green-500/30'
          : 'text-red-400 bg-red-500/10 border border-red-500/30'
        }`}>{feedback}</div>
      )}

      <div className="flex gap-2 flex-wrap">
        {status !== 'correct' && (
          <button onClick={reveal} className="px-3 py-1.5 text-sm bg-neutral-800 hover:bg-neutral-700 rounded">
            Voir la solution
          </button>
        )}
        <button onClick={onClose} className="px-3 py-1.5 text-sm bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white rounded">
          Aller à l'app
        </button>
      </div>
    </div>
  )
}
