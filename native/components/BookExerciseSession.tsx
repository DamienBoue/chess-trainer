// One book exercise on the board: find the book's move, the opponent's reply
// is played for you, and so on to the end of the line. Same rules as the
// website's BookView (including the tablebase fallback). Remount it (key) to
// change exercise.
import { useEffect, useMemo, useRef, useState } from 'react'
import { StyleSheet, useWindowDimensions, View } from 'react-native'
import { Chess } from 'chess.js'
import type { BookExercise, ExerciseOutcome } from '@shared/library/types'
import {
  classifyTableMove, fetchTablebase, tableCategoryLabel, type TableCategory, type TableResponse,
} from '@shared/api/lichess'
import { cleanSan, sanMatches } from '@shared/utils/move'
import Board from '@/components/Board'
import { Button, Card, SectionLabel, T } from '@/components/ui'
import { C } from '@/constants/theme'

type Status = 'pending' | 'wrong' | 'in-progress' | 'solved' | 'revealed'

export default function BookExerciseSession({ exercise, onOutcome }: {
  exercise: BookExercise
  /** Reported on each wrong try, on completion and on "Voir la solution". */
  onOutcome: (outcome: ExerciseOutcome) => void
}) {
  const { width } = useWindowDimensions()
  // An exercise with no line still has its first move.
  const line = useMemo(
    () => (exercise.moves.length > 0 ? exercise.moves : exercise.firstMoveSan ? [exercise.firstMoveSan] : []),
    [exercise],
  )
  const chess = useRef<Chess>(null as unknown as Chess)
  if (chess.current === null) chess.current = new Chess(exercise.fen)
  const [position, setPosition] = useState(() => chess.current.fen())
  const [status, setStatus] = useState<Status>('pending')
  const [played, setPlayed] = useState<string[]>([])
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null)
  const [feedback, setFeedback] = useState('')
  const [wrong, setWrong] = useState<{ from: string; to: string } | null>(null)
  const [table, setTable] = useState<TableResponse | null>(null)
  // A clean run (no mistake, no hint) is what counts as "résolu".
  const clean = useRef(true)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clearTimer = () => { if (timer.current) { clearTimeout(timer.current); timer.current = null } }
  useEffect(() => clearTimer, [])

  // Tablebase verdict of the position on the board (≤ 7 pieces only).
  useEffect(() => {
    const ctrl = new AbortController()
    void fetchTablebase(position, ctrl.signal).then(r => { if (!ctrl.signal.aborted) setTable(r) })
    return () => ctrl.abort()
  }, [position])

  function playBook(idx: number): boolean {
    let mv = null
    try { mv = chess.current.move(cleanSan(line[idx])) } catch { mv = null }
    if (!mv) return false
    setPosition(chess.current.fen())
    setLastMove({ from: mv.from, to: mv.to })
    setPlayed(p => [...p, mv.san])
    return true
  }

  function scheduleReply(idx: number) {
    if (idx >= line.length) return
    clearTimer()
    timer.current = setTimeout(() => {
      timer.current = null
      if (!playBook(idx)) setFeedback("La suite annoncée par le livre n'est pas applicable ici.")
    }, 450)
  }

  function tryMove(from: string, to: string): boolean {
    if (status === 'solved' || status === 'revealed') return false
    const idx = played.length
    // The reply is still pending, or the line is over: not the user's turn.
    if (idx >= line.length || idx % 2 !== 0 || timer.current) return false
    let mv = null
    try { mv = chess.current.move({ from, to, promotion: 'q' }) } catch { mv = null }
    if (!mv) return false

    const matches = sanMatches(mv.san, line[idx])
    // A different move can still be right when the tablebase says it keeps
    // the theoretical value — except in drawn positions, where nearly every
    // move keeps the draw and the exercise wants the book's one.
    let tableOk = false
    if (!matches && table && table.category !== 'draw') {
      const tm = table.moves.find(m => sanMatches(m.san, mv.san) || m.uci === mv.from + mv.to + (mv.promotion ?? ''))
      if (tm) {
        const tone = classifyTableMove(table.category, tm.category)
        tableOk = tone === 'optimal' || tone === 'good'
      }
    }

    if (!matches && !tableOk) {
      chess.current.undo()
      clean.current = false
      setStatus('wrong')
      setFeedback(`✗ ${mv.san} — réessaie (ou « Voir la solution »)`)
      setWrong({ from, to })
      clearTimer()
      timer.current = null
      setTimeout(() => setWrong(null), 900)
      onOutcome('wrong')
      return false
    }

    setPosition(chess.current.fen())
    setLastMove({ from, to })
    setWrong(null)
    setPlayed(p => [...p, mv.san])
    if (tableOk && !matches) {
      // The book's continuation no longer fits: the exercise ends here.
      setStatus('solved')
      setFeedback(`✓ ${mv.san} fonctionne aussi (tablebase). Le livre proposait ${line[idx]} — compare avec la continuation.`)
      onOutcome(clean.current ? 'solved' : 'wrong')
      return true
    }
    const next = idx + 1
    if (next >= line.length) {
      setStatus('solved')
      setFeedback(clean.current ? '✓ Bravo, séquence complète !' : '✓ Séquence complétée.')
      onOutcome(clean.current ? 'solved' : 'wrong')
    } else {
      setStatus('in-progress')
      setFeedback(`✓ ${mv.san} — continue !`)
      scheduleReply(next)
    }
    return true
  }

  function reveal() {
    if (status === 'solved') return
    clearTimer()
    clean.current = false
    setStatus('revealed')
    setWrong(null)
    // Replay the rest of the line, one move every half second.
    let idx = played.length
    const step = () => {
      if (idx >= line.length) { setFeedback('Solution complète révélée.'); onOutcome('revealed'); return }
      if (!playBook(idx)) { setFeedback(`Solution : ${line.slice(played.length).join(' ')} (non rejouable)`); return }
      idx++
      timer.current = setTimeout(step, 500)
    }
    step()
  }

  function restart() {
    clearTimer()
    chess.current = new Chess(exercise.fen)
    setPosition(exercise.fen)
    setStatus('pending')
    setPlayed([])
    setLastMove(null)
    setWrong(null)
    setFeedback('')
    clean.current = false
  }

  const over = status === 'solved' || status === 'revealed'
  const size = Math.min(width - 32, 440)
  const tb = table ? tableCategoryLabel(table.category as TableCategory) : null
  const best = table
    ? table.moves.filter(m => classifyTableMove(table.category as TableCategory, m.category) === 'optimal').slice(0, 3).map(m => m.san)
    : []
  const sideLabel = exercise.side === 'w' ? 'Blancs' : 'Noirs'

  return (
    <View style={{ gap: 12 }}>
      <View style={{ alignSelf: 'center' }}>
        <Board
          fen={position}
          size={size}
          orientation={exercise.side === 'w' ? 'white' : 'black'}
          lastMove={lastMove}
          highlights={wrong ? { [wrong.from]: 'rgba(208, 74, 74, 0.6)', [wrong.to]: 'rgba(208, 74, 74, 0.6)' } : {}}
          onMove={over ? undefined : tryMove}
        />
      </View>

      <T tone={status === 'solved' ? 'win' : status === 'wrong' ? 'loss' : status === 'revealed' ? 'accent' : 'muted'}>
        {feedback || 'Trouve le bon coup ; la suite se joue automatiquement.'}
      </T>

      {tb ? (
        <View style={[styles.tb, tb.tone === 'win' && { backgroundColor: 'rgba(74,222,128,0.12)' }, tb.tone === 'loss' && { backgroundColor: 'rgba(248,113,113,0.12)' }]}>
          <T tone="muted">
            <T tone="strong">Tablebase : </T>{tb.label} pour les {sideLabel}
            {table?.dtm != null ? ` · mat en ${Math.abs(table.dtm)}` : table?.dtz != null ? ` · DTZ ${Math.abs(table.dtz)}` : ''}
            {best.length > 0 ? ` · ${best.join(' / ')}` : ''}
          </T>
        </View>
      ) : null}

      {line.length > 0 ? (
        <View style={styles.moves}>
          {line.map((san, i) => {
            const isPlayed = i < played.length
            const shown = isPlayed ? played[i] : over ? san : '?'
            return (
              <T key={i} tone={isPlayed && i % 2 === 0 ? 'win' : isPlayed ? 'text' : 'faint'}
                style={[styles.move, i === played.length && !over && styles.moveNext]}>
                {shown}
              </T>
            )
          })}
        </View>
      ) : null}

      <View style={styles.actions}>
        <Button label="↺ Recommencer" kind="secondary" onPress={restart} style={{ flex: 1 }} />
        <Button label="Voir la solution" kind="secondary" onPress={reveal} disabled={status === 'solved'} style={{ flex: 1 }} />
      </View>

      <Card>
        <SectionLabel>Continuation</SectionLabel>
        {over ? (
          <T tone="muted">{exercise.solutionProse || '(pas de prose dans le livre source)'}</T>
        ) : (
          <T tone="faint">Trouve le bon coup pour révéler la suite.</T>
        )}
      </Card>
    </View>
  )
}

const styles = StyleSheet.create({
  tb: { borderRadius: 8, padding: 10, backgroundColor: C.panel2 },
  moves: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  move: { fontSize: 13, fontFamily: undefined, fontVariant: ['tabular-nums'], paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  moveNext: { backgroundColor: 'rgba(118,150,86,0.3)' },
  actions: { flexDirection: 'row', gap: 8 },
})
