// The chessboard: one SVG for squares, highlights, pieces and arrows, under
// 64 touch targets (tap a piece, then its destination — the phone way,
// with the legal squares dotted). Same colours as the website's board.
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import Svg, { Circle, G, Line, Path, Polygon, Rect, Text as SvgText } from 'react-native-svg'
import { Chess, type Square } from 'chess.js'
import { PIECES, type PieceCode, type SvgNode } from './pieces'

const LIGHT = '#eeeed2'
const DARK = '#769656'
const LAST_MOVE = 'rgba(255, 255, 51, 0.38)'
const SELECTED = 'rgba(20, 85, 30, 0.5)'
const FILES = 'abcdefgh'

export interface BoardArrow { from: string; to: string; color: string }

interface Props {
  fen: string
  size: number
  orientation?: 'white' | 'black'
  lastMove?: { from: string; to: string } | null
  arrows?: BoardArrow[]
  /** Extra square tints (strong/weak squares, threats…). */
  highlights?: Record<string, string>
  /** When set, the side to move can play: return true if the move was taken. */
  onMove?: (from: string, to: string) => boolean
}

const PIECE_NAMES: Record<string, string> = { p: 'pion', n: 'cavalier', b: 'fou', r: 'tour', q: 'dame', k: 'roi' }

function squareXY(square: string, flipped: boolean): [number, number] {
  const file = FILES.indexOf(square[0])
  const rank = Number(square[1]) - 1
  return flipped ? [7 - file, rank] : [file, 7 - rank]
}

function renderNode(n: SvgNode, key: number): React.ReactNode {
  // key passed on its own: React 19 warns when it travels inside a spread.
  const props = n.a as Record<string, unknown>
  const kids = n.c.map(renderNode)
  if (n.t === 'g') return <G key={key} {...props}>{kids}</G>
  if (n.t === 'circle') return <Circle key={key} {...props} />
  return <Path key={key} {...props} />
}

// The squares and their coordinates: drawn once (per orientation), never on
// a tap or a move.
const Background = memo(function Background() {
  return (
    <>
      {Array.from({ length: 64 }, (_, i) => {
        const x = i % 8, y = Math.floor(i / 8)
        return <Rect key={i} x={x} y={y} width={1} height={1} fill={(x + y) % 2 === 0 ? LIGHT : DARK} />
      })}
    </>
  )
})

const Coordinates = memo(function Coordinates({ flipped }: { flipped: boolean }) {
  return (
    <>
      {Array.from({ length: 8 }, (_, i) => (
        <G key={`c${i}`}>
          <SvgText x={0.04} y={i + 0.2} fontSize={0.17} fill={i % 2 === 0 ? DARK : LIGHT} fontWeight="600">
            {flipped ? i + 1 : 8 - i}
          </SvgText>
          <SvgText x={i + 0.96} y={7.95} fontSize={0.17} fill={i % 2 === 0 ? LIGHT : DARK} fontWeight="600" textAnchor="end">
            {FILES[flipped ? 7 - i : i]}
          </SvgText>
        </G>
      ))}
    </>
  )
})

// One touch target; re-rendered only when what it holds changes.
const TapSquare = memo(function TapSquare({ square, label, left, top, cell, onTap }: {
  square: string; label: string; left: number; top: number; cell: number; onTap: (square: string) => void
}) {
  return (
    <Pressable
      onPress={() => onTap(square)}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{ position: 'absolute', left, top, width: cell, height: cell }}
    />
  )
})

const Piece = memo(function Piece({ code, x, y }: { code: PieceCode; x: number; y: number }) {
  return <G transform={`translate(${x} ${y}) scale(${1 / 45})`}>{PIECES[code].map(renderNode)}</G>
})

