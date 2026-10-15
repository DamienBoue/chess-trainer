// Mirror drill: your most played line with the colours swapped. Every FEN
// and SAN is mirrored; the app plays the (mirrored) opponent, you enter the
// mirrored version of your own moves.
import { useMemo, useState } from 'react'
import { View } from 'react-native'
import { Chess } from 'chess.js'
import type { GameAnalysis } from '@shared/types'
import { buildRepertoire } from '@shared/analysis/repertoire'
import { mostPlayedLine } from '@shared/analysis/openingLine'
import { mirrorFen, mirrorSan } from '@shared/analysis/mirror'
import Board from '@/components/Board'
import { OpeningChips, OpeningEmpty, OpeningFeedback, useOpeningBoardSize } from '@/components/OpeningKit'
import { Button, Card, T } from '@/components/ui'

interface MirrorLine {
  key: string
  label: string
  originalColor: 'white' | 'black'
  /** The side the player takes in the drill (the opposite one). */
  drillColor: 'white' | 'black'
  steps: { fenBefore: string; expectedSan: string; nextOppSan: string | null; count: number; totalAtNode: number }[]
}

function buildMirrorLines(analyses: GameAnalysis[]): MirrorLine[] {
  const out: MirrorLine[] = []
  for (const r of buildRepertoire(analyses).filter(x => x.total >= 2)) {
    const line = mostPlayedLine(r, { maxPlies: 6 })
    if (line.length === 0) continue
    out.push({
      key: `${r.parent}::${r.color}`,
      label: r.parent,
      originalColor: r.color,
      drillColor: r.color === 'white' ? 'black' : 'white',
      steps: line.map((step, i) => ({
        fenBefore: mirrorFen(step.fenBefore),
        expectedSan: mirrorSan(step.userSan),
        nextOppSan: i + 1 < line.length ? mirrorSan(line[i + 1].oppPrev) : null,
        count: step.count,
        totalAtNode: step.totalAtNode,
      })),
    })
  }
  return out
}

type Status = 'pending' | 'correct' | 'wrong' | 'finished'

export default function MirrorDrillSession({ analyses }: { analyses: GameAnalysis[] }) {
  const size = useOpeningBoardSize(true)
  const lines = useMemo(() => buildMirrorLines(analyses), [analyses])
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const [stepIdx, setStepIdx] = useState(0)
  const [fen, setFen] = useState<string | null>(null)
  const [status, setStatus] = useState<Status>('pending')
  const [feedback, setFeedback] = useState<string | null>(null)
  const active = lines.find(l => l.key === activeKey) ?? null

  if (analyses.length === 0) {
    return <OpeningEmpty title="Ouvertures en miroir" description="Tu n'as pas encore de parties analysées. Importe ton historique pour générer un répertoire, puis reviens ici rejouer tes structures à l'envers." />
  }
  if (lines.length === 0) {
    return <OpeningEmpty title="Ouvertures en miroir" description="Tu n'as pas encore au moins 2 parties dans une même ouverture pour générer une ligne miroir. Joue (et analyse) plus de parties dans la même ouverture." />
  }

  function start(key: string) {
    const line = lines.find(l => l.key === key)
    if (!line || line.steps.length === 0) return
    setActiveKey(key); setStepIdx(0); setFeedback(null); setStatus('pending'); setFen(line.steps[0].fenBefore)
  }

  function onMove(from: string, to: string): boolean {
    if (!active || !fen || status === 'finished') return false
    const step = active.steps[stepIdx]
    if (!step) return false
    const c = new Chess(fen)
    let mv
    try { mv = c.move({ from, to, promotion: 'q' }) } catch { return false }
    if (!mv) return false
    if (mv.san !== step.expectedSan) {
      setStatus('wrong')
      setFeedback(`✗ ${mv.san} ≠ ${step.expectedSan} (miroir de ton coup le plus joué ${step.count}/${step.totalAtNode}).`)
      return false
    }
    // Correct: play the mirrored opponent reply to land on the next decision.
    let nextFen = c.fen()
    if (step.nextOppSan) {
      try { const c2 = new Chess(nextFen); c2.move(step.nextOppSan); nextFen = c2.fen() } catch { /* keep position */ }
    }
    const next = stepIdx + 1
    const finished = next >= active.steps.length
    setStepIdx(next)
    setStatus(finished ? 'finished' : 'correct')
    setFen(finished ? nextFen : active.steps[next].fenBefore)
    setFeedback(finished ? `✓ ${mv.san}. Fin de la ligne miroir.` : `✓ ${mv.san}. Adversaire joue ${step.nextOppSan}.`)
    return true
  }

  return (
    <View style={{ gap: 12 }}>
      <T tone="faint" style={{ fontSize: 12 }}>Lignes mémorisées disponibles :</T>
      <OpeningChips
        items={lines.map(l => ({
          key: l.key,
          label: l.label,
          badge: `${l.originalColor === 'white' ? '♔' : '♚'}→${l.drillColor === 'white' ? '♔' : '♚'}`,
        }))}
        activeKey={fen ? activeKey : null}
        onPick={start}
      />
      {!fen && <T tone="faint">Touche une ligne pour démarrer.</T>}
      {active && fen && (
        <Card style={{ gap: 10 }}>
          <T tone="strong" style={{ fontWeight: '600' }}>
            {active.label} miroir · tu joues les {active.drillColor === 'white' ? 'blancs' : 'noirs'} · coup {Math.min(stepIdx + 1, active.steps.length)}/{active.steps.length}
          </T>
          <View style={{ alignItems: 'center' }}>
            <Board key={active.key} fen={fen} size={size} orientation={active.drillColor} onMove={status === 'finished' ? undefined : onMove} />
          </View>
          <OpeningFeedback status={status} text={feedback} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button
              label="Indice" kind="secondary" style={{ flex: 1 }} disabled={status === 'finished'}
              onPress={() => { const st = active.steps[stepIdx]; if (st) setFeedback(`Coup miroir attendu : ${st.expectedSan}.`) }}
            />
            <Button label="Recommencer" kind="secondary" style={{ flex: 1 }} onPress={() => start(active.key)} />
          </View>
        </Card>
      )}
    </View>
  )
}
