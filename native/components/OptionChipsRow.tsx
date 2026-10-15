// A row of mutually exclusive choices (colour, level preset, count…), each
// a 44px-high chip: phones have no <select> worth using for 3-6 options.
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { C, TOUCH } from '@/constants/theme'

export default function OptionChipsRow<V extends string | number>({ options, value, onChange }: {
  options: { value: V; label: string }[]
  value: V
  onChange: (v: V) => void
}) {
  return (
    <View style={styles.row}>
      {options.map(o => {
        const on = o.value === value
        return (
          <Pressable
            key={String(o.value)}
            onPress={() => onChange(o.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            style={({ pressed }) => [styles.chip, on && styles.on, pressed && { opacity: 0.75 }]}
          >
            <Text style={[styles.label, on && { color: C.strong }]}>{o.label}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: TOUCH, minWidth: TOUCH, paddingHorizontal: 14, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: C.panel2, borderWidth: 1, borderColor: C.border },
  on: { backgroundColor: C.accent, borderColor: C.accent },
  label: { color: C.muted, fontSize: 15, fontWeight: '600' },
})
