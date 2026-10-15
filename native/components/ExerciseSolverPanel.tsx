// Solve one exercise on the board: find the engine's move, then follow the
// scripted line (the engine's replies are played for you). Shared by the
// "Exercices" and "Puzzle du jour" screens; same rules as the website's
// ExercisePractice. Remount it (key) to change exercise.
import { useEffect, useMemo, useRef, useState } from 'react'
import { StyleSheet, useWindowDimensions, View } from 'react-native'
import { Chess } from 'chess.js'
import {
  type Exercise, CATEGORY_COLORS, CATEGORY_DESCRIPTIONS, CATEGORY_LABELS,
  DIFFICULTY_COLORS, DIFFICULTY_LABELS, MOTIF_LABELS,
} from '@shared/analysis/exercises'
import type { ExerciseProgress } from '@shared/storage/persist'
import Board from '@/components/Board'
import { Button, Card, T } from '@/components/ui'
import { C } from '@/constants/theme'
import { TagChip } from '@/components/ExerciseTagChip'

export type SolveOutcome = 'first-try' | 'after-retry' | 'failed' | 'revealed'
type Status = 'pending' | 'wrong' | 'progress' | 'completed' | 'revealed'

const BAD = 'rgba(208, 74, 74, 0.6)'

interface Props {
  exercise: Exercise
  progress?: ExerciseProgress
  /** Only the first move counts (daily puzzle): the line is cut to it. */
  singleMove?: boolean
  /** Reported once per round: at the first right move, or on "solution". */
  onOutcome?: (outcome: SolveOutcome) => void
  /** Footer button shown once the exercise is over. */
  onNext?: () => void
  nextLabel?: string
  /** Open on the solved position (daily puzzle already done today). */
  initialSolved?: boolean
  /** Hide the descriptive card (the screen already shows it). */
  compact?: boolean
}