export default function Board({ fen, size, orientation = 'white', lastMove, arrows = [], highlights = {}, onMove }: Props) {
  const flipped = orientation === 'black'
  const chess = useMemo(() => {
    try { return new Chess(fen) } catch { return null }
  }, [fen])
  const [selected, setSelected] = useState<{ fen: string; square: string } | null>(null)
  // A selection belongs to its position: a new position clears it.
  const sel = selected && selected.fen === fen ? selected.square : null
  const targets = useMemo(() => {
    if (!sel || !chess) return new Set<string>()
    return new Set(chess.moves({ square: sel as Square, verbose: true }).map(m => m.to))
  }, [sel, chess])

  const board = chess?.board() ?? []
  const pieces: { code: PieceCode; square: string }[] = []
  board.forEach(row => row.forEach(p => { if (p) pieces.push({ code: `${p.color}${p.type.toUpperCase()}` as PieceCode, square: p.square }) }))

  // The touch targets call the latest tap() through a stable function.
  const tapRef = useRef<(square: string) => void>(() => undefined)
  const onTap = useCallback((square: string) => tapRef.current(square), [])
  useEffect(() => { tapRef.current = tap })

  function tap(square: string) {
    if (!onMove || !chess) return
    const piece = chess.get(square as Square)
    if (sel && targets.has(square)) {
      setSelected(null)
      onMove(sel, square)
      return
    }
    if (piece && piece.color === chess.turn()) setSelected(sel === square ? null : { fen, square })
    else setSelected(null)
  }

  const cell = size / 8
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 8 8" pointerEvents="none">
        <Background />
        {lastMove && [lastMove.from, lastMove.to].map(sq => {
          const [x, y] = squareXY(sq, flipped)
          return <Rect key={`lm${sq}`} x={x} y={y} width={1} height={1} fill={LAST_MOVE} />
        })}
        {Object.entries(highlights).map(([sq, color]) => {
          const [x, y] = squareXY(sq, flipped)
          return <Rect key={`hl${sq}`} x={x} y={y} width={1} height={1} fill={color} />
        })}
        {sel && (() => {
          const [x, y] = squareXY(sel, flipped)
          return <Rect x={x} y={y} width={1} height={1} fill={SELECTED} />
        })()}
        <Coordinates flipped={flipped} />
        {pieces.map(p => {
          const [x, y] = squareXY(p.square, flipped)
          return <Piece key={`${p.code}${p.square}`} code={p.code} x={x} y={y} />
        })}
        {[...targets].map(sq => {
          const [x, y] = squareXY(sq, flipped)
          const capture = !!chess?.get(sq as Square)
          return capture
            ? <Circle key={`t${sq}`} cx={x + 0.5} cy={y + 0.5} r={0.45} stroke="rgba(0,0,0,0.25)" strokeWidth={0.08} fill="none" />
            : <Circle key={`t${sq}`} cx={x + 0.5} cy={y + 0.5} r={0.15} fill="rgba(0,0,0,0.25)" />
        })}
        {arrows.map((a, i) => <Arrow key={i} {...a} flipped={flipped} />)}
      </Svg>
      {onMove && (
        <View style={StyleSheet.absoluteFill}>
          {Array.from({ length: 64 }, (_, i) => {
            const x = i % 8, y = Math.floor(i / 8)
            const square = flipped ? `${FILES[7 - x]}${y + 1}` : `${FILES[x]}${8 - y}`
            const p = chess?.get(square as Square)
            return (
              <TapSquare
                key={square}
                square={square}
                label={p ? `${square}, ${PIECE_NAMES[p.type]} ${p.color === 'w' ? 'blanc' : 'noir'}` : square}
                left={x * cell}
                top={y * cell}
                cell={cell}
                onTap={onTap}
              />
            )
          })}
        </View>
      )}
    </View>
  )
}

function Arrow({ from, to, color, flipped }: BoardArrow & { flipped: boolean }) {
  const [fx, fy] = squareXY(from, flipped)
  const [tx, ty] = squareXY(to, flipped)
  const x1 = fx + 0.5, y1 = fy + 0.5, x2 = tx + 0.5, y2 = ty + 0.5
  const len = Math.hypot(x2 - x1, y2 - y1)
  if (len === 0) return null
  const ux = (x2 - x1) / len, uy = (y2 - y1) / len
  const head = 0.42, half = 0.24
  const bx = x2 - ux * head, by = y2 - uy * head
  return (
    <G opacity={0.85}>
      <Line x1={x1} y1={y1} x2={bx} y2={by} stroke={color} strokeWidth={0.16} strokeLinecap="round" />
      <Polygon points={`${x2},${y2} ${bx - uy * half},${by + ux * half} ${bx + uy * half},${by - ux * half}`} fill={color} />
    </G>
  )
}
