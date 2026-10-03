// Strategy trainer: short positional drills built from the player's own
// games ("which plan?", "find the strong square", "name the structure").

import { useMemo, useState } from 'react'
import type { GameAnalysis } from '../types'
import TrainingBoard from './TrainingBoard'
import ConceptChip from './ConceptChip'
import { type Drill, type DrillKind, DRILL_LABELS, buildDrillSet, isCorrectSquare } from '../strategy/trainer'
import { sqName } from '../strategy/board'
import type { ReviewsState } from './useStrategyReviews'
import { loadTrainerScore, recordTrainerAnswer, type TrainerScore } from '../storage/strategyPrefs'
import { OVERLAY_COLORS, strongSquareStyle, weakSquareStyle } from './strategyBoard'

interface Props {
  analyses: GameAnalysis[]
  reviews: ReviewsState
  onOpenGame: (url: string, ply?: number) => void
}

type KindFilter = 'all' | DrillKind

export default function StrategyTrainer({ analyses, reviews, onOpenGame }: Props) {
  const [filter, setFilter] = useState<KindFilter>('all')
  const [seed, setSeed] = useState(() => Date.now() % 100000)
  const [index, setIndex] = useState(0)
  const [answer, setAnswer] = useState<string | null>(null)
  const [sessionScore, setSessionScore] = useState({ answered: 0, correct: 0 })
  const [total, setTotal] = useState<TrainerScore>(() => loadTrainerScore())

  const drills = useMemo<Drill[]>(() => {
    if (!reviews.ready) return []
    return buildDrillSet(analyses, reviews.reviews, { size: 10, seed, kinds: filter === 'all' ? undefined : [filter] })
  }, [analyses, reviews, seed, filter])

  const drill = drills[index]

  function restart(nextFilter: KindFilter = filter) {
    setFilter(nextFilter)
    setSeed(s => s + 1)
    setIndex(0)
    setAnswer(null)
    setSessionScore({ answered: 0, correct: 0 })
  }

  function submit(value: string) {
    if (!drill || answer !== null) return
    const ok = drill.kind === 'square' ? isCorrectSquare(drill, value) : drill.answer.includes(value)
    setAnswer(value)
    setSessionScore(s => ({ answered: s.answered + 1, correct: s.correct + (ok ? 1 : 0) }))
    setTotal(recordTrainerAnswer(drill.kind, ok))
  }

  if (!reviews.ready) {
    return <p className="text-sm text-neutral-400">Préparation des exercices… {reviews.done}/{reviews.total}</p>
  }

  const correct = drill && answer !== null && (drill.kind === 'square' ? isCorrectSquare(drill, answer) : drill.answer.includes(answer))
  const squareStyles: Record<string, React.CSSProperties> = {}
  const arrows: { startSquare: string; endSquare: string; color: string }[] = []
  if (drill && answer !== null) {
    for (const sq of drill.squares) squareStyles[sqName(sq)] = strongSquareStyle()
    for (const [from, to] of drill.arrows) arrows.push({ startSquare: sqName(from), endSquare: sqName(to), color: OVERLAY_COLORS.plan })
    if (drill.kind === 'square' && !correct) squareStyles[answer] = weakSquareStyle()
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-md border border-[var(--color-border)] bg-neutral-900 p-0.5 text-xs" role="group" aria-label="Type d'exercice">
          {(['all', 'plan', 'square', 'structure'] as KindFilter[]).map(k => (
            <button
              key={k}
              onClick={() => restart(k)}
              aria-pressed={filter === k}
              className={`px-2.5 py-1 rounded ${filter === k ? 'bg-[var(--color-accent)] text-white' : 'text-neutral-300 hover:bg-neutral-800'}`}
            >{k === 'all' ? 'Tout' : DRILL_LABELS[k]}</button>
          ))}
        </div>
        <div className="text-xs text-neutral-400">
          Série : <span className="text-neutral-100">{sessionScore.correct}/{sessionScore.answered}</span>
          {total.answered > 0 && <> · Total : {Math.round((total.correct / total.answered) * 100)} % sur {total.answered}</>}
        </div>
      </div>

      {!drill ? (
        <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-4 text-sm text-neutral-300">
          {drills.length === 0
            ? 'Pas encore d\'exercice de ce type dans tes parties : analyse plus de parties, ou choisis « Tout ».'
            : <>Série terminée : <span className="font-semibold">{sessionScore.correct}/{sessionScore.answered}</span>.
              <button onClick={() => restart()} className="ml-2 text-xs px-2.5 py-1 rounded bg-[var(--color-accent)] text-white">Nouvelle série</button></>}
        </div>
      ) : (
        <div className="grid md:grid-cols-[minmax(0,420px)_1fr] gap-4 bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-4">
          <TrainingBoard
            id="strategy-trainer"
            position={drill.fen}
            orientation={drill.side === 'w' ? 'white' : 'black'}
            maxWidth={420}
            animationDurationInMs={0}
            arrows={arrows}
            squareStyles={squareStyles}
            onSquareClick={drill.kind === 'square' && answer === null ? ({ square }) => submit(square) : undefined}
          />
          <div className="min-w-0">
            <div className="text-xs text-neutral-500 mb-1">Question {index + 1}/{drills.length} · {DRILL_LABELS[drill.kind]}</div>
            <p className="text-sm text-neutral-100 mb-3">{drill.prompt}</p>

            {drill.choices && (
              <div className="space-y-1.5">
                {drill.choices.map(c => {
                  const isAnswer = drill.answer.includes(c.id)
                  const picked = answer === c.id
                  const cls = answer === null
                    ? 'border-[var(--color-border)] hover:bg-neutral-800 text-neutral-200'
                    : isAnswer ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-200'
                      : picked ? 'border-red-500/60 bg-red-500/10 text-red-200' : 'border-[var(--color-border)] text-neutral-500'
                  return (
                    <button key={c.id} onClick={() => submit(c.id)} disabled={answer !== null} className={`w-full text-left text-sm px-3 py-2 rounded border ${cls}`}>
                      {c.label}
                    </button>
                  )
                })}
              </div>
            )}
            {drill.kind === 'square' && answer === null && (
              <p className="text-xs text-neutral-500">Clique directement sur une case de l'échiquier.</p>
            )}

            {answer !== null && (
              <div className="mt-3 pt-3 border-t border-[var(--color-border)]">
                <p className={`text-sm font-semibold mb-1 ${correct ? 'text-emerald-300' : 'text-red-300'}`}>
                  {correct ? '✓ Bien vu !' : drill.kind === 'square' ? `✗ ${answer} n'est pas la meilleure case (réponse : ${drill.answer.join(' ou ')})` : '✗ Pas tout à fait'}
                </p>
                <p className="text-sm text-neutral-300 leading-relaxed">{drill.explanation}</p>
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  {drill.conceptId && <ConceptChip id={drill.conceptId} />}
                  {drill.source && (
                    <button onClick={() => onOpenGame(drill.source!.url, drill.source!.ply)} className="text-xs px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200">
                      Voir dans la partie ({drill.source.label})
                    </button>
                  )}
                  <button
                    onClick={() => { setIndex(i => i + 1); setAnswer(null) }}
                    className="ml-auto text-xs px-3 py-1.5 rounded bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white"
                  >Suivant →</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
