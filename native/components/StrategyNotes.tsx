// Strategic reading of a position (shared engine of src/strategy): the
// structure, the centre, the key findings and the plans of the side to move.
import { useMemo } from 'react'
import { StyleSheet, View } from 'react-native'
import { analyzePosition } from '@shared/strategy/report'
import { Card, SectionLabel, T } from '@/components/ui'
import { C } from '@/constants/theme'

export default function StrategyNotes({ fen, userSide }: { fen: string; userSide: 'w' | 'b' }) {
  const report = useMemo(() => {
    try { return analyzePosition(fen) } catch { return null }
  }, [fen])
  if (!report) return null
  const structure = report.structures[0]
  const insights = report.insights.filter(i => i.polarity !== 'info').slice(0, 4)
  const plans = report.plans[userSide].slice(0, 3)
  return (
    <Card>
      <SectionLabel>Lecture stratégique</SectionLabel>
      {structure && <T tone="strong" style={styles.bold}>Structure : {structure.pattern.name}</T>}
      <T tone="muted" style={styles.small}>{report.center.label} — {report.center.advice}</T>
      {insights.map(i => (
        <View key={i.id} style={styles.line}>
          <T style={[styles.mark, { color: i.polarity === 'plus' ? C.win : C.loss }]}>{i.polarity === 'plus' ? '+' : '−'}</T>
          <View style={styles.grow}>
            <T style={styles.small}>{i.title} <T tone="faint" style={styles.small}>({i.side === userSide ? 'toi' : 'adversaire'})</T></T>
          </View>
        </View>
      ))}
      {plans.length > 0 && <SectionLabel>Tes plans</SectionLabel>}
      {plans.map(p => (
        <View key={p.id} style={styles.plan}>
          <T tone="strong" style={styles.bold}>{p.title}</T>
          <T tone="muted" style={styles.small}>{p.why}</T>
        </View>
      ))}
    </Card>
  )
}

const styles = StyleSheet.create({
  bold: { fontWeight: '600' },
  small: { fontSize: 13, lineHeight: 18 },
  line: { flexDirection: 'row', gap: 6 },
  mark: { fontWeight: '700', width: 12 },
  grow: { flex: 1 },
  plan: { gap: 2, marginTop: 4 },
})
