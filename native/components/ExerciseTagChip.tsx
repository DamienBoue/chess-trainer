// A small coloured label (category, difficulty, motif) on an exercise card.
import { StyleSheet, Text, View } from 'react-native'

export function TagChip({ label, color }: { label: string; color: string }) {
  // Hex + "33" = the website's 20% tinted background.
  return (
    <View style={[styles.chip, { backgroundColor: color + '33' }]}>
      <Text style={[styles.text, { color }]}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  chip: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  text: { fontSize: 12, fontWeight: '600' },
})
