// "Ouvertures": every game of the window, by colour then opening family,
// with the lines inside. An opening played once or twice says nothing: those
// are counted, not listed.
import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { formatCount, scoreOf, totalOf, type OpeningResult } from '@shared/analysis/results'
import { WdlBar } from '@/components/StatsResultsTab'
import { Button, Card, SectionLabel, T } from '@/components/ui'
import { C } from '@/constants/theme'

const MIN_SAMPLE = 3
/** Openings listed per colour before "Voir tout". */
const FIRST = 8
const pct = (x: number) => `${Math.round(x * 100)}\u00a0%`

export default function StatsOpeningsTab({ openings, average }: { openings: OpeningResult[]; average: number }) {
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [all, setAll] = useState<Set<string>>(new Set())
  const toggle = (key: string) => setOpen(prev => {
    const next = new Set(prev)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    return next
  })
  return (
    <>
      <T tone="faint" style={styles.small}>Score en points (nulle = ½). En vert au-dessus de ta moyenne ({pct(average)}), en rouge nettement en dessous.</T>
      {(['white', 'black'] as const).map(color => {
        const list = openings.filter(o => o.color === color)
        const enough = list.filter(o => totalOf(o) >= MIN_SAMPLE)
        const rare = list.length - enough.length
        const shown = all.has(color) ? enough : enough.slice(0, FIRST)
        return (
          <View key={color} style={styles.gap}>
            <SectionLabel>Avec les {color === 'white' ? 'Blancs' : 'Noirs'}</SectionLabel>
            {shown.length === 0 && <Card><T tone="muted">Pas assez de parties sur cette période.</T></Card>}
            {shown.map(o => {
              const key = `${color}|${o.name}`
              const lines = o.variations.filter(v => v.name !== o.name)
              const multi = lines.length > 1
              const isOpen = open.has(key)
              return (
                <Card key={key} onPress={multi ? () => toggle(key) : undefined} style={styles.card}>
                  <View style={styles.between}>
                    <T tone="strong" style={[styles.bold, styles.flex]}>{multi ? (isOpen ? '▾ ' : '▸ ') : ''}{o.name}</T>
                    <Score r={o} average={average} />
                  </View>
                  <WdlBar r={o} />
                  <T tone="faint" style={styles.small}>{formatCount(totalOf(o))} parties · {formatCount(o.w)}V / {formatCount(o.d)}N / {formatCount(o.l)}D{multi && !isOpen ? ` · ${lines.length} lignes` : ''}</T>
                  {isOpen && lines.map(v => (
                    <View key={v.name} style={[styles.between, styles.variation]}>
                      <T tone="muted" style={[styles.small, styles.flex]}>{v.name}</T>
                      <T tone="faint" style={styles.small}>{pct(scoreOf(v))} · {totalOf(v)}</T>
                    </View>
                  ))}
                </Card>
              )
            })}
            {shown.length < enough.length && (
              <Button label={`Voir les ${enough.length} ouvertures`} kind="secondary" onPress={() => setAll(prev => new Set(prev).add(color))} />
            )}
            {rare > 0 && <T tone="faint" style={styles.small}>+ {rare} ouverture{rare > 1 ? 's' : ''} jouée{rare > 1 ? 's' : ''} moins de {MIN_SAMPLE} fois</T>}
          </View>
        )
      })}
    </>
  )
}

function Score({ r, average }: { r: OpeningResult; average: number }) {
  const s = scoreOf(r)
  const color = s >= average + 0.05 ? C.win : s <= average - 0.1 ? C.danger : C.text
  return <Text style={{ color, fontSize: 15, fontWeight: '700' }}>{pct(s)}</Text>
}

const styles = StyleSheet.create({
  bold: { fontWeight: '600' },
  small: { fontSize: 12, lineHeight: 17 },
  gap: { gap: 10 },
  card: { gap: 8 },
  flex: { flex: 1 },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 },
  variation: { paddingLeft: 12, paddingVertical: 4, borderTopWidth: 1, borderTopColor: C.border },
})
