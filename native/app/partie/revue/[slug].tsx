// "Revoir mes erreurs": replay each of your mistakes from the position
// before it, find better, with hints; the engine judges alternatives.
// Same logic as the website (src/analysis/retry.ts).
import { useEffect, useMemo, useRef, useState } from 'react'
import { StyleSheet, useWindowDimensions, View } from 'react-native'
import { Stack, router, useLocalSearchParams } from 'expo-router'
import { Chess } from 'chess.js'
import { findGameBySlug } from '@shared/nav/gameSlug'
import { CLASSIFICATION_LABELS } from '@shared/analysis/classify'
import { attemptLossCp, judgeAttempt, type RetryVerdict } from '@shared/analysis/retry'
import { toWhitePerspective } from '@shared/engine/stockfish'
import Board from '@/components/Board'
import { Button, Card, H1, Screen, T } from '@/components/ui'
import { useAppData } from '@/lib/appData'
import { moveLabel } from '@/lib/analysis'
import { retryItemsFor } from '@/lib/retry'

type Status = 'solving' | 'checking' | RetryVerdict | 'revealed'
type Outcome = 'first' | 'helped' | 'missed'

export default function MistakeReviewScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const { analyses, engine } = useAppData()
  const analysis = useMemo(() => findGameBySlug(Object.values(analyses), slug ?? ''), [analyses, slug])
  const items = useMemo(() => (analysis ? retryItemsFor(analysis) : []), [analysis])
  const [index, setIndex] = useState(0)
  // The position after the player's attempt (null: the item's own position).
  const [moved, setMoved] = useState<{ index: number; fen: string } | null>(null)
  const [status, setStatus] = useState<Status>('solving')
  const [attempt, setAttempt] = useState<{ san: string; lossCp?: number } | null>(null)
  const [hintLevel, setHintLevel] = useState(0)
  const [stumbled, setStumbled] = useState(false)
  const [outcomes, setOutcomes] = useState<Record<number, Outcome>>({})
  const request = useRef(0)
  // Leaving the screen drops a pending engine verdict.
  useEffect(() => () => { request.current = -1 }, [])
  const { width } = useWindowDimensions()
  const item = items[index]

  if (!analysis || items.length === 0) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Revoir mes erreurs' }} />
        <T tone="muted">Aucune erreur à revoir dans cette partie.</T>
      </Screen>
    )
  }

  if (!item) {
    const count = (o: Outcome) => Object.values(outcomes).filter(x => x === o).length
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Revoir mes erreurs' }} />
        <H1>Revue terminée</H1>
        <T>{count('first')} trouvée{count('first') > 1 ? 's' : ''} du premier coup, {count('helped')} avec aide, {count('missed')} manquée{count('missed') > 1 ? 's' : ''}.</T>
        <Button label="↻ Recommencer" onPress={() => goTo(0, true)} />
        <Button label="← Retour à l'analyse" kind="secondary" onPress={() => router.back()} />
      </Screen>
    )
  }

  function goTo(i: number, reset = false) {
    request.current++
    if (reset) setOutcomes({})
    setIndex(i)
    setMoved(null)
    setStatus('solving')
    setAttempt(null)
    setHintLevel(0)
    setStumbled(false)
  }

  function record(o: Outcome) {
    setOutcomes(prev => (prev[item.ply] ? prev : { ...prev, [item.ply]: o }))
  }

  function settle(verdict: RetryVerdict, san: string, lossCp?: number) {
    setAttempt({ san, lossCp })
    setStatus(verdict)
    if (verdict === 'best' || verdict === 'good') record(hintLevel === 0 && !stumbled ? 'first' : 'helped')
    else setStumbled(true)
  }

  function onMove(from: string, to: string): boolean {
    if (status !== 'solving') return false
    const chess = new Chess(item.fen)
    // No promotion picker: on the engine's squares, the engine's piece.
    const under = from === item.bestFrom && to === item.bestTo ? item.bestSan.match(/=([NBR])/) : null
    let move = null
    try { move = chess.move({ from, to, promotion: under ? under[1].toLowerCase() : 'q' }) } catch { move = null }
    if (!move) return false
    setMoved({ index, fen: chess.fen() })
    const verdict = judgeAttempt(item, move.san)
    if (verdict !== 'pending') { settle(verdict, move.san); return true }
    setAttempt({ san: move.san })
    setStatus('checking')
    const id = ++request.current
    const after = chess.fen()
    const san = move.san
    engine().evaluate(after, 12, 600)
      .then(r => {
        if (id !== request.current) return
        const white = toWhitePerspective(r.scoreCp, after)
        const v = judgeAttempt(item, san, white)
        settle(v === 'pending' ? 'wrong' : v, san, attemptLossCp(item, white))
      })
      .catch(() => {
        if (id !== request.current) return
        setStatus('solving'); setMoved(null); setAttempt(null)
      })
    return true
  }

  const side = item.side === 'w' ? 'Blancs' : 'Noirs'
  const solved = status === 'best' || status === 'good' || status === 'revealed'
  return (
    <Screen>
      <Stack.Screen options={{ title: `Revoir mes erreurs · ${index + 1}/${items.length}` }} />
      <T>
        À toi de jouer ({side}). Au coup {moveLabel(item.ply, item.playedSan).split(' ')[0]} tu as joué <T tone="strong">{item.playedSan}</T>
        <T tone="faint"> ({CLASSIFICATION_LABELS[item.classification].toLowerCase()}, −{Math.round(item.cpLoss)} cp)</T>. Trouve mieux.
      </T>
      <View style={styles.board}>
        <Board
          fen={status !== 'revealed' && moved?.index === index ? moved.fen : item.fen}
          size={Math.min(width - 32, 560)}
          orientation={item.side === 'w' ? 'white' : 'black'}
          onMove={status === 'solving' ? onMove : undefined}
          arrows={status === 'revealed' ? [{ from: item.bestFrom, to: item.bestTo, color: '#5aa55a' }] : []}
        />
      </View>

      {status === 'checking' && <T tone="muted">Le moteur vérifie {attempt?.san}…</T>}
      {status === 'best' && <T tone="win">✓ Exactement le coup du moteur : {item.bestSan}.</T>}
      {status === 'good' && <T tone="win">✓ Bien vu : {attempt?.san} tient la position (le moteur jouait {item.bestSan}).</T>}
      {status === 'same' && <T tone="danger">✗ C'est le coup de la partie. Cherche autre chose.</T>}
      {status === 'wrong' && <T tone="danger">✗ {attempt?.san} n'est pas mieux{attempt?.lossCp ? ` (−${attempt.lossCp} cp)` : ''}.</T>}
      {status === 'revealed' && <T tone="accent">Solution : {item.bestSan} (flèche verte){item.bestLineSan ? ` — ${item.bestLineSan}` : ''}.</T>}
      {hintLevel > 0 && !solved && item.hints.slice(0, hintLevel).map(h => <T key={h} tone="muted">💡 {h}</T>)}
      {item.plan && solved && (
        <Card>
          <T tone="strong">Plan : {item.plan.title}.</T>
          <T tone="muted">{item.plan.why}</T>
        </Card>
      )}

      <View style={styles.actions}>
        {(status === 'same' || status === 'wrong') && <Button label="↻ Réessayer" onPress={() => { setMoved(null); setStatus('solving'); setAttempt(null) }} />}
        {status === 'solving' && hintLevel < item.hints.length && <Button label="💡 Indice" kind="secondary" onPress={() => setHintLevel(h => h + 1)} />}
        {!solved && status !== 'checking' && (
          <Button label="Voir la solution" kind="secondary" onPress={() => { request.current++; record('missed'); setStatus('revealed') }} />
        )}
        {solved
          ? <Button label={index + 1 < items.length ? 'Suivant →' : 'Voir le bilan →'} onPress={() => goTo(index + 1)} />
          : <Button label="Passer" kind="ghost" onPress={() => { record('missed'); goTo(index + 1) }} />}
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  board: { alignItems: 'center' },
  actions: { gap: 8 },
})
