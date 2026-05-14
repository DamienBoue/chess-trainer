import { Chess, type Square } from 'chess.js'
import { Chessboard } from 'react-chessboard'
import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { getBoardColors } from '../storage/settings'

// react-chessboard doesn't re-export its Arrow type, so we restate the
// shape locally. Keep it minimal — we just pass these through.
type Arrow = {
  startSquare: string
  endSquare: string
  color: string
}

// Shared chessboard wrapper used across all training/analysis views.
//
// Centralises:
//   * sizing — aspect-square container so parent layouts don't add space
//   * colours — green/cream by default, reactive to settings.boardTheme
//   * animation timing — 200 ms unless overridden
//   * tap-to-move — clicking a piece selects it and shows its legal
//     destinations; clicking a destination plays the move via the
//     existing onPieceDrop callback. Drag still works for desktop users.

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

// Visual feedback for tap-to-move.
const SELECTED_STYLE: CSSProperties = {
  backgroundColor: 'rgba(255, 204, 0, 0.45)',
}
// A subtle inset dot for legal empty destinations + ring for captures.
const DEST_EMPTY_STYLE: CSSProperties = {
  background: 'radial-gradient(circle, rgba(0,0,0,0.32) 18%, transparent 22%)',
}
const DEST_CAPTURE_STYLE: CSSProperties = {
  background: 'radial-gradient(circle, transparent 56%, rgba(0,0,0,0.32) 60%)',
  borderRadius: 0,
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

  // Reactive board colours — re-read when the user changes the theme.
  const [colors, setColors] = useState(() => getBoardColors())
  useEffect(() => {
    function onChange() { setColors(getBoardColors()) }
    window.addEventListener('settings-changed', onChange)
    return () => window.removeEventListener('settings-changed', onChange)
  }, [])

  // Tap-to-move state. Active only when the board accepts drops AND a
  // piece-drop handler is wired (otherwise we can't replay the move).
  const tapEnabled = allowDragging && !!onPieceDrop
  const [selected, setSelected] = useState<Square | null>(null)
  // Clear selection whenever the position changes (e.g. opponent reply,
  // exercise change). Without this, the previous selection bleeds onto
  // the new position and its destination dots are stale.
  useEffect(() => { setSelected(null) }, [position])

  // Pre-compute legal destinations for the currently-selected piece.
  const legalTargets = useMemo<Record<Square, 'empty' | 'capture'>>(() => {
    if (!tapEnabled || !selected) return {} as Record<Square, 'empty' | 'capture'>
    try {
      const b = new Chess(position)
      const moves = b.moves({ square: selected, verbose: true }) as Array<{
        to: Square; flags: string
      }>
      const out: Record<string, 'empty' | 'capture'> = {}
      for (const m of moves) {
        out[m.to] = m.flags.includes('c') || m.flags.includes('e') ? 'capture' : 'empty'
      }
      return out as Record<Square, 'empty' | 'capture'>
    } catch {
      return {} as Record<Square, 'empty' | 'capture'>
    }
  }, [position, selected, tapEnabled])

  function handleSquareClick(args: { square: string }) {
    // Always fire the caller's handler first (e.g. BlunderDrillView's
    // "click the threatened piece"). The downstream may use this purely
    // for selection feedback and ignore our tap-to-move logic.
    onSquareClick?.(args)
    if (!tapEnabled || !onPieceDrop) return

    const sq = args.square as Square
    let board: Chess
    try { board = new Chess(position) } catch { return }
    const piece = board.get(sq)

    // 1) A piece is selected and the user clicked a legal destination → play.
    if (selected && legalTargets[sq]) {
      const fromPiece = board.get(selected)
      if (fromPiece) {
        const pieceCode = (fromPiece.color === 'w' ? 'w' : 'b').toUpperCase() +
          fromPiece.type.toUpperCase()
        const accepted = onPieceDrop({
          sourceSquare: selected,
          targetSquare: sq,
          // react-chessboard's `pieceType` is "wP", "bN", etc. We mirror it
          // so the consumer's autoPromotion logic kicks in correctly.
          piece: { pieceType: pieceCode },
        })
        if (accepted) setSelected(null)
      }
      return
    }

    // 2) Click on a piece of the side-to-move → select it.
    if (piece && piece.color === board.turn()) {
      setSelected(sq)
      return
    }

    // 3) Click elsewhere → clear selection.
    setSelected(null)
  }

  // Merge styles: caller's > selection highlight > legal-destination dots.
  const mergedStyles: Record<string, CSSProperties> = useMemo(() => {
    const out: Record<string, CSSProperties> = {}
    if (selected && tapEnabled) {
      out[selected] = { ...SELECTED_STYLE }
      for (const [sq, kind] of Object.entries(legalTargets)) {
        out[sq] = { ...(kind === 'capture' ? DEST_CAPTURE_STYLE : DEST_EMPTY_STYLE) }
      }
    }
    if (squareStyles) {
      for (const [sq, s] of Object.entries(squareStyles)) {
        out[sq] = { ...out[sq], ...s }
      }
    }
    return out
  }, [selected, legalTargets, squareStyles, tapEnabled])

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
          squareStyles: mergedStyles,
          arrows,
          darkSquareStyle: { backgroundColor: colors.dark },
          lightSquareStyle: { backgroundColor: colors.light },
          onPieceDrop: onPieceDrop
            ? (args) => {
                // A successful drop clears any prior selection.
                const accepted = onPieceDrop(args)
                if (accepted) setSelected(null)
                return accepted
              }
            : undefined,
          onSquareClick: handleSquareClick,
          id,
        }}
      />
      {overlay}
    </div>
  )
}
