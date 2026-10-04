import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Chess } from 'chess.js'
import TrainingBoard from './TrainingBoard'
import type { GameAnalysis } from '../types'
import {
  type Exercise,
  type MotifTag,
  CATEGORY_LABELS,
  CATEGORY_DESCRIPTIONS,
  CATEGORY_COLORS,
  MOTIF_LABELS,
  DIFFICULTY_LABELS,
  DIFFICULTY_COLORS,
  extractExercises,
} from '../analysis/exercises'
import { type ExerciseProgress, isDue } from '../storage/persist'
import { exportExercisesToPgn, downloadPgn } from '../analysis/lichess'
import EvalBar from './EvalBar'
import { playForMove, playSuccess, playWrong } from '../audio/sounds'
import { exerciseToShareUrl } from '../api/share'
import { evaluateMultiPV, topGapCp } from '../engine/multipv'
import EmptyState from './EmptyState'
import {
  type CategoryFilter,
  type DifficultyFilter,
  type FilterCounts,
  type MotifFilter,
  type StatusFilter,
  CATEGORY_KEYS,
  DIFFICULTY_KEYS,
  STATUS_OPTIONS,
  exerciseCountLabel,
  filtersSummary,
} from './exerciseFilters'
import { useIsPhone } from './useIsPhone'

interface Props {
  analyses: GameAnalysis[]
  progress: Record<string, ExerciseProgress>
  onAttempt: (id: string, outcome: 'first-try' | 'after-retry' | 'failed' | 'revealed') => void
  /** Optional motif preselected by an upstream link (e.g. "Drill" button on
   *  the motif radar in Stats). */
  initialMotif?: MotifTag
  /** Navigation callback for the empty-state CTAs. */
  onGoToGames?: () => void
}

