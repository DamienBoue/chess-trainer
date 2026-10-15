// One game against the engine: tap-to-move for the user, the shared engine
// (capped at `elo`) for the bot, end detection, resign.
import { useEffect, useMemo, useRef, useState } from 'react'
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { Chess } from 'chess.js'
import Board from '@/components/Board'
import { Button, Card, T } from '@/components/ui'
import type { PlayColor } from '@/components/StockfishPlaySetup'
import { useAppData } from '@/lib/appData'
import { C } from '@/constants/theme'

interface Outcome { result: '1-0' | '0-1' | '1/2-1/2'; reason: string }

// Lower Elo = faster replies (and less skilful); the engine's UCI_Elo does
// the weakening, the movetime only sets how "thoughtful" each reply feels.
function movetimeForElo(elo: number): number {
  if (elo < 1000) return 250
  if (elo < 1400) return 400
  if (elo < 1800) return 600
  if (elo < 2200) return 900
  return 1200
}

function termination(c: Chess): Outcome | null {
  if (c.isCheckmate()) return { result: c.turn() === 'w' ? '0-1' : '1-0', reason: 'Échec et mat' }
  if (c.isStalemate()) return { result: '1/2-1/2', reason: 'Pat' }
  if (c.isInsufficientMaterial()) return { result: '1/2-1/2', reason: 'Matériel insuffisant' }
  if (c.isThreefoldRepetition()) return { result: '1/2-1/2', reason: 'Triple répétition' }
  if (c.isDraw()) return { result: '1/2-1/2', reason: 'Nulle (règle des 50 coups)' }
  return null
}

// A copy that keeps the move history, which repetition detection needs.
function copyOf(c: Chess): Chess {
  const next = new Chess()
  for (const san of c.history()) next.move(san)
  return next
}

export default function StockfishPlaySession({ elo, color, onExit }: { elo: number; color: PlayColor; onExit: () => void }) {
  const { engine } = useAppData()
  const { width } = useWindowDimensions()
  const [game, setGame] = useState(() => new Chess())
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null)
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)
  // Each game, and leaving the screen, gets a new id: a bot reply still in
  // flight for an older game must not land on the new one.
  const gameIdRef = useRef(0)
  useEffect(() => () => { gameIdRef.current++ }, [])

  const userTurn = game.turn() === color[0]
  const thinking = !outcome && !userTurn && !error

  useEffect(() => {
    if (outcome || userTurn || error) return
    const id = gameIdRef.current
    let cancelled = false
    // The cap travels with the request: the engine is shared with the analyses.
    engine().evaluate(game.fen(), 18, movetimeForElo(elo), elo)
      .then(r => {
        if (cancelled || id !== gameIdRef.current) return
        if (!r.bestMoveUci) { setOutcome(termination(game)); return }
        const uci = r.bestMoveUci
        const next = copyOf(game)
        const mv = next.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci.length === 5 ? uci[4] : undefined })
        setGame(next)
        setLastMove({ from: mv.from, to: mv.to })
        setOutcome(termination(next))
      })
      .catch(e => {
        if (!cancelled && id === gameIdRef.current) setError(e instanceof Error ? e.message : String(e))
      })
    return () => { cancelled = true }
  }, [game, outcome, userTurn, error, retry, elo, engine])

  function onMove(from: string, to: string): boolean {
    if (outcome || !userTurn) return false
    const next = copyOf(game)
    let mv
    try { mv = next.move({ from, to, promotion: 'q' }) } catch { return false }
    setGame(next)
    setLastMove({ from: mv.from, to: mv.to })
    setOutcome(termination(next))
    return true
  }

  function resign() {
    gameIdRef.current++
    setOutcome({ result: color === 'white' ? '0-1' : '1-0', reason: 'Abandon' })
  }

  function replay() {
    gameIdRef.current++
    setGame(new Chess())
    setLastMove(null)
    setOutcome(null)
    setError(null)
  }

  const sans = game.history()
  const pairs = useMemo(() => {
    const out: string[] = []
    for (let i = 0; i < sans.length; i += 2) out.push(`${i / 2 + 1}. ${sans[i]}${sans[i + 1] ? ' ' + sans[i + 1] : ''}`)
    return out
  }, [sans])

  const won = outcome && ((outcome.result === '1-0') === (color === 'white')) && outcome.result !== '1/2-1/2'
  const status = outcome
    ? outcome.result === '1/2-1/2' ? 'Partie nulle' : won ? 'Tu as gagné !' : 'Stockfish a gagné'
    : null

  return (
    <>
      <T tone="muted">Toi ({color === 'white' ? 'Blancs' : 'Noirs'}) contre Stockfish {elo}{thinking ? ' · il réfléchit…' : userTurn && !outcome ? ' · à toi de jouer' : ''}</T>
      <View style={styles.board}>
        <Board
          fen={game.fen()}
          size={Math.min(width - 32, 560)}
          orientation={color}
          lastMove={lastMove}
          onMove={!outcome && userTurn ? onMove : undefined}
        />
      </View>

      {error && (
        <Card>
          <T tone="danger">Le moteur n'a pas répondu : {error}</T>
          <Button label="Réessayer" onPress={() => { setError(null); setRetry(n => n + 1) }} />
        </Card>
      )}

      {outcome && (
        <Card highlight={!!won}>
          <T tone={won ? 'win' : outcome.result === '1/2-1/2' ? 'strong' : 'loss'} style={styles.result}>{status}</T>
          <T tone="muted">{outcome.result} · {outcome.reason}</T>
        </Card>
      )}

      <View style={styles.actions}>
        {outcome
          ? <Button label="Rejouer" onPress={replay} />
          : <Button label="Abandonner" kind="secondary" onPress={resign} />}
        <Button label="← Nouvelle partie" kind="ghost" onPress={onExit} />
      </View>

      <Card>
        <T tone="strong">Coups</T>
        {pairs.length === 0
          ? <T tone="faint">Aucun coup joué.</T>
          : <Text style={styles.moves}>{pairs.join('   ')}</Text>}
      </Card>
    </>
  )
}

const styles = StyleSheet.create({
  board: { alignItems: 'center' },
  actions: { gap: 8 },
  result: { fontSize: 18, fontWeight: '700' },
  moves: { color: C.text, fontSize: 14, lineHeight: 22, fontVariant: ['tabular-nums'] },
})
