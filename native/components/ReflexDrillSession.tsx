// "Réflexe anti-gaffe": positions taken just before the player's own big
// errors; spot the piece in danger within the time limit.
import { useMemo, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Chess, type Square } from 'chess.js'
import type { GameAnalysis } from '@shared/types'
import { extractExercises } from '@shared/analysis/exercises'
import { detectThreats } from '@shared/analysis/threats'
import DrillStatTile from '@/components/DrillStatTile'
import ReflexThreatStage, { type ReflexPuzzle } from '@/components/ReflexThreatStage'
import { Button, Card, T } from '@/components/ui'

function buildPool(analyses: GameAnalysis[]): ReflexPuzzle[] {
  // The 'missed' exercises are exactly "user blunder, engine wanted something else".
  const exs = extractExercises(analyses, { minMissedCpLoss: 150, maxPerGame: 4 }).filter(e => e.category === 'missed')
  const out: ReflexPuzzle[] = []
  for (const e of exs) {
    const threats = detectThreats(e.fen, e.userColor === 'white' ? 'w' : 'b')
    if (threats.length === 0) continue
    // The opponent's last move is the one before the user's, to highlight it.
    const opp = analyses.find(a => a.url === e.context.gameUrl)?.moves[e.context.ply - 2]
    let from: Square | undefined, to: Square | undefined
    if (opp?.fenBefore && opp.fenAfter) {
      try {
        const mv = new Chess(opp.fenBefore).move(opp.san)
        if (mv) { from = mv.from; to = mv.to }
      } catch { /* the highlight is a nicety */ }
    }
    out.push({ id: e.id, fen: e.fen, userColor: e.userColor, opponentMoveFrom: from, opponentMoveTo: to, threats, context: e.context })
  }
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

export default function ReflexDrillSession({ analyses }: { analyses: GameAnalysis[] }) {
  const pool = useMemo(() => buildPool(analyses), [analyses])
  const [idx, setIdx] = useState(0)
  const [score, setScore] = useState({ correct: 0, attempts: 0 })

  if (pool.length === 0) {
    return (
      <Card>
        <T tone="strong" style={styles.bold}>⚡ Pas encore de gaffes détectées</T>
        <T tone="muted">
          Cet entraînement se nourrit de tes propres positions juste avant une grosse erreur. Il faut au moins 3 gaffes
          ou erreurs d'au moins 150 cp dans tes parties analysées.
        </T>
      </Card>
    )
  }

  const current = pool[idx]
  if (!current) {
    const acc = score.attempts > 0 ? (score.correct / score.attempts) * 100 : 0
    return (
      <View style={styles.gap}>
        <T tone="strong" style={styles.bold}>Session terminée</T>
        <View style={styles.tiles}>
          <DrillStatTile label="Score" value={score.correct} />
          <DrillStatTile label="Tentés" value={score.attempts} />
          <DrillStatTile label="Précision" value={`${acc.toFixed(0)}%`} />
        </View>
        <Button label="Rejouer" onPress={() => { setIdx(0); setScore({ correct: 0, attempts: 0 }) }} />
      </View>
    )
  }

  return (
    <View style={styles.gap}>
      <T tone="muted" style={styles.small}>
        Score : <T tone="win" style={styles.small}>{score.correct}</T> / {score.attempts}
      </T>
      <ReflexThreatStage
        key={`${current.id}-${idx}`}
        puzzle={current}
        position={idx + 1}
        total={pool.length}
        onAnswered={ok => setScore(s => ({ correct: s.correct + (ok ? 1 : 0), attempts: s.attempts + 1 }))}
        onNext={() => setIdx(i => i + 1)}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  gap: { gap: 12 },
  small: { fontSize: 13, lineHeight: 18 },
  bold: { fontWeight: '600' },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
})
