// Small pieces shared by the three openings screens (répertoire, labo,
// miroir): segmented control, opening chips, empty state, feedback banner.
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import { router } from 'expo-router'
import { Button, Card, T } from '@/components/ui'
import { C, TOUCH } from '@/constants/theme'

/** Board side: the window minus the screen padding (and the card padding when boxed), capped. */
export function useOpeningBoardSize(boxed = false): number {
  const { width } = useWindowDimensions()
  return Math.min(width - 32 - (boxed ? 28 : 0), 440)
}

/** Colour of a CPL value, same thresholds as the website. */
export function cplColor(cp: number): string {
  if (cp <= 15) return C.win
  if (cp <= 35) return C.text
  if (cp <= 70) return '#fdba74'
  return C.loss
}

export function OpeningSegments<K extends string>({ value, options, onChange }: {
  value: K
  options: { key: K; label: string }[]
  onChange: (k: K) => void
}) {
  return (
    <View style={s.segments}>
      {options.map(o => (
        <Pressable
          key={o.key}
          onPress={() => onChange(o.key)}
          accessibilityRole="button"
          accessibilityState={{ selected: value === o.key }}
          style={[s.segment, value === o.key && s.segmentOn]}
        >
          <Text style={[s.segmentText, value === o.key && { color: C.strong }]} numberOfLines={1}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  )
}

/** Wrapping chips (one opening + colour each). */
export function OpeningChips({ items, activeKey, onPick }: {
  items: { key: string; label: string; badge: string }[]
  activeKey: string | null
  onPick: (key: string) => void
}) {
  return (
    <View style={s.chips}>
      {items.map(i => {
        const on = i.key === activeKey
        return (
          <Pressable
            key={i.key}
            onPress={() => onPick(i.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            style={[s.chip, on && s.chipOn]}
          >
            <Text style={[s.chipText, on && { color: C.strong }]}>{i.label} <Text style={{ color: on ? C.strong : C.faint }}>{i.badge}</Text></Text>
          </Pressable>
        )
      })}
    </View>
  )
}

export function OpeningEmpty({ title, description }: { title: string; description: string }) {
  return (
    <Card style={{ gap: 8, alignItems: 'flex-start' }}>
      <T tone="strong" style={{ fontSize: 17, fontWeight: '700' }}>{title}</T>
      <T tone="muted">{description}</T>
      <Button label="Voir mes parties" kind="secondary" onPress={() => router.push('/parties')} />
    </Card>
  )
}

export function OpeningFeedback({ status, text }: { status: 'pending' | 'correct' | 'wrong' | 'finished'; text: string | null }) {
  if (!text) return null
  const good = status === 'correct' || status === 'finished'
  const bad = status === 'wrong'
  return (
    <View style={[s.feedback, { backgroundColor: good ? 'rgba(74,222,128,0.12)' : bad ? 'rgba(248,113,113,0.12)' : C.panel2 }]}>
      <T tone={good ? 'win' : bad ? 'loss' : 'text'}>{text}</T>
    </View>
  )
}

const s = StyleSheet.create({
  segments: { flexDirection: 'row', backgroundColor: C.panel, borderColor: C.border, borderWidth: 1, borderRadius: 10, padding: 3, gap: 3 },
  segment: { flex: 1, minHeight: TOUCH - 6, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  segmentOn: { backgroundColor: C.accent },
  segmentText: { color: C.muted, fontSize: 14, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: TOUCH, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 8, backgroundColor: C.panel, borderWidth: 1, borderColor: C.border },
  chipOn: { backgroundColor: C.accent, borderColor: C.accent },
  chipText: { color: C.text, fontSize: 14 },
  feedback: { borderRadius: 8, padding: 10 },
})
