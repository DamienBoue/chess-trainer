// One Puzzle Rush position: a single try, then the verdict (green tick, or the
// red move followed by the best move) before handing control back to the run.
import { useEffect, useRef, useState } from 'react'
import { StyleSheet, useWindowDimensions, View } from 'react-native'
import { Chess } from 'chess.js'
import { CATEGORY_COLORS, CATEGORY_LABELS, type Exercise } from '@shared/analysis/exercises'
import Board from '@/components/Board'
import { T } from '@/components/ui'

const GOOD = 'rgba(95, 160, 82, 0.6)'
const BAD = 'rgba(208, 74, 74, 0.6)'
const CORRECT_HOLD_MS = 1300
const WRONG_HOLD_MS = 800        // red flash before the best move is shown
const WRONG_BEST_HOLD_MS = 1600  // how long the best move stays

interface Feedback {
  correct: boolean
  playedSan: string
  from: string
  to: string
  playedFen: string
  best?: { from: string; to: string; fen: string }
  showingBest: boolean
}

function playMove(fen: string, move: string | { from: string; to: string; promotion: string }) {
  try {
    const c = new Chess(fen)
    const m = c.move(move)
    return m ? { move: m, fen: c.fen() } : null
  } catch { return null }
}

/** Mount it with key={exercise.id}: state starts fresh for each puzzle. */
export default function RushPuzzleStage({ exercise, onResult }: {
  exercise: Exercise
  onResult: (correct: boolean) => void
}) {
  const { width } = useWindowDimensions()
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  // The timers must call the latest onResult, not the one of the first render.
  const resultRef = useRef(onResult)
  useEffect(() => { resultRef.current = onResult })

  // Each verdict phase schedules the next one; leaving the screen (or the
  // clock ending the run) unmounts us and cancels whatever is pending.
  const phase = feedback ? (feedback.correct ? 'correct' : feedback.showingBest ? 'best' : 'wrong') : 'idle'
  useEffect(() => {
    if (phase === 'idle') return
    const id = setTimeout(() => {
      if (phase === 'correct') resultRef.current(true)
      else if (phase === 'wrong') setFeedback(f => f && { ...f, showingBest: true })
      else resultRef.current(false)
    }, phase === 'correct' ? CORRECT_HOLD_MS : phase === 'wrong' ? WRONG_HOLD_MS : WRONG_BEST_HOLD_MS)
    return () => clearTimeout(id)
  }, [phase])

  function tryMove(from: string, to: string): boolean {
    if (feedback) return false
    const played = playMove(exercise.fen, { from, to, promotion: 'q' })
    if (!played) return false
    const best = playMove(exercise.fen, exercise.bestMoveSan)
    setFeedback({
      correct: played.move.san === exercise.bestMoveSan,
      playedSan: played.move.san,
      from, to,
      playedFen: played.fen,
      best: best ? { from: best.move.from, to: best.move.to, fen: best.fen } : undefined,
      showingBest: false,
    })
    return true
  }

  const highlights: Record<string, string> = {}
  let fen = exercise.fen
  if (feedback) {
    fen = feedback.playedFen
    if (feedback.correct) {
      highlights[feedback.from] = GOOD
      highlights[feedback.to] = GOOD
    } else if (feedback.showingBest && feedback.best) {
      fen = feedback.best.fen
      highlights[feedback.best.from] = GOOD
      highlights[feedback.best.to] = GOOD
    } else {
      highlights[feedback.from] = BAD
      highlights[feedback.to] = BAD
    }
  }
  const color = CATEGORY_COLORS[exercise.category]

  return (
    <View style={styles.gap}>
      <View style={styles.row}>
        <View style={[styles.tag, { backgroundColor: color + '33' }]}>
          <T style={{ color, fontSize: 12, fontWeight: '600' }}>{CATEGORY_LABELS[exercise.category]}</T>
        </View>
        <T tone="muted" style={styles.small}>Trait aux {exercise.sideToMove === 'w' ? 'Blancs' : 'Noirs'}</T>
      </View>
      <View style={styles.center}>
        <Board
          fen={fen}
          size={Math.min(width - 32, 560)}
          orientation={exercise.userColor}
          highlights={highlights}
          onMove={feedback ? undefined : tryMove}
        />
      </View>
      <View style={styles.verdict}>
        {feedback && (feedback.correct ? (
          <T tone="win" style={styles.bold}>✓ {feedback.playedSan} — bien joué !</T>
        ) : feedback.showingBest ? (
          <T tone="win" style={styles.bold}>Le bon coup était {exercise.bestMoveSan}</T>
        ) : (
          <T tone="loss" style={styles.bold}>✗ {feedback.playedSan} n'est pas le meilleur coup</T>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  gap: { gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tag: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  small: { fontSize: 13, lineHeight: 18 },
  center: { alignItems: 'center' },
  // Reserved height: the board doesn't jump when the verdict appears.
  verdict: { minHeight: 26, alignItems: 'center' },
  bold: { fontSize: 16, fontWeight: '600' },
})
