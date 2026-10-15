// One "Réflexe anti-gaffe" position: tap the most endangered piece of yours
// (or "Aucune menace") before the 12 s run out. Mount with key={puzzle.id}.
import { useEffect, useRef, useState } from 'react'
import { StyleSheet, useWindowDimensions, View } from 'react-native'
import type { Square } from 'chess.js'
import type { Threat } from '@shared/analysis/threats'
import SquarePickerBoard from '@/components/SquarePickerBoard'
import { Button, Card, T } from '@/components/ui'
import { C } from '@/constants/theme'

export interface ReflexPuzzle {
  id: string
  fen: string
  userColor: 'white' | 'black'
  opponentMoveFrom?: Square
  opponentMoveTo?: Square
  threats: Threat[]
  context: { opponent: string; ply: number; moveLabel: string }
}

export const REFLEX_TIMEOUT_MS = 12000

const PIECE_LABELS = { p: 'pion', n: 'cavalier', b: 'fou', r: 'tour', q: 'dame', k: 'roi' } as const
const OPPONENT = 'rgba(250, 200, 80, 0.55)'
const RIGHT = 'rgba(95, 160, 82, 0.65)'
const WRONG = 'rgba(208, 74, 74, 0.65)'

export default function ReflexThreatStage({ puzzle, position, total, onAnswered, onNext }: {
  puzzle: ReflexPuzzle
  position: number
  total: number
  onAnswered: (correct: boolean) => void
  onNext: () => void
}) {
  const { width } = useWindowDimensions()
  const [picked, setPicked] = useState<{ square: Square | null; correct: boolean } | null>(null)
  const [left, setLeft] = useState(REFLEX_TIMEOUT_MS)
  const doneRef = useRef(false)
  const answerRef = useRef<(sq: Square | null) => void>(() => {})

  // Rewritten each render so the timer always judges with the current props.
  useEffect(() => {
    answerRef.current = (square: Square | null) => {
      if (doneRef.current) return
      doneRef.current = true
      const correct = square !== null && puzzle.threats.some(t => t.square === square)
      setPicked({ square, correct })
      onAnswered(correct)
    }
  })

  // Countdown from a start time, so the 100 ms ticks never drift. Running out
  // counts as a miss with no pick.
  useEffect(() => {
    const start = Date.now()
    const id = setInterval(() => {
      const remaining = REFLEX_TIMEOUT_MS - (Date.now() - start)
      if (remaining <= 0 || doneRef.current) {
        clearInterval(id)
        answerRef.current(null)
      } else setLeft(remaining)
    }, 100)
    return () => clearInterval(id)
  }, [])

  const highlights: Record<string, string> = {}
  if (puzzle.opponentMoveFrom) highlights[puzzle.opponentMoveFrom] = OPPONENT
  if (puzzle.opponentMoveTo) highlights[puzzle.opponentMoveTo] = OPPONENT
  if (picked) {
    for (const t of puzzle.threats) highlights[t.square] = RIGHT
    if (picked.square && !picked.correct) highlights[picked.square] = WRONG
  }
  const seconds = Math.max(0, Math.ceil(left / 1000))

  return (
    <View style={styles.gap}>
      <View style={styles.row}>
        <T tone="faint" style={styles.small}>Position {position}/{total}</T>
        {!picked && <T tone={seconds <= 3 ? 'danger' : 'strong'} style={styles.clock}>{seconds}s</T>}
      </View>
      <View style={styles.center}>
        <SquarePickerBoard
          fen={puzzle.fen}
          size={Math.min(width - 32, 560)}
          orientation={puzzle.userColor}
          highlights={highlights}
          onPick={picked ? undefined : sq => answerRef.current(sq as Square)}
        />
      </View>
      <T tone="strong" style={styles.bold}>Quelle est la menace ?</T>
      <T tone="muted" style={styles.small}>
        Le coup adverse est surligné en orange. Touche la pièce de TON camp la plus en danger.
        Si tu penses qu'il n'y a aucune menace concrète, touche le bouton.
      </T>
      <Button label="Aucune menace" kind="secondary" disabled={!!picked} onPress={() => answerRef.current(null)} />

      {picked && (
        <Card style={{ borderColor: picked.correct ? C.win : C.loss }}>
          <T tone={picked.correct ? 'win' : 'loss'} style={styles.bold}>{picked.correct ? '✓ Bien vu !' : '✗ Raté'}</T>
          <T tone="muted" style={styles.small}>
            Pièces en danger : {puzzle.threats.map(t => `${t.square}${t.pieceType !== 'p' ? ` (${PIECE_LABELS[t.pieceType]})` : ''}`).join('  ')}
          </T>
          <T tone="faint" style={styles.small}>Contexte : {puzzle.context.moveLabel} vs {puzzle.context.opponent}</T>
          <Button label={`Suivant (${position + 1} / ${total})`} onPress={onNext} style={styles.mt} />
        </Card>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  gap: { gap: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 28 },
  small: { fontSize: 13, lineHeight: 18 },
  bold: { fontWeight: '600' },
  mt: { marginTop: 8 },
  center: { alignItems: 'center' },
  clock: { fontSize: 20, fontWeight: '600', fontVariant: ['tabular-nums'] },
})
