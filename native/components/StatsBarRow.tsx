// One labelled horizontal bar (phases, motifs, move classes): label and value
// on top, a thin bar below — stacked so it reads at 390px, unlike the web's
// single-line row.
import { StyleSheet, Text, View } from 'react-native'
import { C } from '@/constants/theme'

export default function StatsBarRow({ label, value, hint, pct, color, emphasis }: {
  label: string
  value: string
  hint?: string
  /** 0..100 */
  pct: number
  color: string
  emphasis?: boolean
}) {
  return (
    <View style={styles.row}>
      <View style={styles.top}>
        <Text style={[styles.label, emphasis && { color: C.danger, fontWeight: '600' }]} numberOfLines={1}>{label}</Text>
        <Text style={styles.value}>{value}</Text>
      </View>
      <View style={styles.track}>
        <View style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: '100%', backgroundColor: color }} />
      </View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { gap: 4 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 },
  label: { flex: 1, color: C.text, fontSize: 14 },
  value: { color: C.muted, fontSize: 13, fontVariant: ['tabular-nums'] },
  track: { height: 6, borderRadius: 3, backgroundColor: '#171717', overflow: 'hidden' },
  hint: { color: C.faint, fontSize: 11 },
})
