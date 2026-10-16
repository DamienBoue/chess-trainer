// The opening tree a player really plays on Lichess (explorer, "player"
// source), walked move by move from the start position. Same panel as the
// website's scouting page.
import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Chess } from 'chess.js'
import { fetchExplorer, type ExplorerResponse } from '@shared/api/lichess'
import Board from '@/components/Board'
import { OpeningSegments, useOpeningBoardSize } from '@/components/OpeningKit'
import { Button, Card, SectionLabel, T } from '@/components/ui'
import { C, TOUCH } from '@/constants/theme'

type Color = 'white' | 'black'

function formatLine(sans: string[]): string {
  return sans.map((s, i) => (i % 2 === 0 ? `${Math.floor(i / 2) + 1}. ${s}` : s)).join(' ')
}

function replay(sans: string[]): string {
  const c = new Chess()
  for (const s of sans) c.move(s)
  return c.fen()
}

export default function ScoutExplorerPanel({ username }: { username: string }) {
  const size = useOpeningBoardSize(true)
  const [color, setColor] = useState<Color>('white')
  const [sans, setSans] = useState<string[]>([])
  const [data, setData] = useState<ExplorerResponse | null>(null)
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading')
  const fen = replay(sans)

  // New player or colour: back to the start position (adjusted during render
  // so the new side is never queried from the old position).
  const [of, setOf] = useState({ username, color })
  if (of.username !== username || of.color !== color) {
    setOf({ username, color })
    setSans([])
  }

  useEffect(() => {
    let aborted = false
    const ctrl = new AbortController()
    setState('loading')
    void fetchExplorer({ source: 'player', player: username, color, fen, speeds: ['blitz', 'rapid', 'classical'], moves: 10 }, ctrl.signal).then(r => {
      if (aborted) return
      setData(r)
      setState(r ? 'ok' : 'error')
    })
    return () => { aborted = true; ctrl.abort() }
  }, [username, color, fen])

  const total = data ? data.white + data.draws + data.black : 0
  const mine = (w: number, d: number, b: number) => {
    const n = w + d + b
    return n > 0 ? ((color === 'white' ? w : b) + 0.5 * d) / n : 0
  }

  return (
    <Card style={{ gap: 10 }}>
      <SectionLabel>🎯 Explorateur Lichess (parties de @{username})</SectionLabel>
      <OpeningSegments
        value={color}
        onChange={setColor}
        options={[{ key: 'white', label: 'Quand il joue Blancs' }, { key: 'black', label: 'Quand il joue Noirs' }]}
      />
      <T tone="faint">
        Si @{username} a un compte Lichess du même pseudo, ses parties publiques y sont indexées. Touche une réponse pour explorer la suite de son répertoire.
      </T>
      <View style={{ alignSelf: 'center' }}>
        <Board fen={fen} size={size} orientation={color} />
      </View>
      <T tone={sans.length ? 'text' : 'faint'}>{sans.length ? formatLine(sans) : 'Position initiale.'}</T>
      {sans.length > 0 ? (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button label="← Annuler" kind="secondary" onPress={() => setSans(s => s.slice(0, -1))} style={{ flex: 1 }} />
          <Button label="Position initiale" kind="secondary" onPress={() => setSans([])} style={{ flex: 1 }} />
        </View>
      ) : null}

      {state === 'loading' ? <T tone="muted">Chargement…</T> : null}
      {state === 'error' ? <T style={{ color: C.warn }}>Lichess injoignable (pseudo absent ou compte privé ?)</T> : null}
      {state === 'ok' && data ? (
        <View>
          <T tone="muted">
            {total} parties · score de @{username} : {(mine(data.white, data.draws, data.black) * 100).toFixed(0)}%
            {data.opening?.name ? ` · ${data.opening.name}` : ''}
          </T>
          {data.moves.length === 0 ? <T tone="faint">Aucun coup recensé depuis cette position.</T> : data.moves.slice(0, 8).map(m => {
            const n = m.white + m.draws + m.black
            const sc = mine(m.white, m.draws, m.black)
            return (
              <Pressable key={m.uci} onPress={() => setSans(s => [...s, m.san])} accessibilityRole="button" style={styles.row}>
                <Text style={styles.san}>{m.san}<Text style={styles.freq}>  {total > 0 ? ((n / total) * 100).toFixed(0) : 0}%</Text></Text>
                <Text style={styles.n}>{n}</Text>
                <Text style={[styles.score, { color: sc >= 0.6 ? C.win : sc >= 0.4 ? C.text : C.loss }]}>{(sc * 100).toFixed(0)}%</Text>
              </Pressable>
            )
          })}
        </View>
      ) : null}
    </Card>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', minHeight: TOUCH, borderTopColor: C.border, borderTopWidth: 1, gap: 8 },
  san: { flex: 1, color: C.strong, fontSize: 16, fontWeight: '600' },
  freq: { color: C.faint, fontSize: 12, fontWeight: '400' },
  n: { color: C.muted, fontSize: 13, width: 48, textAlign: 'right' },
  score: { fontSize: 14, fontWeight: '600', width: 44, textAlign: 'right' },
})
