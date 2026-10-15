// Evaluation curve (White's point of view, ±10 pawns), with the website's
// error dots; tap a point to go to its move.
import { useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import Svg, { Circle, Line, Path, Polyline, Rect } from 'react-native-svg'
import type { MoveAnalysis } from '@shared/types'
import { CLASSIFICATION_COLORS, CLASSIFICATION_GLYPHS } from '@shared/analysis/classify'
import { C } from '@/constants/theme'

const H = 96

export default function EvalGraph({ moves, ply, userColor, onSeek }: {
  moves: MoveAnalysis[]
  ply: number
  userColor: 'white' | 'black'
  onSeek: (ply: number) => void
}) {
  const [width, setWidth] = useState(0)
  const n = moves.length
  if (n === 0) return null
  const xOf = (p: number) => ((p - 0.5) / n) * width
  const yOf = (cp: number) => {
    const v = Math.abs(cp) > 50000 ? Math.sign(cp) * 1000 : Math.max(-1000, Math.min(1000, cp))
    return 4 + (1 - (v + 1000) / 2000) * (H - 8)
  }
  const pts = moves.map((m, i) => `${xOf(i + 1)},${yOf(m.evalAfter)}`).join(' ')
  const area = `M ${xOf(1)} ${yOf(0)} L ${pts.replace(/ /g, ' L ')} L ${xOf(n)} ${yOf(0)} Z`
  const userIsWhite = userColor === 'white'
  return (
    <View style={styles.box} onLayout={e => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 && (
        <Svg width={width} height={H} pointerEvents="none">
          <Rect x={0} y={0} width={width} height={H} fill="#1f1f1f" />
          <Line x1={0} x2={width} y1={yOf(0)} y2={yOf(0)} stroke="#444" strokeDasharray="3 3" />
          <Path d={area} fill="rgba(238,238,210,0.15)" />
          <Polyline points={pts} fill="none" stroke="#cbd5e1" strokeWidth={1.5} />
          {ply > 0 && <Line x1={xOf(ply)} x2={xOf(ply)} y1={0} y2={H} stroke={C.accent} strokeWidth={2} />}
          {moves.map((m, i) => {
            if (!CLASSIFICATION_GLYPHS[m.classification]) return null
            const mine = ((i + 1) % 2 === 1) === userIsWhite
            return (
              <Circle key={i} cx={xOf(i + 1)} cy={yOf(m.evalAfter)} r={mine ? 4 : 3}
                fill={CLASSIFICATION_COLORS[m.classification]} opacity={mine ? 1 : 0.5} stroke="#1a1a1a" strokeWidth={1} />
            )
          })}
        </Svg>
      )}
      {/* One touch column per move. */}
      <View style={StyleSheet.absoluteFill}>
        <View style={styles.columns}>
          {moves.map((m, i) => (
            <Pressable key={i} style={styles.column} onPress={() => onSeek(i + 1)} accessibilityLabel={`Aller au coup ${m.san}`} />
          ))}
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  box: { height: H, borderRadius: 8, overflow: 'hidden' },
  columns: { flex: 1, flexDirection: 'row' },
  column: { flex: 1 },
})
