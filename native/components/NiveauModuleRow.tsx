// A roadmap module with its check box. The whole row is the touch target
// (≥ 44px), unlike the web's small checkbox.
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { C, TOUCH } from '@/constants/theme'

export default function NiveauModuleRow({ title, why, area, areaColor, hint, surface, done, onToggle }: {
  title: string
  why: string
  area: string
  areaColor: string
  hint?: string
  surface?: string
  done: boolean
  onToggle: () => void
}) {
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: done }}
      accessibilityLabel={title}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.75 }]}
    >
      <View style={[styles.box, done && styles.boxDone]}>
        {done && <Text style={styles.tick}>✓</Text>}
      </View>
      <View style={styles.body}>
        <Text style={[styles.area, { color: areaColor }]}>{area}</Text>
        <Text style={[styles.title, done && styles.titleDone]}>{title}</Text>
        <Text style={styles.why}>{why}</Text>
        {surface ? <Text style={styles.surface}>Outil : {surface}</Text> : null}
        {hint && !surface ? (
          <View style={styles.hint}>
            <Text style={styles.hintLabel}>Piste d'étude</Text>
            <Text style={styles.hintText}>{hint}</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12, minHeight: TOUCH, paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.border },
  box: { width: 26, height: 26, borderRadius: 6, borderWidth: 2, borderColor: C.faint, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  boxDone: { backgroundColor: C.accent, borderColor: C.accent },
  tick: { color: C.strong, fontSize: 16, fontWeight: '700', lineHeight: 18 },
  body: { flex: 1, gap: 2 },
  area: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 },
  title: { color: C.strong, fontSize: 15, fontWeight: '600', lineHeight: 21 },
  titleDone: { color: C.faint, textDecorationLine: 'line-through' },
  why: { color: C.muted, fontSize: 13, lineHeight: 18 },
  surface: { color: C.accentHover, fontSize: 12, marginTop: 2 },
  hint: { marginTop: 6, padding: 8, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(251,191,36,0.25)', backgroundColor: 'rgba(251,191,36,0.06)' },
  hintLabel: { color: C.warn, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 },
  hintText: { color: '#fde68a', fontSize: 12, lineHeight: 17 },
})
