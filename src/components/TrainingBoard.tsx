import { Chessboard } from 'react-chessboard'
import type { CSSProperties, ReactNode } from 'react'

// react-chessboard doesn't re-export its Arrow type, so we restate the
// shape locally. Keep it minimal — we just pass these through.
type Arrow = {
  startSquare: string
  endSquare: string
  color: string
}

// Shared chessboard wrapper used across all training/analysis views.
//
// Centralises three things that were drifting across components:
//   * sizing — every board now sits in an aspect-square container so the
//     parent layout doesn't add stray vertical space
//   * colours — green/cream (chess.com / Lichess "green" style) by default
//   * animation timing — 200 ms unless explicitly overridden
//
// Callers still pass through the React-Chessboard `options` they need
// (position, orientation, drag/click handlers, square highlights, arrows…).

interface TrainingBoardProps {
  position: string
  /** Orientation as either a colour name or chess.js 'w'/'b'. */
  orientation?: 'white' | 'black' | 'w' | 'b'
  allowDragging?: boolean
  onPieceDrop?: (args: {
    sourceSquare: string
    targetSquare: string | null
    piece: { pieceType: string }
  }) => boolean
  onSquareClick?: (args: { square: string }) => void
  squareStyles?: Record<string, CSSProperties>
  arrows?: Arrow[]
  /** Stable id so React-Chessboard preserves drag state across re-renders. */
  id?: string
  /** Max edge length of the board in pixels (default 560). */
  maxWidth?: number
  /** Animation duration in ms (default 200; pass 0 for instant). */
  animationDurationInMs?: number
  /** Overlay rendered ABOVE the board within the same square (e.g.
   *  big-tick correct/wrong badge in rush mode). */
  overlay?: ReactNode
}

export default function TrainingBoard({
  position,
  orientation = 'white',
  allowDragging = false,
  onPieceDrop,
  onSquareClick,
  squareStyles,
  arrows,
  id,
  maxWidth = 560,
  animationDurationInMs = 200,
  overlay,
}: TrainingBoardProps) {
  const boardOrientation =
    orientation === 'w' ? 'white' :
    orientation === 'b' ? 'black' :
    orientation
  return (
    <div
      className="relative aspect-square mx-auto w-full"
      style={{ maxWidth }}
    >
      <Chessboard
        options={{
          position,
          boardOrientation,
          allowDragging,
          animationDurationInMs,
          squareStyles,
          arrows,
          darkSquareStyle: { backgroundColor: '#769656' },
          lightSquareStyle: { backgroundColor: '#eeeed2' },
          onPieceDrop,
          onSquareClick,
          id,
        }}
      />
      {overlay}
    </div>
  )
}
