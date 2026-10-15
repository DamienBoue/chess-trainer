// A concept's full sheet (explanation, example positions, links, related
// concepts) — the phone version of the website's ConceptCard.
import { useState } from 'react'
import { Linking, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import { router, type Href } from 'expo-router'
import { Chess } from 'chess.js'
import { findConcept } from '@shared/concepts/lookup'
import { CATEGORY_COLORS, CATEGORY_LABELS, type Concept, type ConceptPosition } from '@shared/concepts/types'
import Board, { type BoardArrow } from '@/components/Board'
import { Button, Card, SectionLabel, T } from '@/components/ui'
import { squaresOf } from '@/lib/analysis'
import { C, TOUCH } from '@/constants/theme'

function ConceptPositionCard({ position, size }: { position: ConceptPosition; size: number }) {
  const [showMove, setShowMove] = useState(false)
  // Board is shown from the side to move: that is the side the lesson speaks to.
  const orientation = position.fen.split(' ')[1] === 'b' ? 'black' : 'white'
  const move = squaresOf(position.fen, position.bestSan)
  const arrows: BoardArrow[] = showMove && move ? [{ ...move, color: '#5aa55a' }] : []
  let valid = true
  try { new Chess(position.fen) } catch { valid = false }
  if (!valid) return null
  return (
    <Card>
      {position.caption ? <T style={styles.small}>{position.caption}</T> : null}
      <View style={styles.boardWrap}>
        <Board fen={position.fen} size={size} orientation={orientation} arrows={arrows} />
      </View>
      {position.bestSan && move && (
        <>
          <Button
            kind="secondary"
            label={showMove ? 'Masquer le coup' : 'Voir le coup pédagogique'}
            onPress={() => setShowMove(s => !s)}
          />
          {showMove && (
            <T tone="muted" style={styles.small}>
              Coup : <T tone="strong">{position.bestSan}</T>{position.bestLineSan ? ` · ligne : ${position.bestLineSan}` : ''}
            </T>
          )}
        </>
      )}
    </Card>
  )
}

export default function ConceptBody({ concept }: { concept: Concept }) {
  const { width } = useWindowDimensions()
  const boardSize = Math.min(width - 32 - 30, 560)
  const color = CATEGORY_COLORS[concept.category]
  return (
    <>
      <View style={[styles.badge, { backgroundColor: color + '33' }]}>
        <Text style={[styles.badgeText, { color }]}>{CATEGORY_LABELS[concept.category]}</Text>
      </View>
      <T tone="strong">{concept.shortDef}</T>
      {concept.detail ? <T tone="muted">{concept.detail}</T> : null}

      {concept.positions && concept.positions.length > 0 && <SectionLabel>Positions à explorer</SectionLabel>}
      {concept.positions?.map((p, i) => <ConceptPositionCard key={`${concept.id}-${i}`} position={p} size={boardSize} />)}

      {concept.links && concept.links.length > 0 && <SectionLabel>Pour aller plus loin</SectionLabel>}
      {concept.links?.map((l, i) => (
        <Pressable
          key={i}
          accessibilityRole="link"
          onPress={() => { void Linking.openURL(l.url) }}
          style={({ pressed }) => [styles.link, pressed && { opacity: 0.6 }]}
        >
          <Text style={styles.linkText}>{l.label} <Text style={styles.linkKind}>[{l.kind}] ↗</Text></Text>
        </Pressable>
      ))}

      {concept.related && concept.related.length > 0 && <SectionLabel>Voir aussi</SectionLabel>}
      <View style={styles.chips}>
        {concept.related?.map(rid => {
          const r = findConcept(rid)
          if (!r) return null
          return (
            <Pressable
              key={rid}
              accessibilityRole="button"
              onPress={() => router.push(`/concept/${r.id}` as Href)}
              style={({ pressed }) => [styles.chip, pressed && { opacity: 0.6 }]}
            >
              <Text style={styles.chipText}>{r.title}</Text>
            </Pressable>
          )
        })}
      </View>
    </>
  )
}

const styles = StyleSheet.create({
  small: { fontSize: 14, lineHeight: 20 },
  boardWrap: { alignItems: 'center' },
  badge: { alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', fontWeight: '600' },
  link: { minHeight: TOUCH, justifyContent: 'center' },
  linkText: { color: '#93c5fd', fontSize: 15 },
  linkKind: { color: C.faint, fontSize: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: TOUCH, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 999,
    backgroundColor: C.panel2, borderWidth: 1, borderColor: C.border,
  },
  chipText: { color: C.text, fontSize: 14 },
})
