// Modal that opens a position for interactive exploration.
//
// Use cases:
//   - Tap on a recurring mistake to "feel" the position big and play out
//     both the move you played and the engine's preferred line.
//   - Any other context where we want a quick "look at this FEN" view
//     without leaving the current screen.

import { useEffect, useMemo, useRef, useState } from 'react'
import { Chess } from 'chess.js'
import TrainingBoard from './TrainingBoard'
import { playForMove } from '../audio/sounds'

export interface PositionExplorerProps {
  /** Position to open at. Must include side to move. */
  fen: string
  /** Closes the modal. */
  onClose: () => void
  /** Optional context: the SAN the user played originally, shown in red. */
  playedSan?: string
  /** Optional context: the SAN the engine recommended, shown in green. */
  bestSan?: string
  /** Optional title shown in the header (e.g. "vs Carlsen 2026-04"). */
  title?: string
}

export default function PositionExplorer({
  fen, onClose, playedSan, bestSan, title,
}: PositionExplorerProps) {
  const initial = useMemo(() => fen, [fen])
  const chess = useRef<Chess>(new Chess(initial))
  const [position, setPosition] = useState(initial)
  const [moveLog, setMoveLog] = useState<string[]>([])

  // Reset whenever the FEN changes (different mistake clicked).
  useEffect(() => {
    chess.current = new Chess(initial)
    setPosition(initial)
    setMoveLog([])
  }, [initial])

  // Close on Esc.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const sideToMove = position.split(' ')[1] === 'b' ? 'black' : 'white'

  function onPieceDrop({ sourceSquare, targetSquare, piece }: {
    sourceSquare: string; targetSquare: string | null; piece: { pieceType: string }
  }): boolean {
    if (!targetSquare) return false
    const c = chess.current
    const promotion = piece.pieceType.endsWith('P') &&
      (targetSquare[1] === '1' || targetSquare[1] === '8') ? 'q' : undefined
    let mv
    try { mv = c.move({ from: sourceSquare, to: targetSquare, promotion }) } catch { return false }
    if (!mv) return false
    setPosition(c.fen())
    setMoveLog(log => [...log, mv.san])
    playForMove(mv.flags)
    return true
  }

  function reset() {
    chess.current = new Chess(initial)
    setPosition(initial)
    setMoveLog([])
  }

  function playSan(san: string) {
    // Replay from the initial position so we always show the move FROM the
    // mistake context, even if the user already dragged pieces around.
    chess.current = new Chess(initial)
    let mv
    try { mv = chess.current.move(san) } catch { return }
    if (!mv) return
    setPosition(chess.current.fen())
    setMoveLog([mv.san])
    playForMove(mv.flags)
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
      onClick={onClose}
    >
      <div
        className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-lg shadow-2xl w-full max-w-3xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-5 py-3 border-b border-[var(--color-border)] flex items-center justify-between gap-3">
          <h2 className="font-semibold text-sm truncate">{title ?? 'Explorer la position'}</h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-white text-xl leading-none px-2" aria-label="Fermer">×</button>
        </div>

        <div className="grid md:grid-cols-[1fr_220px] gap-4 p-4">
          <TrainingBoard
            position={position}
            orientation={sideToMove}
            allowDragging={true}
            onPieceDrop={onPieceDrop}
            maxWidth={520}
          />

          <aside className="space-y-3 text-sm">
            <div className="text-xs text-neutral-500">
              Trait aux {sideToMove === 'white' ? 'Blancs' : 'Noirs'}
            </div>

            {(playedSan || bestSan) && (
              <div className="space-y-1.5">
                {bestSan && (
                  <button
                    onClick={() => playSan(bestSan)}
                    className="w-full text-left px-3 py-2 rounded bg-green-900/30 border border-green-700/50 hover:bg-green-900/50 text-green-200"
                  >
                    <div className="text-[10px] uppercase tracking-wider opacity-70">Recommandé</div>
                    <div className="font-mono">{bestSan}</div>
                  </button>
                )}
                {playedSan && playedSan !== bestSan && (
                  <button
                    onClick={() => playSan(playedSan)}
                    className="w-full text-left px-3 py-2 rounded bg-red-900/30 border border-red-700/50 hover:bg-red-900/50 text-red-200"
                  >
                    <div className="text-[10px] uppercase tracking-wider opacity-70">Ce que tu as joué</div>
                    <div className="font-mono">{playedSan}</div>
                  </button>
                )}
              </div>
            )}

            <button
              onClick={reset}
              className="w-full px-3 py-1.5 rounded text-sm bg-neutral-800 hover:bg-neutral-700"
            >
              ↺ Position initiale
            </button>

            {moveLog.length > 0 && (
              <div className="text-xs">
                <div className="text-neutral-500 mb-1">Coups joués</div>
                <div className="font-mono text-neutral-200 break-words">{moveLog.join(' ')}</div>
              </div>
            )}

            <p className="text-[10px] text-neutral-500">
              Tu peux glisser les pièces librement pour explorer la suite. Esc pour fermer.
            </p>
          </aside>
        </div>
      </div>
    </div>
  )
}
