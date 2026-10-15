// Atlas of the named pawn structures: families and how many games the
// player has had in each.
import { Stack, router, type Href } from 'expo-router'
import { STRUCTURES } from '@shared/strategy/structures'
import { Card, H1, Screen, SectionLabel, T } from '@/components/ui'
import { useAppData } from '@/lib/appData'
import { STRUCTURE_FAMILIES, useStructureStats } from '@/lib/structuresAtlas'
import { View, StyleSheet } from 'react-native'

export default function StructuresScreen() {
  const { analyses } = useAppData()
  const stats = useStructureStats(analyses)
  return (
    <Screen>
      <Stack.Screen options={{ title: 'Structures de pions' }} />
      <H1>Structures de pions</H1>
      <T tone="muted" style={styles.small}>
        Ce que chaque structure raconte, les plans des deux camps, les ruptures et les cases clés.
      </T>
      {STRUCTURE_FAMILIES.map(f => (
        <View key={f.label} style={styles.family}>
          <SectionLabel>{f.label}</SectionLabel>
          {f.ids.map(id => {
            const p = STRUCTURES.find(x => x.id === id)
            if (!p) return null
            const played = stats.filter(s => s.id === id).reduce((n, s) => n + s.games, 0)
            return (
              <Card key={id} onPress={() => router.push(`/structure/${id}` as Href)} style={styles.row}>
                <T tone="strong" style={styles.name}>{p.name}</T>
                {played > 0 && <T tone="muted" style={styles.small}>{played} partie{played > 1 ? 's' : ''}</T>}
              </Card>
            )
          })}
        </View>
      ))}
    </Screen>
  )
}

const styles = StyleSheet.create({
  small: { fontSize: 13, lineHeight: 18 },
  name: { fontWeight: '600', flexShrink: 1 },
  family: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44, gap: 8 },
})
