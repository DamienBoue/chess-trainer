// "−  value  +" in 44px buttons: the phone replacement for the website's
// range sliders (a slider is hard to land on an exact value with a thumb).
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { C, TOUCH } from '@/constants/theme'

export default function NumberStepperRow({ value, min, max, step = 1, onChange, unit }: {
  value: number
  min: number
  max: number
  step?: number
  onChange: (v: number) => void
  unit?: string
}) {
  const set = (v: number) => onChange(Math.max(min, Math.min(max, v)))
  return (
    <View style={styles.row}>
      <Pressable accessibilityRole="button" accessibilityLabel="Diminuer" disabled={value <= min} onPress={() => set(value - step)}
        style={({ pressed }) => [styles.btn, (pressed || value <= min) && { opacity: 0.5 }]}>
        <Text style={styles.sign}>−</Text>
      </Pressable>
      <Text style={styles.value}>{value}{unit ? ` ${unit}` : ''}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Augmenter" disabled={value >= max} onPress={() => set(value + step)}
        style={({ pressed }) => [styles.btn, (pressed || value >= max) && { opacity: 0.5 }]}>
        <Text style={styles.sign}>+</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  btn: { width: TOUCH, height: TOUCH, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: C.panel2, borderWidth: 1, borderColor: C.border },
  sign: { color: C.strong, fontSize: 22, fontWeight: '600' },
  value: { color: C.strong, fontSize: 18, fontWeight: '700', minWidth: 90, textAlign: 'center' },
})
