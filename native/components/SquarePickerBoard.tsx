// A board where the player taps a square (the "Case forte" drill). Board only
// reports piece moves, so we lay our own 64 touch targets over a read-only one.
import { Pressable, StyleSheet, View } from 'react-native'
import Board, { type BoardArrow } from '@/components/Board'

const FILES = 'abcdefgh'

export default function SquarePickerBoard({ fen, size, orientation, highlights, arrows, onPick }: {
  fen: string
  size: number
  orientation: 'white' | 'black'
  highlights?: Record<string, string>
  arrows?: BoardArrow[]
  /** Undefined once answered: the board becomes read-only. */
  onPick?: (square: string) => void
}) {
  const flipped = orientation === 'black'
  const cell = size / 8
  return (
    <View style={{ width: size, height: size }}>
      <Board fen={fen} size={size} orientation={orientation} highlights={highlights} arrows={arrows} />
      {onPick && (
        <View style={StyleSheet.absoluteFill}>
          {Array.from({ length: 64 }, (_, i) => {
            const x = i % 8, y = Math.floor(i / 8)
            const square = flipped ? `${FILES[7 - x]}${y + 1}` : `${FILES[x]}${8 - y}`
            return (
              <Pressable
                key={square}
                onPress={() => onPick(square)}
                accessibilityRole="button"
                accessibilityLabel={`Case ${square}`}
                style={({ pressed }) => ({ position: 'absolute', left: x * cell, top: y * cell, width: cell, height: cell, backgroundColor: pressed ? 'rgba(56,132,255,0.35)' : 'transparent' })}
              />
            )
          })}
        </View>
      )}
    </View>
  )
}
