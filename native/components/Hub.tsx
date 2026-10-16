// Hub page of a part (Entraînement, Théorie, Progrès), from the website's
// navigation model: its tools as cards, their status, and what to do now.
import { useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { NAV, groupItems, type NavItemDef } from '@shared/nav/navModel'
import { Card, Pill, Screen, SectionLabel, T } from '@/components/ui'
import { useAppData } from '@/lib/appData'
import { hrefFor } from '@/lib/routes'
import { C } from '@/constants/theme'

export default function Hub({ groupKey }: { groupKey: string }) {
  const { analyses, exercises, daily } = useAppData()
  // "Due" is today's session (see @shared/analysis/dailyQueue).
  const counts = useMemo(
    () => ({ analyses: Object.keys(analyses).length, exercises: exercises.length, due: daily.remaining.length }),
    [analyses, exercises, daily],
  )
  const entry = NAV.find(e => e.kind === 'group' && e.group.key === groupKey)
  if (!entry || entry.kind !== 'group') return null
  const group = entry.group
  const rec = group.recommend?.(counts) ?? null
  const recItem = rec ? groupItems(group).find(i => i.key === rec.key) : undefined

  return (
    <Screen>
      <T tone="muted">{group.intro}</T>
      {rec && recItem && hrefFor(recItem.target) && (
        <Card highlight onPress={() => router.push(hrefFor(recItem.target)!)}>
          <Text style={styles.overline}>À FAIRE MAINTENANT</Text>
          <T tone="strong" style={styles.label}>{recItem.icon} {recItem.label}</T>
          <T tone="muted">{rec.why}</T>
        </Card>
      )}
      {group.sections.map((section, si) => (
        <View key={si} style={styles.section}>
          {section.label && <SectionLabel>{section.label}</SectionLabel>}
          {section.items.map(item => <HubCard key={item.key} item={item} counts={counts} />)}
        </View>
      ))}
    </Screen>
  )
}

function HubCard({ item, counts }: { item: NavItemDef; counts: { analyses: number; exercises: number; due: number } }) {
  const href = hrefFor(item.target)
  const reason = item.unavailable?.(counts) ?? (href ? null : 'Bientôt sur mobile')
  const status = reason === null ? item.status?.(counts) ?? null : null
  return (
    <Card onPress={() => href && router.push(href)} disabled={reason !== null}>
      <View style={styles.row}>
        <Text style={styles.icon}>{item.icon}</Text>
        <View style={styles.grow}>
          <T tone={reason ? 'faint' : 'strong'} style={styles.label}>{item.label}</T>
          <T tone={reason ? 'faint' : 'muted'} style={styles.small}>{reason ?? item.description}</T>
        </View>
        {status ? <Pill label={status} /> : reason === null && <T tone="faint" style={styles.chevron}>›</T>}
      </View>
    </Card>
  )
}

const styles = StyleSheet.create({
  section: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  grow: { flex: 1, gap: 2 },
  icon: { fontSize: 26, width: 34, textAlign: 'center' },
  label: { fontWeight: '600', fontSize: 16 },
  small: { fontSize: 13, lineHeight: 18 },
  chevron: { fontSize: 24 },
  overline: { fontSize: 11, letterSpacing: 1, color: C.accentHover },
})
