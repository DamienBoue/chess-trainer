// Weekly average centipawn loss as a small line (lower is better). The web
// has a fuller chart (ProgressCharts); one line is enough on a phone.
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import Svg, { Circle, Line, Polyline } from 'react-native-svg'
import { C } from '@/constants/theme'

const H = 80

export default function StatsSparkline({ values, color = C.accentHover }: { values: number[]; color?: string }) {
  const [width, setWidth] = useState(0)
  const n = values.length
  const max = Math.max(1, ...values)
  const min = Math.min(...values, max)
  const span = Math.max(1, max - min)
  const x = (i: number) => 8 + (n <= 1 ? 0.5 : i / (n - 1)) * Math.max(0, width - 16)
  const y = (v: number) => 8 + ((v - min) / span) * (H - 16)
  return (
    <View style={styles.box} onLayout={e => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 && n > 0 && (
        <Svg width={width} height={H} pointerEvents="none">
          <Line x1={0} x2={width} y1={H - 1} y2={H - 1} stroke={C.border} />
          {n > 1 && <Polyline points={values.map((v, i) => `${x(i)},${y(v)}`).join(' ')} fill="none" stroke={color} strokeWidth={2} />}
          {values.map((v, i) => <Circle key={i} cx={x(i)} cy={y(v)} r={3} fill={color} />)}
        </Svg>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  box: { height: H, borderRadius: 6, backgroundColor: '#1f1f1f', overflow: 'hidden' },
})
