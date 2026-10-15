// The theory library: category filter, search, cards. Tap one for its sheet.
import { useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { Stack, router, type Href } from 'expo-router'
import { allConcepts, searchConcepts } from '@shared/concepts/lookup'
import { CATEGORY_COLORS, CATEGORY_LABELS, type ConceptCategory } from '@shared/concepts/types'
import { Card, H1, Screen, T } from '@/components/ui'
import { C, TOUCH } from '@/constants/theme'

const CATEGORIES: Array<ConceptCategory | 'all'> = ['all', 'tactics', 'endgame', 'structure', 'opening', 'strategy', 'mindset']

export default function ConceptsScreen() {
  const [cat, setCat] = useState<ConceptCategory | 'all'>('all')
  const [query, setQuery] = useState('')
  const filtered = useMemo(() => {
    const list = searchConcepts(query)
    return cat === 'all' ? list : list.filter(c => c.category === cat)
  }, [cat, query])

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Concepts' }} />
      <H1>Concepts</H1>
      <T tone="muted" style={styles.small}>
        Définitions courtes, ressources externes, positions à explorer. {allConcepts().length} fiches.
      </T>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Chercher (fourchette, IQP, Vancura…)"
        placeholderTextColor={C.faint}
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="while-editing"
        returnKeyType="search"
        style={styles.input}
      />
      {/* Horizontal chips: one row on a phone instead of three wrapped ones. */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {CATEGORIES.map(c => (
          <Pressable
            key={c}
            accessibilityRole="button"
            accessibilityState={{ selected: c === cat }}
            onPress={() => setCat(c)}
            style={[styles.chip, c === cat && styles.chipOn]}
          >
            <Text style={styles.chipText}>{c === 'all' ? 'Toutes' : CATEGORY_LABELS[c]}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {filtered.length === 0 && <T tone="faint">Aucun résultat.</T>}
      {filtered.map(c => (
        <Card key={c.id} onPress={() => router.push(`/concept/${c.id}` as Href)}>
          <View style={styles.meta}>
            <Text style={[styles.cat, { color: CATEGORY_COLORS[c.category] }]}>{CATEGORY_LABELS[c.category]}</Text>
            {c.positions && c.positions.length > 0 ? <Text style={styles.count}>♟ {c.positions.length}</Text> : null}
            {c.links && c.links.length > 0 ? <Text style={styles.count}>↗ {c.links.length}</Text> : null}
          </View>
          <T tone="strong" style={styles.title}>{c.title}</T>
          <T tone="muted" numberOfLines={3} style={styles.small}>{c.shortDef}</T>
        </Card>
      ))}
    </Screen>
  )
}

const styles = StyleSheet.create({
  small: { fontSize: 13, lineHeight: 18 },
  title: { fontWeight: '600', fontSize: 16 },
  input: {
    minHeight: TOUCH, borderRadius: 8, borderWidth: 1, borderColor: C.border, backgroundColor: C.panel,
    color: C.text, paddingHorizontal: 12, fontSize: 15,
  },
  chips: { gap: 8, paddingVertical: 2 },
  chip: {
    minHeight: TOUCH, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 999,
    backgroundColor: C.panel, borderWidth: 1, borderColor: C.border,
  },
  chipOn: { backgroundColor: C.accent, borderColor: C.accent },
  chipText: { color: C.strong, fontSize: 14 },
  meta: { flexDirection: 'row', gap: 8, alignItems: 'baseline' },
  cat: { fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', fontWeight: '600' },
  count: { fontSize: 11, color: C.faint },
})
