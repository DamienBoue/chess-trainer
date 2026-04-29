import { useMemo, useState } from 'react'
import { Chess } from 'chess.js'
import { Chessboard } from 'react-chessboard'
import type { GameAnalysis } from '../types'
import {
  type Exercise,
  type ExerciseCategory,
  CATEGORY_LABELS,
  CATEGORY_DESCRIPTIONS,
  CATEGORY_COLORS,
  extractExercises,
} from '../analysis/exercises'

interface Props {
  analyses: GameAnalysis[]
}

type Filter = 'all' | ExerciseCategory

export default function ExercisesView({ analyses }: Props) {
  const exercises = useMemo(() => extractExercises(analyses), [analyses])
  const [filter, setFilter] = useState<Filter>('all')
  const filtered = useMemo(
    () => filter === 'all' ? exercises : exercises.filter(e => e.category === filter),
    [filter, exercises],
  )
  const [activeId, setActiveId] = useState<string | null>(null)
  const active = filtered.find(e => e.id === activeId) ?? filtered[0] ?? null
  const counts = useMemo(() => ({
    all: exercises.length,
    missed: exercises.filter(e => e.category === 'missed').length,
    punishment: exercises.filter(e => e.category === 'punishment').length,
    defense: exercises.filter(e => e.category === 'defense').length,
  }), [exercises])

  if (analyses.length === 0) {
    return (
      <div className="p-8 max-w-3xl mx-auto text-neutral-400">
        Tu n'as encore analysé aucune partie. Va dans "Parties" et clique sur une partie pour générer des exercices à partir de tes coups clés.
      </div>
    )
  }
  if (exercises.length === 0) {
    return (
      <div className="p-8 max-w-3xl mx-auto text-neutral-400">
        Aucun coup-clé détecté pour l'instant dans tes parties analysées (pas d'erreur grave, pas de punition, pas de position défensive franche). Analyse plus de parties pour en générer.
      </div>
    )
  }

  const idx = active ? filtered.findIndex(e => e.id === active.id) : -1
  const next = () => {
    if (filtered.length === 0) return
    const ni = (idx + 1) % filtered.length
    setActiveId(filtered[ni].id)
  }
  const prev = () => {
    if (filtered.length === 0) return
    const pi = (idx - 1 + filtered.length) % filtered.length
    setActiveId(filtered[pi].id)
  }

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-baseline gap-3 mb-4">
        <h2 className="text-2xl font-semibold">Exercices ({exercises.length})</h2>
        <p className="text-sm text-neutral-400">Trouve le bon coup directement sur l'échiquier.</p>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        <FilterPill active={filter === 'all'} onClick={() => setFilter('all')} count={counts.all}>Tous</FilterPill>
        <FilterPill active={filter === 'missed'} onClick={() => setFilter('missed')} count={counts.missed} color={CATEGORY_COLORS.missed}>{CATEGORY_LABELS.missed}</FilterPill>
        <FilterPill active={filter === 'punishment'} onClick={() => setFilter('punishment')} count={counts.punishment} color={CATEGORY_COLORS.punishment}>{CATEGORY_LABELS.punishment}</FilterPill>
        <FilterPill active={filter === 'defense'} onClick={() => setFilter('defense')} count={counts.defense} color={CATEGORY_COLORS.defense}>{CATEGORY_LABELS.defense}</FilterPill>
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-6">
        {active ? (
          <ExercisePractice key={active.id} exercise={active} onNext={next} onPrev={prev} index={idx} total={filtered.length} />
        ) : (
          <div className="text-neutral-500">Aucun exercice dans cette catégorie.</div>
        )}

        <aside className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-3 max-h-[80vh] overflow-auto">
          <h3 className="font-semibold text-sm mb-2 text-neutral-300">Liste</h3>
          <ul className="space-y-1">
            {filtered.map(e => (
              <li key={e.id}>
                <button
                  onClick={() => setActiveId(e.id)}
                  className={`w-full text-left px-2 py-1.5 rounded text-sm transition-colors ${
                    active?.id === e.id ? 'bg-[var(--color-accent)] text-white' : 'hover:bg-neutral-800 text-neutral-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: CATEGORY_COLORS[e.category] }}
                    />
                    <span className="font-mono text-xs">{e.context.moveLabel}</span>
                    <span className="truncate flex-1 text-xs">vs {e.context.opponent}</span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  )
}

function FilterPill({
  children, active, onClick, count, color,
}: {
  children: React.ReactNode
  active: boolean
  onClick: () => void
  count: number
  color?: string
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
        active
          ? 'bg-[var(--color-accent)] border-[var(--color-accent)] text-white'
          : 'border-[var(--color-border)] text-neutral-300 hover:bg-neutral-800'
      }`}
    >
      {color && !active && (
        <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: color }} />
      )}
      {children} <span className="opacity-60">({count})</span>
    </button>
  )
}

