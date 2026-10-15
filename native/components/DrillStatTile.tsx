// A big number over a small label: the end-of-session summaries of the drills.
import { StyleSheet, View } from 'react-native'
import { T } from '@/components/ui'
import { C, RADIUS } from '@/constants/theme'

export default function DrillStatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.tile}>
      <T tone="strong" style={styles.value}>{value}</T>
      <T tone="faint" style={styles.label}>{label}</T>
    </View>
  )
}

const styles = StyleSheet.create({
  // Two per row on a 390px phone, whatever the number of tiles.
  tile: { flexGrow: 1, flexBasis: '45%', alignItems: 'center', backgroundColor: C.panel, borderColor: C.border, borderWidth: 1, borderRadius: RADIUS, padding: 12 },
  value: { fontSize: 24, fontWeight: '700', lineHeight: 30 },
  label: { fontSize: 12, lineHeight: 16 },
})
