import { useEffect, useMemo, useRef, useState } from 'react'
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
import { type ExerciseProgress, isDue } from '../storage/persist'
import { exportExercisesToPgn, downloadPgn } from '../analysis/lichess'
import EvalBar from './EvalBar'

interface Props {
  analyses: GameAnalysis[]
  progress: Record<string, ExerciseProgress>
  onAttempt: (id: string, outcome: 'first-try' | 'after-retry' | 'failed' | 'revealed') => void
}

type StatusFilter = 'all' | 'due' | 'solved' | 'unseen'
type CategoryFilter = 'all' | ExerciseCategory

export default function ExercisesView({ analyses, progress, onAttempt }: Props) {
  const exercises = useMemo(() => extractExercises(analyses), [analyses])
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('due')
  const [activeId, setActiveId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    let list = exercises
    if (categoryFilter !== 'all') list = list.filter(e => e.category === categoryFilter)
    if (statusFilter === 'due') list = list.filter(e => isDue(progress[e.id]))
    else if (statusFilter === 'solved') list = list.filter(e => (progress[e.id]?.successes ?? 0) > 0)
    else if (statusFilter === 'unseen') list = list.filter(e => !progress[e.id])
    return list
  }, [exercises, categoryFilter, statusFilter, progress])

  // Auto-pin the first filtered exercise to activeId on mount (and whenever
  // activeId is null) so the active exercise stays sticky even after it falls
  // out of the filter (e.g. user solved it under "À réviser" — without this
  // it would drop and be replaced by the next one, looking like auto-advance).
  useEffect(() => {
    if (!activeId && filtered[0]) setActiveId(filtered[0].id)
  }, [activeId, filtered])

  const active = useMemo(
    () => (activeId ? exercises.find(e => e.id === activeId) : null) ?? filtered[0] ?? null,
    [activeId, exercises, filtered],
  )

  const counts = useMemo(() => ({
    all: exercises.length,
    due: exercises.filter(e => isDue(progress[e.id])).length,
    solved: exercises.filter(e => (progress[e.id]?.successes ?? 0) > 0).length,
    unseen: exercises.filter(e => !progress[e.id]).length,
    missed: exercises.filter(e => e.category === 'missed').length,
    punishment: exercises.filter(e => e.category === 'punishment').length,
    defense: exercises.filter(e => e.category === 'defense').length,
  }), [exercises, progress])

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
        Aucun coup-clé détecté pour l'instant. Analyse plus de parties pour en générer.
      </div>
    )
  }

  const idx = active ? filtered.findIndex(e => e.id === active.id) : -1
  // The active exercise may have dropped out of the current filter (e.g. it
  // was just solved under "À réviser"). We treat that as "off-list" but still
  // let the user navigate the filtered list.
  const isOffList = active != null && idx === -1
  const next = () => {
    if (filtered.length === 0) return
    const ni = idx >= 0 ? (idx + 1) % filtered.length : 0
    setActiveId(filtered[ni].id)
  }
  const prev = () => {
    if (filtered.length === 0) return
    const pi = idx >= 0 ? (idx - 1 + filtered.length) % filtered.length : filtered.length - 1
    setActiveId(filtered[pi].id)
  }

  function handleExport() {
    const pgn = exportExercisesToPgn(filtered, progress)
    downloadPgn(pgn, `chess-trainer-exercises-${Date.now()}.pgn`)
  }

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-baseline gap-3 mb-4">
        <h2 className="text-2xl font-semibold">Exercices</h2>
        <p className="text-sm text-neutral-400">Trouve le bon coup directement sur l'échiquier.</p>
        <button
          onClick={handleExport}
          disabled={filtered.length === 0}
          className="ml-auto px-3 py-1.5 text-sm bg-neutral-800 hover:bg-neutral-700 rounded disabled:opacity-40"
          title="Télécharger un PGN importable comme étude Lichess"
        >
          ↓ Export Lichess (.pgn)
        </button>
      </div>

      {/* Status filter */}
      <div className="flex gap-2 mb-2 flex-wrap text-xs">
        <FilterPill active={statusFilter === 'due'} onClick={() => setStatusFilter('due')} count={counts.due}>À réviser</FilterPill>
        <FilterPill active={statusFilter === 'unseen'} onClick={() => setStatusFilter('unseen')} count={counts.unseen}>Jamais vus</FilterPill>
        <FilterPill active={statusFilter === 'solved'} onClick={() => setStatusFilter('solved')} count={counts.solved}>Déjà réussis</FilterPill>
        <FilterPill active={statusFilter === 'all'} onClick={() => setStatusFilter('all')} count={counts.all}>Tous</FilterPill>
      </div>
      {/* Category filter */}
      <div className="flex gap-2 mb-4 flex-wrap text-sm">
        <FilterPill active={categoryFilter === 'all'} onClick={() => setCategoryFilter('all')} count={counts.all}>Toutes catégories</FilterPill>
        <FilterPill active={categoryFilter === 'missed'} onClick={() => setCategoryFilter('missed')} count={counts.missed} color={CATEGORY_COLORS.missed}>{CATEGORY_LABELS.missed}</FilterPill>
        <FilterPill active={categoryFilter === 'punishment'} onClick={() => setCategoryFilter('punishment')} count={counts.punishment} color={CATEGORY_COLORS.punishment}>{CATEGORY_LABELS.punishment}</FilterPill>
        <FilterPill active={categoryFilter === 'defense'} onClick={() => setCategoryFilter('defense')} count={counts.defense} color={CATEGORY_COLORS.defense}>{CATEGORY_LABELS.defense}</FilterPill>
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-6">
        {active ? (
          <ExercisePractice
            key={active.id}
            exercise={active}
            progress={progress[active.id]}
            onNext={next}
            onPrev={prev}
            canNavigate={filtered.length > 0}
            onAttempt={(outcome) => onAttempt(active.id, outcome)}
            index={idx}
            total={filtered.length}
            offList={isOffList}
          />
        ) : (
          <div className="text-neutral-500">Aucun exercice dans cette sélection.</div>
        )}

        <aside className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-3 max-h-[80vh] overflow-auto">
          <h3 className="font-semibold text-sm mb-2 text-neutral-300">Liste ({filtered.length})</h3>
          <ul className="space-y-1">
            {filtered.map(e => {
              const p = progress[e.id]
              const solved = (p?.successes ?? 0) > 0
              return (
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
                      {solved && <span className="text-xs">✓</span>}
                    </div>
                  </button>
                </li>
              )
            })}
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
      className={`px-3 py-1.5 rounded-full border transition-colors ${
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
  progress: ExerciseProgress | undefined
  onNext: () => void
  onPrev: () => void
  canNavigate: boolean
  onAttempt: (outcome: 'first-try' | 'after-retry' | 'failed' | 'revealed') => void
  index: number
  total: number
  offList: boolean
}

type Status = 'pending' | 'wrong' | 'progress' | 'completed' | 'revealed'

interface AttemptHighlight {
  type: 'correct' | 'wrong'
  from: string
  to: string
}

function ExercisePractice({
  exercise, progress, onNext, onPrev, onAttempt, index, total, offList, canNavigate,
}: PracticeProps) {
  // Parse the engine's recommended line into a list of plies. The first ply is
  // the user's move; following plies alternate engine / user. If we only have
  // bestMoveSan (no continuation), the line is just one ply long.
  const lineSans = useMemo(() => {
    const raw = (exercise.bestLineSan?.trim() || exercise.bestMoveSan).split(/\s+/).filter(Boolean)
    return raw
  }, [exercise.bestLineSan, exercise.bestMoveSan])
  const hasContinuation = lineSans.length > 1

  const [position, setPosition] = useState(exercise.fen)
  const [status, setStatus] = useState<Status>('pending')
  const [linePly, setLinePly] = useState(0)
  const [attemptsThisRound, setAttempts] = useState(0)
  const [highlight, setHighlight] = useState<AttemptHighlight | null>(null)
  const [showBadge, setShowBadge] = useState(false)
  const [reportedThisRound, setReported] = useState(false)
  const wrongTimerRef = useRef<number | null>(null)

  const chess = useMemo(() => new Chess(exercise.fen), [exercise.fen])
  const lineComplete = linePly >= lineSans.length
  const isUserTurn = linePly % 2 === 0

  useEffect(() => {
    return () => {
      if (wrongTimerRef.current) window.clearTimeout(wrongTimerRef.current)
    }
  }, [])

  // Auto-advance through the line:
  //   - status 'progress' + engine's turn  → play engine's scripted reply
  //   - status 'revealed'                  → walk through every remaining ply
  // In both cases the move is animated on the board, then we wait for the
  // next user move (status 'progress') or the next ply (status 'revealed').
  useEffect(() => {
    if (lineComplete) return
    const isReveal = status === 'revealed'
    if (!isReveal && (isUserTurn || status === 'wrong')) return
    const san = lineSans[linePly]
    if (!san) { setLinePly(lineSans.length); return }
    const timer = window.setTimeout(() => {
      let mv
      try { mv = chess.move(san) } catch { /* noop */ }
      if (!mv) { setLinePly(lineSans.length); return }
      setPosition(chess.fen())
      setHighlight({ type: 'correct', from: mv.from, to: mv.to })
      setShowBadge(false)
      const next = linePly + 1
      setLinePly(next)
      if (next >= lineSans.length && status === 'progress') setStatus('completed')
    }, 700)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linePly, isUserTurn, lineComplete, status])

  function tryMove(from: string, to: string, promotion: string = 'q'): boolean {
    if (status === 'revealed' || status === 'completed') return false
    if (!isUserTurn || lineComplete) return false

    let attempt
    try { attempt = chess.move({ from, to, promotion }) } catch { return false }
    if (!attempt) return false

    const expected = lineSans[linePly]
    if (attempt.san === expected) {
      setPosition(chess.fen())
      setHighlight({ type: 'correct', from, to })
      setShowBadge(true)
      // The badge fades quickly so the engine's reply is not hidden behind it.
      window.setTimeout(() => setShowBadge(false), 700)

      if (linePly === 0 && !reportedThisRound) {
        onAttempt(attemptsThisRound === 0 ? 'first-try' : 'after-retry')
        setReported(true)
      }
      const next = linePly + 1
      setLinePly(next)
      if (next >= lineSans.length) setStatus('completed')
      else setStatus('progress')
      return true
    }

    // Wrong move
    chess.undo()
    setAttempts(a => a + 1)
    setStatus('wrong')
    setHighlight({ type: 'wrong', from, to })
    setShowBadge(true)
    if (wrongTimerRef.current) window.clearTimeout(wrongTimerRef.current)
    wrongTimerRef.current = window.setTimeout(() => {
      setShowBadge(false)
      setHighlight(null)
      // After wrong feedback, return to whatever progress state we had
      setStatus(linePly > 0 ? 'progress' : 'pending')
    }, 1000)
    return false
  }

  function reveal() {
    // Trigger the auto-play loop for the remaining plies. The useEffect above
    // handles the actual sequencing so each move is animated one after another.
    if (wrongTimerRef.current) window.clearTimeout(wrongTimerRef.current)
    setStatus('revealed')
    setShowBadge(false)
    setHighlight(null)
    if (!reportedThisRound) {
      onAttempt('revealed')
      setReported(true)
    }
  }

  function reset() {
    if (wrongTimerRef.current) window.clearTimeout(wrongTimerRef.current)
    chess.load(exercise.fen)
    setPosition(exercise.fen)
    setStatus('pending')
    setLinePly(0)
    setAttempts(0)
    setHighlight(null)
    setShowBadge(false)
    setReported(false)
  }

  const evalBeforeUser = exercise.userColor === 'white' ? exercise.evalBeforeWhite : -exercise.evalBeforeWhite
  const evalAfterPlayedUser = exercise.userColor === 'white' ? exercise.evalAfterPlayedWhite : -exercise.evalAfterPlayedWhite

  const squareStyles: Record<string, React.CSSProperties> = {}
  if (highlight) {
    const tint = highlight.type === 'correct'
      ? ['rgba(95, 160, 82, 0.55)', 'rgba(95, 160, 82, 0.75)']
      : ['rgba(208, 74, 74, 0.55)', 'rgba(208, 74, 74, 0.75)']
    squareStyles[highlight.from] = { backgroundColor: tint[0] }
    squareStyles[highlight.to] = { backgroundColor: tint[1] }
  }

  // User-visible move counter (only counts user plies in the line)
  const userPliesTotal = Math.ceil(lineSans.length / 2)
  const userPliesDone = Math.ceil(linePly / 2)

  // Inline feedback message (right panel)
  const feedbackMessage =
    status === 'completed' ? `✓ Ligne complète ! Tu as joué tous les bons coups.`
    : status === 'progress' && hasContinuation ? `✓ Bon coup ! Continue la séquence.`
    : status === 'progress' ? `✓ Excellent — ${exercise.bestMoveSan} était bien le bon coup.`
    : status === 'wrong' ? `✗ Pas le meilleur coup. Réessaie.${attemptsThisRound > 1 ? ` (${attemptsThisRound} essais)` : ''}`
    : status === 'revealed' ? `Solution affichée — ${exercise.bestMoveSan}${hasContinuation ? ' suivi de ' + lineSans.slice(1).join(' ') : ''}.`
    : null

  return (
    <div className="space-y-4">
      {/* Nav row */}
      <div className="flex items-center justify-between text-sm">
        <button onClick={onPrev} disabled={!canNavigate || total <= 1} className="px-3 py-1 hover:bg-neutral-800 rounded disabled:opacity-30">← Précédent</button>
        <span className="text-neutral-400">
          {offList
            ? <>✓ Hors filtre · {total} restant{total > 1 ? 's' : ''} dans la sélection</>
            : <>Exercice {index + 1} / {total}</>}
        </span>
        <button onClick={onNext} disabled={!canNavigate} className="px-3 py-1 hover:bg-neutral-800 rounded disabled:opacity-30">Suivant →</button>
      </div>

      <div className="grid lg:grid-cols-[auto_1fr] gap-6">
        {/* Board column */}
        <div className="flex gap-2 items-start">
          <EvalBar evalCp={exercise.evalBeforeWhite} />
          <div className="relative w-[min(70vw,560px)]">
            <Chessboard
              options={{
                position,
                boardOrientation: exercise.userColor,
                allowDragging: status !== 'completed' && status !== 'revealed' && isUserTurn,
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
            {showBadge && (status === 'progress' || status === 'wrong') && (
              <FeedbackBadge correct={status === 'progress'} />
            )}
            {status === 'completed' && (
              <FeedbackBadge correct={true} />
            )}
            <div className="text-xs text-neutral-500 text-center mt-2">
              {status === 'completed' || status === 'revealed'
                ? <>Ligne {hasContinuation ? `(${lineSans.length} coups)` : ''} affichée.</>
                : !isUserTurn
                  ? <>L'adversaire répond…</>
                  : hasContinuation && linePly > 0
                    ? <>Trouve le coup suivant ({userPliesDone + 1}/{userPliesTotal})</>
                    : <>Trait aux {exercise.sideToMove === 'w' ? 'Blancs' : 'Noirs'} (toi).</>}
            </div>
          </div>
        </div>

        {/* Right panel column */}
        <div className="space-y-3">
          <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-4">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span
                className="px-2 py-1 rounded text-xs font-medium"
                style={{ backgroundColor: CATEGORY_COLORS[exercise.category] + '33', color: CATEGORY_COLORS[exercise.category] }}
              >
                {CATEGORY_LABELS[exercise.category]}
              </span>
              {progress && (
                <span className="ml-auto text-xs text-neutral-500">
                  {progress.successes}✓ / {progress.failures}✗
                </span>
              )}
            </div>
            <div className="text-sm text-neutral-300">
              vs <span className="text-neutral-100">{exercise.context.opponent}</span>
              <span className="text-neutral-500"> · {exercise.context.moveLabel}</span>
              {exercise.context.opening && (
                <div className="text-xs text-neutral-500 mt-0.5">{exercise.context.opening}</div>
              )}
            </div>
            <p className="text-sm text-neutral-400 mt-2">{CATEGORY_DESCRIPTIONS[exercise.category]}</p>
            {progress && progress.nextDueAt > Date.now() && (
              <p className="text-xs text-neutral-500 mt-2">
                Prochaine révision : {formatDueDelta(progress.nextDueAt - Date.now())}
              </p>
            )}
          </div>

          {feedbackMessage && (
            <div
              className="rounded-md p-3 text-sm font-medium"
              style={{
                backgroundColor:
                  (status === 'progress' || status === 'completed') ? 'rgba(95,160,82,0.15)'
                  : status === 'wrong' ? 'rgba(208,74,74,0.15)'
                  : 'rgba(120,120,120,0.15)',
                border: `1px solid ${
                  (status === 'progress' || status === 'completed') ? 'rgba(95,160,82,0.5)'
                  : status === 'wrong' ? 'rgba(208,74,74,0.5)'
                  : 'rgba(120,120,120,0.5)'
                }`,
                color:
                  (status === 'progress' || status === 'completed') ? 'rgb(95,160,82)'
                  : status === 'wrong' ? 'rgb(208,74,74)'
                  : '#ccc',
              }}
            >
              {feedbackMessage}
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
            {(status === 'completed' || status === 'revealed') && (
              <button onClick={onNext} className="px-3 py-1.5 text-sm bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white rounded">
                Exercice suivant →
              </button>
            )}
          </div>

          {(status === 'completed' || status === 'revealed') && (
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
      </div>
    </div>
  )
}

function FeedbackBadge({ correct }: { correct: boolean }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div
        className="rounded-full flex items-center justify-center text-white text-5xl font-bold shadow-2xl animate-[pop_180ms_ease-out]"
        style={{
          width: '112px',
          height: '112px',
          backgroundColor: correct ? 'rgba(95, 160, 82, 0.92)' : 'rgba(208, 74, 74, 0.92)',
        }}
      >
        {correct ? '✓' : '✗'}
      </div>
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

function formatDueDelta(ms: number): string {
  const days = ms / 86400_000
  if (days < 1) return `dans ${Math.max(1, Math.round(ms / 3600_000))}h`
  if (days < 30) return `dans ${Math.round(days)}j`
  return `dans ${Math.round(days / 30)} mois`
}