export default function ExerciseSolverPanel({ exercise, progress, singleMove, initialSolved, onOutcome, onNext, nextLabel = 'Exercice suivant →', compact }: Props) {
  const { width } = useWindowDimensions()
  const lineSans = useMemo(() => {
    if (singleMove) return [exercise.bestMoveSan]
    return (exercise.bestLineSan?.trim() || exercise.bestMoveSan).split(/\s+/).filter(Boolean)
  }, [exercise.bestLineSan, exercise.bestMoveSan, singleMove])
  const hasContinuation = lineSans.length > 1

  const chess = useRef<Chess>(null as unknown as Chess)
  if (chess.current === null) {
    chess.current = new Chess(exercise.fen)
    if (initialSolved) { try { chess.current.move(lineSans[0]) } catch { /* keep the start */ } }
  }
  const [position, setPosition] = useState(() => chess.current.fen())
  const [status, setStatus] = useState<Status>(initialSolved ? 'completed' : 'pending')
  const [linePly, setLinePly] = useState(initialSolved ? lineSans.length : 0)
  const [attempts, setAttempts] = useState(0)
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null)
  const [wrongSquares, setWrongSquares] = useState<{ from: string; to: string } | null>(null)
  const [reported, setReported] = useState(!!initialSolved)
  const wrongTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (wrongTimer.current) clearTimeout(wrongTimer.current) }, [])

  const lineComplete = linePly >= lineSans.length
  const isUserTurn = linePly % 2 === 0

  // The engine's replies (and the whole line after "Voir la solution") are
  // played one by one so the eye can follow.
  useEffect(() => {
    if (lineComplete) return
    const reveal = status === 'revealed'
    if (!reveal && (isUserTurn || status === 'wrong')) return
    const timer = setTimeout(() => {
      let mv = null
      try { mv = chess.current.move(lineSans[linePly]) } catch { mv = null }
      if (!mv) { setLinePly(lineSans.length); return }
      setPosition(chess.current.fen())
      setLastMove({ from: mv.from, to: mv.to })
      const next = linePly + 1
      setLinePly(next)
      if (next >= lineSans.length && status === 'progress') setStatus('completed')
    }, 700)
    return () => clearTimeout(timer)
  }, [linePly, isUserTurn, lineComplete, status, lineSans])

  function report(o: SolveOutcome) {
    if (reported) return
    setReported(true)
    onOutcome?.(o)
  }

  function tryMove(from: string, to: string): boolean {
    if (status === 'revealed' || status === 'completed' || !isUserTurn || lineComplete) return false
    let attempt = null
    try { attempt = chess.current.move({ from, to, promotion: 'q' }) } catch { attempt = null }
    if (!attempt) return false

    if (attempt.san === lineSans[linePly]) {
      setPosition(chess.current.fen())
      setLastMove({ from, to })
      setWrongSquares(null)
      if (linePly === 0) report(attempts === 0 ? 'first-try' : 'after-retry')
      const next = linePly + 1
      setLinePly(next)
      setStatus(next >= lineSans.length ? 'completed' : 'progress')
      return true
    }

    // Wrong: the move is taken back and flashed red for a moment.
    chess.current.undo()
    setAttempts(a => a + 1)
    setStatus('wrong')
    setWrongSquares({ from, to })
    if (wrongTimer.current) clearTimeout(wrongTimer.current)
    wrongTimer.current = setTimeout(() => {
      setWrongSquares(null)
      setStatus(linePly > 0 ? 'progress' : 'pending')
    }, 1000)
    return false
  }

  function reveal() {
    if (wrongTimer.current) clearTimeout(wrongTimer.current)
    setWrongSquares(null)
    setStatus('revealed')
    report('revealed')
  }

  function restart() {
    if (wrongTimer.current) clearTimeout(wrongTimer.current)
    chess.current = new Chess(exercise.fen)
    setPosition(exercise.fen)
    setStatus('pending')
    setLinePly(0)
    setAttempts(0)
    setLastMove(null)
    setWrongSquares(null)
    setReported(false)
  }

  const over = status === 'completed' || status === 'revealed'
  const highlights: Record<string, string> = wrongSquares
    ? { [wrongSquares.from]: BAD, [wrongSquares.to]: BAD }
    : {}
  const userPliesTotal = Math.ceil(lineSans.length / 2)
  const userPliesDone = Math.ceil(linePly / 2)

  const feedback =
    status === 'completed' ? (hasContinuation ? '✓ Ligne complète ! Tu as joué tous les bons coups.' : `✓ ${exercise.bestMoveSan} — bien joué !`)
    : status === 'progress' ? '✓ Bon coup ! Continue la séquence.'
    : status === 'wrong' ? `✗ Pas le meilleur coup. Réessaie.${attempts > 1 ? ` (${attempts} essais)` : ''}`
    : status === 'revealed' ? `Solution : ${exercise.bestMoveSan}${hasContinuation ? ' suivi de ' + lineSans.slice(1).join(' ') : ''}.`
    : null
  const tone = status === 'wrong' ? 'danger' : status === 'revealed' ? 'muted' : 'win'

  const caption =
    over ? 'Ligne affichée.'
    : !isUserTurn ? "L'adversaire répond…"
    : hasContinuation && linePly > 0 ? `Trouve le coup suivant (${userPliesDone + 1}/${userPliesTotal})`
    : `Trait aux ${exercise.sideToMove === 'w' ? 'Blancs' : 'Noirs'} (toi).`

  const catColor = CATEGORY_COLORS[exercise.category]
  const diffColor = DIFFICULTY_COLORS[exercise.difficulty]
  const evalFor = (cp: number) => (exercise.userColor === 'white' ? cp : -cp)

  return (
    <View style={styles.wrap}>
      <View style={styles.board}>
        <Board
          fen={position}
          size={Math.min(width - 32, 560)}
          orientation={exercise.userColor}
          lastMove={lastMove}
          highlights={highlights}
          onMove={!over && isUserTurn && status !== 'wrong' ? tryMove : undefined}
        />
      </View>
      <T tone="faint" style={styles.caption}>{caption}</T>

      {feedback && <T tone={tone}>{feedback}</T>}

      <View style={styles.actions}>
        {(status === 'pending' || status === 'wrong') && <Button label="Voir la solution" kind="secondary" onPress={reveal} />}
        {status !== 'pending' && <Button label="↻ Recommencer" kind="secondary" onPress={restart} />}
        {over && onNext && <Button label={nextLabel} onPress={onNext} />}
      </View>

      {over && (
        <Card>
          <T><T tone="muted">Coup recommandé : </T><T tone="strong">{exercise.bestMoveSan}</T>
            {exercise.bestLineSan ? <T tone="faint"> (suite : {exercise.bestLineSan})</T> : null}</T>
          <T><T tone="muted">Coup joué dans la partie : </T>{exercise.playedMoveSan}
            {exercise.category === 'missed'
              ? <T tone="faint"> ({exercise.playedClassification === 'blunder' ? 'gaffe' : 'erreur'} de {exercise.cpSwing} cp)</T>
              : null}</T>
          <T tone="faint">Avant : {formatEval(evalFor(exercise.evalBeforeWhite))} pour toi · après ton coup réel : {formatEval(evalFor(exercise.evalAfterPlayedWhite))}</T>
        </Card>
      )}

      {!compact && (
        <Card>
          <View style={styles.tags}>
            <TagChip label={CATEGORY_LABELS[exercise.category]} color={catColor} />
            <TagChip label={DIFFICULTY_LABELS[exercise.difficulty]} color={diffColor} />
            {(exercise.motifs ?? []).map(m => <TagChip key={m} label={MOTIF_LABELS[m]} color={C.muted} />)}
          </View>
          <T>vs <T tone="strong">{exercise.context.opponent}</T><T tone="faint"> · {exercise.context.moveLabel}</T></T>
          {exercise.context.opening ? <T tone="faint">{exercise.context.opening}</T> : null}
          <T tone="muted">{CATEGORY_DESCRIPTIONS[exercise.category]}</T>
          {progress && (
            <T tone="faint">
              {progress.successes}✓ / {progress.failures}✗
              {progress.nextDueAt > Date.now() ? ` · prochaine révision ${formatDueDelta(progress.nextDueAt - Date.now())}` : ''}
            </T>
          )}
        </Card>
      )}
    </View>
  )
}

function formatEval(cp: number): string {
  if (Math.abs(cp) > 50000) {
    const mateIn = 100000 - Math.abs(cp)
    return cp > 0 ? `+M${mateIn}` : `-M${mateIn}`
  }
  return (cp >= 0 ? '+' : '') + (cp / 100).toFixed(1)
}

function formatDueDelta(ms: number): string {
  const days = ms / 86400_000
  if (days < 1) return `dans ${Math.max(1, Math.round(ms / 3600_000))} h`
  if (days < 30) return `dans ${Math.round(days)} j`
  return `dans ${Math.round(days / 30)} mois`
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  board: { alignItems: 'center' },
  caption: { textAlign: 'center', fontSize: 13 },
  actions: { gap: 8 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 },
})