interface PracticeProps {
  exercise: Exercise
  onNext: () => void
  onPrev: () => void
  index: number
  total: number
}

type Status = 'pending' | 'wrong' | 'correct' | 'revealed'

function ExercisePractice({ exercise, onNext, onPrev, index, total }: PracticeProps) {
  // Reset state when exercise changes (key prop in parent triggers remount)
  const [position, setPosition] = useState(exercise.fen)
  const [status, setStatus] = useState<Status>('pending')
  const [feedback, setFeedback] = useState<string | null>(null)
  const [attemptsThisRound, setAttempts] = useState(0)
  const [highlightFrom, setHighlightFrom] = useState<string | null>(null)
  const [highlightTo, setHighlightTo] = useState<string | null>(null)

  const chess = useMemo(() => new Chess(exercise.fen), [exercise.fen])

  function tryMove(from: string, to: string, promotion: string = 'q'): boolean {
    if (status === 'correct' || status === 'revealed') return false

    let attempt
    try {
      attempt = chess.move({ from, to, promotion })
    } catch {
      return false
    }
    if (!attempt) return false

    if (attempt.san === exercise.bestMoveSan) {
      setStatus('correct')
      setPosition(chess.fen())
      setHighlightFrom(from)
      setHighlightTo(to)
      setFeedback(`Excellent ! ${exercise.bestMoveSan} était bien le bon coup.`)
      return true
    }
    // Wrong: undo and let user retry
    chess.undo()
    setAttempts(a => a + 1)
    setStatus('wrong')
    setFeedback(`${attempt.san} n'est pas le meilleur coup. Réessaie.`)
    return false
  }

  function reveal() {
    // Apply the best move on the board so user sees the answer
    const c = new Chess(exercise.fen)
    try {
      c.move(exercise.bestMoveSan)
    } catch {
      /* shouldn't happen */
    }
    setPosition(c.fen())
    setStatus('revealed')
    setFeedback(`La solution était ${exercise.bestMoveSan}.`)
  }

  function reset() {
    chess.load(exercise.fen)
    setPosition(exercise.fen)
    setStatus('pending')
    setFeedback(null)
    setAttempts(0)
    setHighlightFrom(null)
    setHighlightTo(null)
  }

  const evalBeforeUser = exercise.userColor === 'white' ? exercise.evalBeforeWhite : -exercise.evalBeforeWhite
  const evalAfterPlayedUser = exercise.userColor === 'white' ? exercise.evalAfterPlayedWhite : -exercise.evalAfterPlayedWhite

  const squareStyles: Record<string, React.CSSProperties> = {}
  if (highlightFrom) squareStyles[highlightFrom] = { backgroundColor: 'rgba(118, 150, 86, 0.55)' }
  if (highlightTo) squareStyles[highlightTo] = { backgroundColor: 'rgba(118, 150, 86, 0.7)' }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <button onClick={onPrev} disabled={total <= 1} className="px-3 py-1 hover:bg-neutral-800 rounded disabled:opacity-30">← Précédent</button>
        <span className="text-neutral-400">Exercice {index + 1} / {total}</span>
        <button onClick={onNext} disabled={total <= 1} className="px-3 py-1 hover:bg-neutral-800 rounded disabled:opacity-30">Suivant →</button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span
          className="px-2 py-1 rounded text-xs font-medium"
          style={{ backgroundColor: CATEGORY_COLORS[exercise.category] + '33', color: CATEGORY_COLORS[exercise.category] }}
        >
          {CATEGORY_LABELS[exercise.category]}
        </span>
        <span className="text-sm text-neutral-400">
          vs <span className="text-neutral-200">{exercise.context.opponent}</span> · {exercise.context.moveLabel}{' '}
          {exercise.context.opening && <span className="text-xs">· {exercise.context.opening}</span>}
        </span>
      </div>

      <p className="text-sm text-neutral-300">{CATEGORY_DESCRIPTIONS[exercise.category]}</p>

      <div className="flex gap-3">
        <div className="w-[min(70vw,520px)]">
          <Chessboard
            options={{
              position,
              boardOrientation: exercise.userColor,
              allowDragging: status !== 'correct' && status !== 'revealed',
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
          <div className="text-xs text-neutral-500 text-center mt-2">
            Trait aux {exercise.sideToMove === 'w' ? 'Blancs' : 'Noirs'} (toi).
          </div>
        </div>
      </div>

      {feedback && (
        <div
          className="rounded-md p-3 text-sm"
          style={{
            backgroundColor:
              status === 'correct' ? 'rgba(95,160,82,0.15)'
              : status === 'wrong' ? 'rgba(208,74,74,0.15)'
              : 'rgba(120,120,120,0.15)',
            border: `1px solid ${
              status === 'correct' ? 'rgba(95,160,82,0.5)'
              : status === 'wrong' ? 'rgba(208,74,74,0.5)'
              : 'rgba(120,120,120,0.5)'
            }`,
          }}
        >
          {feedback}
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        {(status === 'wrong' || status === 'pending') && (
          <button onClick={reveal} className="px-3 py-1.5 text-sm bg-neutral-800 hover:bg-neutral-700 rounded">
            Voir la solution
          </button>
        )}
        {status !== 'pending' && (
          <button onClick={reset} className="px-3 py-1.5 text-sm bg-neutral-800 hover:bg-neutral-700 rounded">
            Recommencer
          </button>
        )}
        {(status === 'correct' || status === 'revealed') && (
          <button onClick={onNext} className="px-3 py-1.5 text-sm bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white rounded">
            Exercice suivant →
          </button>
        )}
        {attemptsThisRound > 0 && status === 'wrong' && (
          <span className="text-xs text-neutral-500 self-center">{attemptsThisRound} essai{attemptsThisRound > 1 ? 's' : ''}</span>
        )}
      </div>

      {(status === 'correct' || status === 'revealed') && (
        <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-3 space-y-2 text-sm">
          <div>
            <span className="text-neutral-500">Coup recommandé : </span>
            <span className="font-mono text-neutral-100">{exercise.bestMoveSan}</span>
            {exercise.bestLineSan && (
              <span className="text-neutral-500 text-xs ml-2">(suite : {exercise.bestLineSan})</span>
            )}
          </div>
          <div>
            <span className="text-neutral-500">Coup joué dans la partie : </span>
            <span className="font-mono text-neutral-300">{exercise.playedMoveSan}</span>
            {exercise.category === 'missed' && (
              <span className="text-xs text-neutral-500 ml-2">
                ({exercise.playedClassification === 'blunder' ? 'gaffe' : 'erreur'} de {exercise.cpSwing} cp)
              </span>
            )}
          </div>
          <div className="text-xs text-neutral-500">
            Avant : {formatEval(evalBeforeUser)} pour toi · après ton coup réel : {formatEval(evalAfterPlayedUser)}
          </div>
        </div>
      )}
    </div>
  )
}

function formatEval(cpFromUser: number): string {
  if (Math.abs(cpFromUser) > 50000) {
    const mateIn = 100000 - Math.abs(cpFromUser)
    return cpFromUser > 0 ? `+M${mateIn}` : `-M${mateIn}`
  }
  const pawns = cpFromUser / 100
  return (pawns >= 0 ? '+' : '') + pawns.toFixed(1)
}
