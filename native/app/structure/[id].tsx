// One pawn structure: reference position on the board, plans of both sides,
// thematic breaks (arrows), key squares (tinted) and the player's record.
import { useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import { Stack, router, useLocalSearchParams, type Href } from 'expo-router'
import { SIDE_LABEL, parseFen, sqName, type Side } from '@shared/strategy/board'
import { STRUCTURES, detectStructures, structureRole } from '@shared/strategy/structures'
import { STRUCTURE_SAMPLES, sampleFen } from '@shared/strategy/samples'
import { findConcept } from '@shared/concepts/lookup'
import Board, { type BoardArrow } from '@/components/Board'
import { Button, Card, H1, Screen, SectionLabel, T } from '@/components/ui'
import { useAppData } from '@/lib/appData'
import { useStructureStats } from '@/lib/structuresAtlas'
import { C, TOUCH } from '@/constants/theme'

const PLAN_ARROW = '#5aa55a'
const KEY_SQUARE = 'rgba(90, 165, 90, 0.5)'

export default function StructureScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { analyses } = useAppData()
  const stats = useStructureStats(analyses)
  const { width } = useWindowDimensions()
  const [side, setSide] = useState<Side>('w')
  const pattern = STRUCTURES.find(p => p.id === id)
  const sample = STRUCTURE_SAMPLES.find(s => s.structureId === id)
  const fen = useMemo(() => { try { return sample ? sampleFen(sample) : null } catch { return null } }, [sample])
  const match = useMemo(
    () => (fen && pattern ? detectStructures(parseFen(fen)).find(m => m.pattern.id === pattern.id) ?? null : null),
    [fen, pattern],
  )

  if (!pattern) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Structure' }} />
        <T tone="muted">Cette structure n'existe pas.</T>
      </Screen>
    )
  }

  const other: Side = side === 'w' ? 'b' : 'w'
  const role = match ? structureRole(match, side) : null
  const otherRole = match ? structureRole(match, other) : null
  const arrows: BoardArrow[] = (role?.breaks ?? []).map(([from, to]) => ({ from: sqName(from), to: sqName(to), color: PLAN_ARROW }))
  const highlights: Record<string, string> = {}
  for (const sq of role?.squares ?? []) highlights[sqName(sq)] = KEY_SQUARE
  const mine = stats.filter(s => s.id === pattern.id)
  const concept = pattern.conceptId ? findConcept(pattern.conceptId) : undefined
  const boardSize = Math.min(width - 32, 560)

  return (
    <Screen>
      <Stack.Screen options={{ title: pattern.name }} />
      <H1>{pattern.name}</H1>
      {sample && <T tone="faint" style={styles.small}>Exemple : {sample.opening}</T>}
      <T tone="muted">{pattern.summary}</T>
      {concept && <Button kind="secondary" label="📖 Fiche détaillée" onPress={() => router.push(`/concept/${concept.id}` as Href)} />}

      {fen && (
        <View style={styles.boardWrap}>
          <Board fen={fen} size={boardSize} orientation={side === 'w' ? 'white' : 'black'} arrows={arrows} highlights={highlights} />
        </View>
      )}
      <T tone="faint" style={styles.small}>
        Flèches : ruptures thématiques des {SIDE_LABEL[side].toLowerCase()} · en vert : leurs cases clés.
      </T>

      <View style={styles.toggle} accessibilityRole="tablist">
        {(['w', 'b'] as Side[]).map(s => (
          <Pressable
            key={s}
            accessibilityRole="tab"
            accessibilityState={{ selected: side === s }}
            onPress={() => setSide(s)}
            style={[styles.toggleBtn, side === s && styles.toggleOn]}
          >
            <Text style={styles.toggleText}>Plans des {SIDE_LABEL[s]}</Text>
          </Pressable>
        ))}
      </View>

      {role && (
        <Card>
          <T tone="faint" style={styles.small}>Dans cet exemple, les {SIDE_LABEL[side]} sont {role.role}.</T>
          {role.plans.map((p, i) => <T key={i} style={styles.plan}>• {p}</T>)}
        </Card>
      )}
      {otherRole && (
        <Card>
          <SectionLabel>Et l'adversaire ? ({otherRole.role})</SectionLabel>
          {otherRole.plans.map((p, i) => <T key={i} tone="muted" style={styles.plan}>• {p}</T>)}
        </Card>
      )}

      {mine.length > 0 && (
        <Card>
          <SectionLabel>Dans tes parties</SectionLabel>
          {mine.map(s => (
            <T key={s.role} style={styles.plan}>
              {s.roleLabel.charAt(0).toUpperCase() + s.roleLabel.slice(1)} : <T tone="strong">{s.games} partie{s.games > 1 ? 's' : ''}</T>,
              {' '}score {Math.round(s.score * 100)} %, {Math.round(s.avgCpLoss)} cp perdus par coup.
            </T>
          ))}
        </Card>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  small: { fontSize: 13, lineHeight: 18 },
  plan: { fontSize: 14, lineHeight: 20, marginTop: 4 },
  boardWrap: { alignItems: 'center' },
  toggle: { flexDirection: 'row', gap: 8 },
  toggleBtn: {
    flex: 1, minHeight: TOUCH, alignItems: 'center', justifyContent: 'center', borderRadius: 8,
    backgroundColor: C.panel, borderWidth: 1, borderColor: C.border,
  },
  toggleOn: { backgroundColor: C.accent, borderColor: C.accent },
  toggleText: { color: C.strong, fontSize: 14, fontWeight: '600' },
})
