// Compact, collapsible filters of the exercise list: one tappable line (with
// the current selection summarised) that opens the chip rows. Closed by
// default so the board comes first on a phone.
import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { CATEGORY_COLORS, CATEGORY_LABELS, DIFFICULTY_COLORS, DIFFICULTY_LABELS } from '@shared/analysis/exercises'
import {
  type CategoryFilter, type DifficultyFilter, type FilterCounts, type StatusFilter,
  CATEGORY_KEYS, DIFFICULTY_KEYS, STATUS_OPTIONS, exerciseCountLabel, filtersSummary,
} from '@shared/components/exerciseFilters'
import { T } from '@/components/ui'
import { C, RADIUS, TOUCH } from '@/constants/theme'

interface Props {
  status: StatusFilter
  onStatus: (v: StatusFilter) => void
  category: CategoryFilter
  onCategory: (v: CategoryFilter) => void
  difficulty: DifficultyFilter
  onDifficulty: (v: DifficultyFilter) => void
  counts: FilterCounts
  /** Exercises left after filtering. */
  shown: number
}

export default function ExerciseFiltersFold(p: Props) {
  const [open, setOpen] = useState(false)
  return (
    <View style={styles.box}>
      <Pressable
        onPress={() => setOpen(o => !o)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={styles.head}
      >
        <View style={{ flex: 1 }}>
          <T tone="strong" style={styles.title}>Filtres  <T tone="muted" style={styles.small}>{exerciseCountLabel(p.shown)}</T></T>
          <T tone="faint" style={styles.small} numberOfLines={1}>
            {filtersSummary({ status: p.status, category: p.category, difficulty: p.difficulty, motif: 'all' })}
          </T>
        </View>
        <Text style={styles.chevron}>{open ? '▴' : '▾'}</Text>
      </Pressable>
      {open && (
        <View style={styles.body}>
          <View style={styles.row}>
            {STATUS_OPTIONS.map(o => (
              <Chip key={o.value} label={o.label} count={p.counts[o.value]} active={p.status === o.value} onPress={() => p.onStatus(o.value)} />
            ))}
          </View>
          <View style={styles.row}>
            <Chip label="Toutes catégories" count={p.counts.all} active={p.category === 'all'} onPress={() => p.onCategory('all')} />
            {CATEGORY_KEYS.map(c => (
              <Chip key={c} label={CATEGORY_LABELS[c]} count={p.counts[c]} color={CATEGORY_COLORS[c]} active={p.category === c} onPress={() => p.onCategory(c)} />
            ))}
          </View>
          <View style={styles.row}>
            <Chip label="Toutes difficultés" count={p.counts.all} active={p.difficulty === 'all'} onPress={() => p.onDifficulty('all')} />
            {DIFFICULTY_KEYS.map(d => (
              <Chip key={d} label={DIFFICULTY_LABELS[d]} count={p.counts[d]} color={DIFFICULTY_COLORS[d]} active={p.difficulty === d} onPress={() => p.onDifficulty(d)} />
            ))}
          </View>
        </View>
      )}
    </View>
  )
}

function Chip({ label, count, active, color, onPress }: { label: string; count: number; active: boolean; color?: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[styles.chip, active && styles.chipOn]}
    >
      {color && !active ? <View style={[styles.dot, { backgroundColor: color }]} /> : null}
      <Text style={[styles.chipText, active && { color: C.strong }]}>{label} <Text style={{ opacity: 0.6 }}>({count})</Text></Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  box: { backgroundColor: C.panel, borderColor: C.border, borderWidth: 1, borderRadius: RADIUS },
  head: { minHeight: TOUCH, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 6 },
  title: { fontSize: 14, fontWeight: '600', lineHeight: 18 },
  small: { fontSize: 12, lineHeight: 16 },
  chevron: { color: C.muted, fontSize: 16 },
  body: { gap: 10, padding: 12, borderTopWidth: 1, borderTopColor: C.border },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: TOUCH, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: C.border },
  chipOn: { backgroundColor: C.accent, borderColor: C.accent },
  chipText: { color: C.text, fontSize: 13 },
  dot: { width: 8, height: 8, borderRadius: 4 },
})