export default function ExercisesView({ analyses, progress, onAttempt, initialMotif, onGoToGames }: Props) {
  const exercises = useMemo(() => extractExercises(analyses), [analyses])
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('due')
  const [motifFilter, setMotifFilter] = useState<MotifFilter>(initialMotif ?? 'all')
  const [difficultyFilter, setDifficultyFilter] = useState<DifficultyFilter>('all')
  const [activeId, setActiveId] = useState<string | null>(null)
  // Phones: the filter chips live behind a "Filtres" disclosure (closed by
  // default so the board comes first). Wider screens always show them.
  const isPhone = useIsPhone()
  const [filtersOpen, setFiltersOpen] = useState(false)
  const filtersPanelId = useId()

  // If the upstream changes `initialMotif` (e.g. user clicks another row in
  // the radar without leaving the app), follow it. Done during render
  // against the previous prop value.
  const [prevInitialMotif, setPrevInitialMotif] = useState(initialMotif)
  if (prevInitialMotif !== initialMotif) {
    setPrevInitialMotif(initialMotif)
    if (initialMotif && motifFilter !== initialMotif) {
      setMotifFilter(initialMotif)
      setStatusFilter('all')      // show ALL exercises with this motif, not just due
      setCategoryFilter('missed') // the drill button targets misses
      setActiveId(null)
    }
  }

  const filtered = useMemo(() => {
    let list = exercises
    if (categoryFilter !== 'all') list = list.filter(e => e.category === categoryFilter)
    if (motifFilter !== 'all') list = list.filter(e => e.motifs.includes(motifFilter))
    if (difficultyFilter !== 'all') list = list.filter(e => e.difficulty === difficultyFilter)
    if (statusFilter === 'due') list = list.filter(e => isDue(progress[e.id]))
    else if (statusFilter === 'solved') list = list.filter(e => (progress[e.id]?.successes ?? 0) > 0)
    else if (statusFilter === 'unseen') list = list.filter(e => !progress[e.id])
    return list
  }, [exercises, categoryFilter, motifFilter, difficultyFilter, statusFilter, progress])

  // Auto-pin the first filtered exercise to activeId on mount (and whenever
  // activeId is null) so the active exercise stays sticky even after it falls
  // out of the filter (e.g. user solved it under "À réviser" — without this
  // it would drop and be replaced by the next one, looking like auto-advance).
  // Pinned during render; it is the exercise `active` falls back to anyway.
  if (!activeId && filtered[0]) setActiveId(filtered[0].id)

  const active = useMemo(
    () => (activeId ? exercises.find(e => e.id === activeId) : null) ?? filtered[0] ?? null,
    [activeId, exercises, filtered],
  )

  const counts = useMemo<FilterCounts>(() => ({
    all: exercises.length,
    due: exercises.filter(e => isDue(progress[e.id])).length,
    solved: exercises.filter(e => (progress[e.id]?.successes ?? 0) > 0).length,
    unseen: exercises.filter(e => !progress[e.id]).length,
    missed: exercises.filter(e => e.category === 'missed').length,
    punishment: exercises.filter(e => e.category === 'punishment').length,
    defense: exercises.filter(e => e.category === 'defense').length,
    easy: exercises.filter(e => e.difficulty === 'easy').length,
    medium: exercises.filter(e => e.difficulty === 'medium').length,
    hard: exercises.filter(e => e.difficulty === 'hard').length,
  }), [exercises, progress])

  if (analyses.length === 0) {
    return (
      <EmptyState
        icon="🎯"
        title="Pas encore d'exercices"
        description="Les exercices sont générés depuis tes coups-clés (gaffes, punitions, défenses) repérés par Stockfish dans tes parties analysées."
        steps={[
          'Va dans Parties pour voir tes 20 dernières parties chess.com.',
          'Lance "Tout analyser" — quelques minutes pour 10 parties.',
          "Reviens ici : les exercices apparaissent automatiquement, triés par sévérité de l'erreur.",
        ]}
        cta={onGoToGames ? { label: 'Voir mes parties', onClick: onGoToGames } : undefined}
      />
    )
  }
  if (exercises.length === 0) {
    return (
      <EmptyState
        icon="🎯"
        title="Aucun coup-clé détecté"
        description="Tes parties analysées n'ont pas (encore) produit d'erreur assez nette pour générer un exercice. Analyse plus de parties pour alimenter le pool."
        cta={onGoToGames ? { label: 'Voir mes parties', onClick: onGoToGames } : undefined}
      />
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

  const filterRows = (
    <FilterRows
      status={statusFilter}
      onStatus={setStatusFilter}
      category={categoryFilter}
      onCategory={setCategoryFilter}
      difficulty={difficultyFilter}
      onDifficulty={setDifficultyFilter}
      motif={motifFilter}
      onClearMotif={() => setMotifFilter('all')}
      counts={counts}
    />
  )

  return (
    <div className="px-3 py-3 sm:p-4 lg:p-6 max-w-7xl mx-auto">
      {isPhone ? (
        <>
          {/* Phone: a compact title row, then one "Filtres" line; the board comes right after. */}
          <div className="flex items-baseline justify-between gap-2 mb-2">
            <h2 className="text-xl font-semibold">Exercices</h2>
            <span className="text-xs text-neutral-500">{counts.all} au total</span>
          </div>
          <div className="mb-3">
            <FiltersToggle
              open={filtersOpen}
              onToggle={() => setFiltersOpen(o => !o)}
              panelId={filtersPanelId}
              summary={filtersSummary({
                status: statusFilter,
                category: categoryFilter,
                difficulty: difficultyFilter,
                motif: motifFilter,
              })}
              count={filtered.length}
            />
            {filtersOpen && (
              <div
                id={filtersPanelId}
                className="mt-2 flex flex-col gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-panel)] p-3"
              >
                {filterRows}
                {/* Export is secondary on a phone: it lives with the selection it exports. */}
                <div className="mt-1 border-t border-[var(--color-border)] pt-3">
                  <ExportButton
                    onExport={handleExport}
                    disabled={filtered.length === 0}
                    className="w-full min-h-10 px-3 text-sm bg-neutral-800 hover:bg-neutral-700 rounded disabled:opacity-40"
                  />
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-baseline gap-3 mb-4">
            <h2 className="text-2xl font-semibold">Exercices</h2>
            <p className="text-sm text-neutral-400">Trouve le bon coup directement sur l'échiquier.</p>
            <ExportButton
              onExport={handleExport}
              disabled={filtered.length === 0}
              className="ml-auto px-3 py-1.5 text-sm bg-neutral-800 hover:bg-neutral-700 rounded disabled:opacity-40"
            />
          </div>
          {filterRows}
        </>
      )}

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

        <aside className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-3 max-h-64 sm:max-h-[80vh] overflow-auto">
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

interface FilterRowsProps {
  status: StatusFilter
  onStatus: (v: StatusFilter) => void
  category: CategoryFilter
  onCategory: (v: CategoryFilter) => void
  difficulty: DifficultyFilter
  onDifficulty: (v: DifficultyFilter) => void
  motif: MotifFilter
  onClearMotif: () => void
  counts: FilterCounts
}

// The chip rows. Rendered as a fragment: on wide screens the rows sit directly
// in the page (spacing via `sm:mb-*`), on phones the caller wraps them in the
// "Filtres" panel, which spaces them with a flex gap instead.
function FilterRows({
  status, onStatus, category, onCategory, difficulty, onDifficulty, motif, onClearMotif, counts,
}: FilterRowsProps) {
  return (
    <>
      {/* Status filter */}
      <div role="group" aria-label="Statut" className="flex gap-2 flex-wrap text-xs sm:mb-2">
        {STATUS_OPTIONS.map(o => (
          <FilterPill key={o.value} active={status === o.value} onClick={() => onStatus(o.value)} count={counts[o.value]}>
            {o.label}
          </FilterPill>
        ))}
      </div>
      {/* Category filter */}
      <div role="group" aria-label="Catégorie" className="flex gap-2 flex-wrap text-xs sm:text-sm sm:mb-2">
        <FilterPill active={category === 'all'} onClick={() => onCategory('all')} count={counts.all}>Toutes catégories</FilterPill>
        {CATEGORY_KEYS.map(c => (
          <FilterPill
            key={c}
            active={category === c}
            onClick={() => onCategory(c)}
            count={counts[c]}
            color={CATEGORY_COLORS[c]}
          >{CATEGORY_LABELS[c]}</FilterPill>
        ))}
      </div>
      {/* Difficulty filter */}
      <div role="group" aria-label="Difficulté" className="flex gap-2 flex-wrap text-xs sm:mb-2">
        <span className="text-neutral-500 self-center mr-1">Difficulté :</span>
        <FilterPill active={difficulty === 'all'} onClick={() => onDifficulty('all')} count={counts.all}>Toutes</FilterPill>
        {DIFFICULTY_KEYS.map(d => (
          <FilterPill
            key={d}
            active={difficulty === d}
            onClick={() => onDifficulty(d)}
            color={DIFFICULTY_COLORS[d]}
            count={counts[d]}
          >{DIFFICULTY_LABELS[d]}</FilterPill>
        ))}
      </div>
      {/* Motif filter — only shown when a motif is actively filtered or via Stats deep-link */}
      {motif !== 'all' && (
        <div className="flex gap-2 flex-wrap items-center text-xs sm:mb-4">
          <span className="text-neutral-500">Motif :</span>
          <span className="px-2 py-1 rounded bg-[var(--color-accent)] text-white">
            {MOTIF_LABELS[motif]}
          </span>
          <button
            onClick={onClearMotif}
            className="text-neutral-400 hover:text-white underline py-2 sm:py-0"
          >× Retirer le filtre motif</button>
        </div>
      )}
    </>
  )
}

// Phones only: one tappable line standing in for the three chip rows. The
// summary stays visible while the panel is open, so choosing a chip gives
// immediate feedback even when the exercise itself is scrolled out of view.
function FiltersToggle({
  open, onToggle, panelId, summary, count,
}: {
  open: boolean
  onToggle: () => void
  panelId: string
  summary: string
  count: number
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-controls={open ? panelId : undefined}
      className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-panel)] px-3 py-2 text-left transition-colors active:bg-neutral-800"
    >
      <span className="flex items-center gap-2">
        <span className="text-sm font-medium text-neutral-100">Filtres</span>
        {' '}
        <span className="ml-auto text-xs text-neutral-400">{exerciseCountLabel(count)}</span>
        <svg
          viewBox="0 0 24 24"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={`shrink-0 text-neutral-400 transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </span>
      {' '}
      <span className="mt-0.5 block truncate text-xs text-neutral-400" title={summary}>{summary}</span>
    </button>
  )
}

function ExportButton({
  onExport, disabled, className,
}: {
  onExport: () => void
  disabled: boolean
  className: string
}) {
  return (
    <button
      onClick={onExport}
      disabled={disabled}
      className={className}
      title="Télécharger un PGN importable comme étude Lichess"
    >
      ↓ Export Lichess (.pgn)
    </button>
  )
}

function FilterPill({
  children, active, onClick, count, color,
}: {
  children: React.ReactNode
  active: boolean
  onClick: () => void
  count?: number
  color?: string
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`px-2.5 py-3 sm:px-3 sm:py-1.5 rounded-full border transition-colors ${
        active
          ? 'bg-[var(--color-accent)] border-[var(--color-accent)] text-white'
          : 'border-[var(--color-border)] text-neutral-300 hover:bg-neutral-800'
      }`}
    >
      {color && !active && (
        <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: color }} />
      )}
      {children}
      {count !== undefined && (
        <>
          {' '}
          <span className="opacity-60">({count})</span>
        </>
      )}
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

// Prev / next buttons of the exercise nav row. Phone: filled 40×48 touch
// targets with a bigger arrow; from `sm`: the original flat text buttons.
const NAV_BUTTON =
  'inline-flex shrink-0 items-center justify-center gap-1 min-h-10 min-w-12 px-3 rounded bg-neutral-800 text-lg '
  + 'hover:bg-neutral-700 disabled:opacity-30 '
  + 'sm:min-h-0 sm:min-w-0 sm:py-1 sm:bg-transparent sm:text-sm sm:hover:bg-neutral-800'

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
  const [onlyMoveGap, setOnlyMoveGap] = useState<number | null>(() => {
    try {
      const cached = localStorage.getItem(`chess.multipv.${exercise.id}`)
      return cached ? Number(cached) : null
    } catch { return null }
  })
  const wrongTimerRef = useRef<number | null>(null)

  // Lazy MultiPV check: spawn a one-off Stockfish worker to learn the gap
  // between the best and the 2nd-best move at this position. If best beats
  // 2nd by >=150 cp it is a "coup unique" — the most instructive type of
  // puzzle. Result is cached locally so it only runs once per exercise.
  useEffect(() => {
    if (onlyMoveGap !== null) return
    let cancelled = false
    evaluateMultiPV(exercise.fen, 2, 10, 350)
      .then(lines => {
        if (cancelled) return
        const gap = topGapCp(lines)
        setOnlyMoveGap(gap)
        try { localStorage.setItem(`chess.multipv.${exercise.id}`, String(gap)) } catch { /* noop */ }
      })
      .catch(() => { /* noop */ })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise.id])

  const chess = useMemo(() => new Chess(exercise.fen), [exercise.fen])
  const lineComplete = linePly >= lineSans.length
  const isUserTurn = linePly % 2 === 0

  useEffect(() => {
    return () => {
      if (wrongTimerRef.current) window.clearTimeout(wrongTimerRef.current)
    }
  }, [])

  // Keyboard shortcuts: ← / → navigate filtered list, R recommencer, S voir la solution
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Skip when typing in an input/textarea
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return
      if (e.key === 'ArrowLeft') { onPrev() }
      else if (e.key === 'ArrowRight') { onNext() }
      else if (e.key === 'r' || e.key === 'R') { reset() }
      else if (e.key === 's' || e.key === 'S') {
        if (status !== 'completed' && status !== 'revealed') reveal()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onNext, onPrev, status])

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
    const timer = window.setTimeout(() => {
      let mv
      try { mv = chess.move(san) } catch { /* noop */ }
      if (!mv) { setLinePly(lineSans.length); return }
      setPosition(chess.fen())
      setHighlight({ type: 'correct', from: mv.from, to: mv.to })
      setShowBadge(false)
      playForMove(mv.flags)
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
      if (linePly === 0) playSuccess()
      else playForMove(attempt.flags)
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
    playWrong()
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
    <div className="space-y-3 sm:space-y-4">
      {/* Nav row — always one line: on a phone the arrows are icon buttons (≥ 40px
          tall) on each side of the counter, the text labels come back from `sm`. */}
      <div className="flex items-center justify-between gap-2 text-sm">
        <button
          onClick={onPrev}
          disabled={!canNavigate || total <= 1}
          aria-label="Exercice précédent"
          title="Exercice précédent (←)"
          className={NAV_BUTTON}
        >
          <span aria-hidden="true">←</span>
          <span className="hidden sm:inline">Précédent</span>
        </button>
        <div className="flex min-w-0 items-center gap-2 text-neutral-300 sm:gap-3 sm:text-neutral-400">
          <span className="truncate tabular-nums">
            {offList
              ? <>✓ Hors filtre · {total} restant{total > 1 ? 's' : ''}<span className="hidden sm:inline"> dans la sélection</span></>
              : <>Exercice {index + 1} / {total}</>}
          </span>
          <ShareButton exercise={exercise} />
        </div>
        <button
          onClick={onNext}
          disabled={!canNavigate}
          aria-label="Exercice suivant"
          title="Exercice suivant (→)"
          className={NAV_BUTTON}
        >
          <span className="hidden sm:inline">Suivant</span>
          <span aria-hidden="true">→</span>
        </button>
      </div>

      <div className="grid lg:grid-cols-[auto_1fr] gap-4 sm:gap-6">
        {/* Board column: [eval bar | board] over [· | caption]. The eval bar
            stretches to the height of the board's grid row. On a phone the
            board takes all the width that is left; from `sm` it is capped. */}
        <div className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-2 gap-y-2 self-start sm:grid-cols-[1.5rem_min(70vw,560px)]">
          <EvalBar evalCp={exercise.evalBeforeWhite} heightClass="h-auto" />
          <div className="min-w-0">
            <TrainingBoard
              position={position}
              orientation={exercise.userColor}
              allowDragging={status !== 'completed' && status !== 'revealed' && isUserTurn}
              squareStyles={squareStyles}
              onPieceDrop={({ sourceSquare, targetSquare }) => {
                if (!targetSquare) return false
                return tryMove(sourceSquare, targetSquare)
              }}
              overlay={
                <>
                  {showBadge && (status === 'progress' || status === 'wrong') && (
                    <FeedbackBadge correct={status === 'progress'} />
                  )}
                  {status === 'completed' && (
                    <FeedbackBadge correct={true} />
                  )}
                </>
              }
            />
          </div>
          <div className="col-start-2 row-start-2 text-xs text-neutral-500 text-center">
            {status === 'completed' || status === 'revealed'
              ? <>Ligne {hasContinuation ? `(${lineSans.length} coups)` : ''} affichée.</>
              : !isUserTurn
                ? <>L'adversaire répond…</>
                : hasContinuation && linePly > 0
                  ? <>Trouve le coup suivant ({userPliesDone + 1}/{userPliesTotal})</>
                  : <>Trait aux {exercise.sideToMove === 'w' ? 'Blancs' : 'Noirs'} (toi).</>}
          </div>
        </div>

        {/* Right panel column. On a phone the actions come right under the
            board and the descriptive card goes last (`order-*`, reset from `sm`). */}
        <div className="flex flex-col gap-3">
          <div className="order-4 sm:order-none bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-3 sm:p-4">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span
                className="px-2 py-1 rounded text-xs font-medium"
                style={{ backgroundColor: CATEGORY_COLORS[exercise.category] + '33', color: CATEGORY_COLORS[exercise.category] }}
              >
                {CATEGORY_LABELS[exercise.category]}
              </span>
              <span
                className="px-2 py-1 rounded text-xs font-medium"
                style={{ backgroundColor: DIFFICULTY_COLORS[exercise.difficulty] + '33', color: DIFFICULTY_COLORS[exercise.difficulty] }}
                title={`Difficulté ${DIFFICULTY_LABELS[exercise.difficulty]}`}
              >
                {DIFFICULTY_LABELS[exercise.difficulty]}
              </span>
              {(exercise.motifs ?? []).map(m => (
                <span
                  key={m}
                  className={`px-2 py-1 rounded text-xs font-medium ${
                    m === 'mate-missed' ? 'bg-red-500/20 text-red-300'
                    : m === 'mate-found' ? 'bg-green-500/20 text-green-300'
                    : m === 'fork-royal' ? 'bg-yellow-500/20 text-yellow-300'
                    : m === 'fork' ? 'bg-yellow-500/20 text-yellow-300'
                    : m === 'pin' ? 'bg-purple-500/20 text-purple-300'
                    : m === 'sacrifice' ? 'bg-orange-500/20 text-orange-300'
                    : m === 'hanging-capture' ? 'bg-blue-500/20 text-blue-300'
                    : 'bg-neutral-700/50 text-neutral-300'
                  }`}
                  title={MOTIF_LABELS[m]}
                >
                  {motifIcon(m)} {MOTIF_LABELS[m]}
                </span>
              ))}
              {onlyMoveGap !== null && onlyMoveGap >= 150 && (
                <span
                  className="px-2 py-1 rounded text-xs font-medium bg-pink-500/20 text-pink-300"
                  title={`Le meilleur coup gagne ${onlyMoveGap} cp sur le 2e — coup forcé.`}
                >
                  ✦ Coup unique
                </span>
              )}
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
              className="order-1 sm:order-none rounded-md p-3 text-sm font-medium"
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

          <div className="order-2 sm:order-none flex gap-2 flex-wrap">
            {(status === 'wrong' || status === 'pending') && (
              <button onClick={reveal} className="flex-1 min-h-10 sm:flex-none sm:min-h-0 px-3 py-1.5 text-sm bg-neutral-800 hover:bg-neutral-700 rounded">
                Voir la solution
              </button>
            )}
            {status !== 'pending' && (
              <button onClick={reset} className="flex-1 min-h-10 sm:flex-none sm:min-h-0 px-3 py-1.5 text-sm bg-neutral-800 hover:bg-neutral-700 rounded">
                Recommencer
              </button>
            )}
            {(status === 'completed' || status === 'revealed') && (
              <button onClick={onNext} className="flex-1 min-h-10 sm:flex-none sm:min-h-0 px-3 py-1.5 text-sm bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white rounded">
                Exercice suivant →
              </button>
            )}
          </div>

          {(status === 'completed' || status === 'revealed') && (
            <div className="order-3 sm:order-none bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-3 space-y-2 text-sm">
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

function motifIcon(m: string): string {
  switch (m) {
    case 'mate-missed': return '☠'
    case 'mate-found': return '⚔'
    case 'fork': return '⚡'
    case 'fork-royal': return '👑'
    case 'pin': return '📌'
    case 'sacrifice': return '🔥'
    case 'hanging-capture': return '⚠'
    case 'capture': return '✕'
    default: return ''
  }
}

function ShareButton({ exercise }: { exercise: Exercise }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    const url = exerciseToShareUrl(exercise)
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    }).catch(() => {})
  }
  // Phone: an icon-only 40×40 button (the label comes back from `sm`). The
  // visually hidden status line keeps the "link copied" feedback audible.
  return (
    <>
      <button
        onClick={copy}
        aria-label="Partager cet exercice"
        title="Copier un lien partageable de cet exercice"
        className="inline-flex min-h-10 min-w-10 items-center justify-center gap-1 px-2 text-sm text-neutral-300 hover:text-neutral-100 border border-[var(--color-border)] rounded sm:min-h-0 sm:min-w-0 sm:py-0.5 sm:text-xs sm:text-neutral-500 sm:hover:text-neutral-200"
      >
        <span aria-hidden="true">{copied ? '✓' : '🔗'}</span>
        <span className="hidden sm:inline">{copied ? 'Lien copié' : 'Partager'}</span>
      </button>
      <span role="status" className="sr-only">{copied ? 'Lien copié' : ''}</span>
    </>
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
