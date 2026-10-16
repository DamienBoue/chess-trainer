// One row of equal segments (iOS segmented control): a period, a time
// control. Unlike chips it never wraps, so the row keeps its height on a
// phone whatever the labels.
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { C, TOUCH } from '@/constants/theme'

export default function Segmented<V extends string>({ options, value, onChange, label }: {
  options: { value: V; label: string }[]
  value: V
  onChange: (v: V) => void
  /** Read by screen readers. */
  label: string
}) {
  return (
    <View style={styles.row} accessibilityRole="tablist" accessibilityLabel={label}>
      {options.map(o => {
        const on = o.value === value
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            aria-selected={on}
            style={({ pressed }) => [styles.seg, on && styles.on, pressed && !on && { opacity: 0.7 }]}
          >
            <Text style={[styles.text, on && styles.textOn]} numberOfLines={1}>{o.label}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', backgroundColor: C.panel, borderRadius: 10, borderWidth: 1, borderColor: C.border, padding: 3, gap: 3 },
  seg: { flex: 1, minHeight: TOUCH - 6, borderRadius: 7, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  on: { backgroundColor: C.accent },
  text: { color: C.muted, fontSize: 14, fontWeight: '600' },
  textOn: { color: C.strong },
})
