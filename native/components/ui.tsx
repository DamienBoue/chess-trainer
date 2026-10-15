// Small building blocks shared by the screens, in the website's palette.
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, type PressableProps, type StyleProp, type TextStyle, type ViewStyle } from 'react-native'
import { C, RADIUS, TOUCH } from '@/constants/theme'

export function Screen({ children, scroll = true, style }: { children: React.ReactNode; scroll?: boolean; style?: StyleProp<ViewStyle> }) {
  if (!scroll) return <View style={[styles.screen, styles.pad, style]}>{children}</View>
  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.pad, style]} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  )
}

export function H1({ children }: { children: React.ReactNode }) {
  return <Text style={styles.h1}>{children}</Text>
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <Text style={styles.section}>{children}</Text>
}

export function T({ children, tone = 'text', style, numberOfLines }: {
  children: React.ReactNode
  tone?: 'text' | 'strong' | 'muted' | 'faint' | 'accent' | 'danger' | 'win' | 'loss'
  style?: StyleProp<TextStyle>
  numberOfLines?: number
}) {
  const color = { text: C.text, strong: C.strong, muted: C.muted, faint: C.faint, accent: C.accentHover, danger: C.danger, win: C.win, loss: C.loss }[tone]
  return <Text style={[styles.t, { color }, style]} numberOfLines={numberOfLines}>{children}</Text>
}

export function Card({ children, onPress, highlight, disabled, style }: {
  children: React.ReactNode
  onPress?: PressableProps['onPress']
  highlight?: boolean
  disabled?: boolean
  style?: StyleProp<ViewStyle>
}) {
  const base = [styles.card, highlight && styles.cardHighlight, style]
  if (!onPress) return <View style={base}>{children}</View>
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [base, pressed && !disabled && styles.pressed, disabled && styles.disabled]}
    >
      {children}
    </Pressable>
  )
}

export function Button({ label, onPress, kind = 'primary', disabled, busy, style }: {
  label: string
  onPress: () => void
  kind?: 'primary' | 'secondary' | 'ghost'
  disabled?: boolean
  busy?: boolean
  style?: StyleProp<ViewStyle>
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.btn, styles[kind], pressed && styles.pressed, (disabled || busy) && styles.disabled, style]}
    >
      {busy ? <ActivityIndicator color={C.strong} /> : <Text style={[styles.btnText, kind === 'ghost' && { color: C.muted }]}>{label}</Text>}
    </Pressable>
  )
}

export function Pill({ label, tone = 'accent' }: { label: string; tone?: 'accent' | 'muted' }) {
  return (
    <View style={[styles.pill, tone === 'muted' && { backgroundColor: C.panel2 }]}>
      <Text style={styles.pillText}>{label}</Text>
    </View>
  )
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  pad: { padding: 16, gap: 12, paddingBottom: 32 },
  h1: { fontSize: 24, fontWeight: '700', color: C.strong },
  section: { fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: C.faint, marginTop: 8 },
  t: { fontSize: 15, lineHeight: 21 },
  card: { backgroundColor: C.panel, borderColor: C.border, borderWidth: 1, borderRadius: RADIUS, padding: 14, gap: 4 },
  cardHighlight: { borderColor: C.accent, backgroundColor: '#2b3326' },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.45 },
  btn: { minHeight: TOUCH, borderRadius: 8, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  primary: { backgroundColor: C.accent },
  secondary: { backgroundColor: C.panel2, borderWidth: 1, borderColor: C.border },
  ghost: { backgroundColor: 'transparent' },
  btnText: { color: C.strong, fontSize: 15, fontWeight: '600' },
  pill: { backgroundColor: C.accent, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start' },
  pillText: { color: C.strong, fontSize: 12, fontWeight: '600' },
})
