// The game's moves, numbered, with the website's quality glyphs; tap to go.
import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { MoveAnalysis } from '@shared/types'
import { CLASSIFICATION_COLORS, CLASSIFICATION_GLYPHS } from '@shared/analysis/classify'
import { C } from '@/constants/theme'

export default function MoveList({ moves, ply, onSeek }: { moves: MoveAnalysis[]; ply: number; onSeek: (ply: number) => void }) {
  return (
    <View style={styles.wrap}>
      {moves.map((m, i) => {
        const p = i + 1
        const glyph = CLASSIFICATION_GLYPHS[m.classification]
        return (
          <View key={p} style={styles.item}>
            {p % 2 === 1 && <Text style={styles.num}>{Math.ceil(p / 2)}.</Text>}
            <Pressable onPress={() => onSeek(p)} style={[styles.move, p === ply && styles.current]} hitSlop={4}>
              <Text style={[styles.san, p === ply && styles.sanCurrent]}>
                {m.san}
                {glyph && <Text style={{ color: CLASSIFICATION_COLORS[m.classification] }}>{glyph}</Text>}
              </Text>
            </Pressable>
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 4 },
  item: { flexDirection: 'row', alignItems: 'center' },
  num: { color: C.faint, fontSize: 13, marginLeft: 6, marginRight: 2, fontVariant: ['tabular-nums'] },
  move: { paddingHorizontal: 6, paddingVertical: 4, borderRadius: 5 },
  current: { backgroundColor: C.accent },
  san: { color: C.text, fontSize: 15, fontFamily: 'Menlo' },
  sanCurrent: { color: C.strong, fontWeight: '700' },
})
