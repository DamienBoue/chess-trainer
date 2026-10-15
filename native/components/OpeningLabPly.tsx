// One step of the opening lab: your move and its record on the left, the
// masters' top moves (Lichess explorer) on the right. On a phone the two
// blocks stack. "Voir la position" shows the board with your move (amber)
// and the masters' favourite (green).
import { useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { fetchExplorer, type ExplorerMove, type ExplorerResponse } from '@shared/api/lichess'
import type { OpeningLineStep } from '@shared/analysis/openingLine'
import Board from '@/components/Board'
import { useOpeningBoardSize } from '@/components/OpeningKit'
import { Button, Card, T } from '@/components/ui'
import { C } from '@/constants/theme'

const total = (m: ExplorerMove | ExplorerResponse) => m.white + m.draws + m.black
const AMBER = '#fcd34d'

export default function OpeningLabPly({ step, plyNumber, color, delayMs }: {
  step: OpeningLineStep
  plyNumber: number
  color: 'white' | 'black'
  /** Staggers the requests so eight plies do not hit the explorer at once. */
  delayMs: number
}) {
  const size = useOpeningBoardSize(true)
  const [masters, setMasters] = useState<ExplorerResponse | null>(null)
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading')
  const [showBoard, setShowBoard] = useState(false)

  useEffect(() => {
    const ctrl = new AbortController()
    let live = true
    setState('loading')
    const timer = setTimeout(() => {
      fetchExplorer({ source: 'masters', fen: step.fenBefore, moves: 6 }, ctrl.signal).then(r => {
        if (!live) return
        if (r) { setMasters(r); setState('ok') } else setState('error')
      })
    }, delayMs)
    return () => { live = false; clearTimeout(timer); ctrl.abort() }
  }, [step.fenBefore, delayMs])

  const top = masters?.moves ?? []
  const isDeviation = state === 'ok' && top.length > 0 && !top.slice(0, 3).some(m => m.san === step.userSan)
  const mine = top.find(m => m.san === step.userSan)
  const pct = Math.round(100 * step.count / Math.max(1, step.totalAtNode))
  const uci = (u: string) => ({ from: u.slice(0, 2), to: u.slice(2, 4) })

  return (
    <Card style={{ gap: 10 }}>
      <T tone="faint" style={{ fontSize: 12 }}>
        Demi-coup {plyNumber}{step.oppPrev !== '<start>' ? `  ·  adversaire : ${step.oppPrev}` : ''}
      </T>

      <View style={s.block}>
        <T tone="faint" style={s.label}>Toi</T>
        <T style={{ fontSize: 18, fontWeight: '700', color: isDeviation ? AMBER : C.strong }}>
          {step.userSan} <T tone="faint" style={{ fontSize: 12, fontWeight: '400' }}>{step.count}/{step.totalAtNode} fois ({pct}%)</T>
        </T>
        <T tone="faint" style={{ fontSize: 12 }}>
          Score : {step.wins}V / {step.losses}D / {step.draws}N{step.avgCpLoss > 0 ? ` · ${step.avgCpLoss.toFixed(0)} cp/coup` : ''}
        </T>
        {isDeviation && <T style={{ fontSize: 12, color: AMBER }}>⚠ Coup hors du top 3 des maîtres : déviation théorique possible.</T>}
      </View>

      <View style={s.block}>
        <T tone="faint" style={s.label}>Base des maîtres</T>
        {state === 'loading' && <T tone="faint" style={{ fontSize: 13 }}>Chargement…</T>}
        {state === 'error' && (
          <T tone="faint" style={{ fontSize: 13 }}>
            API indisponible. L'explorateur Lichess demande désormais un token : colle-le dans Préférences → Token Lichess (sur le site).
          </T>
        )}
        {state === 'ok' && top.length === 0 && <T tone="faint" style={{ fontSize: 13 }}>Hors base : position rare chez les maîtres.</T>}
        {top.slice(0, 5).map(m => <MasterRow key={m.uci} m={m} highlight={m.san === step.userSan} />)}
        {mine && masters && (
          <T tone="faint" style={{ fontSize: 11 }}>Ton coup chez les maîtres : {Math.round(100 * total(mine) / Math.max(1, total(masters)))}%</T>
        )}
      </View>

      <Button label={showBoard ? 'Masquer la position' : 'Voir la position'} kind="secondary" onPress={() => setShowBoard(v => !v)} />
      {showBoard && (
        <View style={{ alignItems: 'center' }}>
          <Board
            fen={step.fenBefore}
            size={size}
            orientation={color}
            arrows={[
              ...(top[0] && top[0].san !== step.userSan ? [{ ...uci(top[0].uci), color: '#4ade80' }] : []),
              ...(mine ? [{ ...uci(mine.uci), color: AMBER }] : []),
            ]}
          />
        </View>
      )}
    </Card>
  )
}

function MasterRow({ m, highlight }: { m: ExplorerMove; highlight: boolean }) {
  const n = Math.max(1, total(m))
  const w = Math.round((m.white / n) * 100)
  const d = Math.round((m.draws / n) * 100)
  return (
    <View style={s.mrow}>
      <T style={{ width: 56, fontWeight: '600', color: highlight ? AMBER : C.text }}>{m.san}</T>
      <T tone="faint" style={{ width: 56, textAlign: 'right', fontSize: 12 }}>{total(m)}</T>
      <View style={s.bar}>
        <View style={{ width: `${w}%`, backgroundColor: '#22c55e' }} />
        <View style={{ width: `${d}%`, backgroundColor: '#737373' }} />
        <View style={{ flex: 1, backgroundColor: '#ef4444' }} />
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  block: { backgroundColor: C.bg, borderRadius: 8, padding: 10, gap: 4 },
  label: { fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' },
  mrow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 28 },
  bar: { flex: 1, height: 6, flexDirection: 'row', borderRadius: 3, overflow: 'hidden', backgroundColor: C.panel2 },
})
