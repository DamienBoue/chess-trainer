// Move list panel for AnalysisView: two-column (white / black) rows
// with a classification dot on user-side mistakes. Extracted to keep
// AnalysisView lean.

import type { MoveAnalysis } from '../types'
import { CLASSIFICATION_COLORS, CLASSIFICATION_LABELS } from '../analysis/classify'

interface Props {
  moves: MoveAnalysis[]
  currentPly: number
  onClick: (ply: number) => void
  userColor: 'white' | 'black'
}

export default function MovesList({ moves, currentPly, onClick, userColor }: Props) {
  const rows: { num: number; white?: MoveAnalysis; black?: MoveAnalysis }[] = []
  for (const m of moves) {
    const moveNum = Math.ceil(m.ply / 2)
    if (m.ply % 2 === 1) rows.push({ num: moveNum, white: m })
    else {
      const last = rows[rows.length - 1]
      if (last && last.num === moveNum) last.black = m
      else rows.push({ num: moveNum, black: m })
    }
  }
  return (
    <div className="max-h-96 overflow-auto text-sm font-mono">
      {rows.map((r) => (
        <div key={r.num} className="flex gap-2 py-0.5">
          <span className="text-neutral-500 w-8 text-right">{r.num}.</span>
          {r.white && <MoveCell move={r.white} active={currentPly === r.white.ply} onClick={() => onClick(r.white!.ply)} userColor={userColor} />}
          {r.black && <MoveCell move={r.black} active={currentPly === r.black.ply} onClick={() => onClick(r.black!.ply)} userColor={userColor} />}
        </div>
      ))}
    </div>
  )
}

function MoveCell({ move, active, onClick, userColor }: {
  move: MoveAnalysis
  active: boolean
  onClick: () => void
  userColor: 'white' | 'black'
}) {
  const moverIsWhite = move.ply % 2 === 1
  const isUser = (moverIsWhite && userColor === 'white') || (!moverIsWhite && userColor === 'black')
  const showBadge = isUser && (move.classification === 'blunder' || move.classification === 'mistake' || move.classification === 'inaccuracy')
  return (
    <button
      onClick={onClick}
      className={`flex-1 text-left px-2 py-0.5 rounded ${active ? 'bg-[var(--color-accent)] text-white' : 'hover:bg-neutral-800'}`}
    >
      <span>{move.san}</span>
      {showBadge && (
        <span
          className="ml-1 inline-block w-2 h-2 rounded-full"
          style={{ backgroundColor: CLASSIFICATION_COLORS[move.classification] }}
          title={CLASSIFICATION_LABELS[move.classification]}
        />
      )}
    </button>
  )
}
