// Move list panel for AnalysisView: compact inline flow ("1. e4 c5 2. Nf3")
// with Lichess-style annotation glyphs (?! ? ??) coloured by classification.
// The player's own moves are fully coloured, the opponent's dimmed. The
// active move is kept in view while navigating with the keyboard.

import { useEffect, useRef } from 'react'
import type { MoveAnalysis } from '../types'
import { CLASSIFICATION_COLORS, CLASSIFICATION_GLYPHS, CLASSIFICATION_LABELS } from '../analysis/classify'

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
  const containerRef = useRef<HTMLDivElement>(null)
  // Keep the active move visible by scrolling the list itself only —
  // scrollIntoView would also scroll the page and push the board away.
  useEffect(() => {
    const box = containerRef.current
    const el = box?.querySelector<HTMLElement>('[data-active="true"]')
    if (!box || !el) return
    const top = el.offsetTop
    const bottom = top + el.offsetHeight
    if (top < box.scrollTop) box.scrollTop = top
    else if (bottom > box.scrollTop + box.clientHeight) box.scrollTop = bottom - box.clientHeight
  }, [currentPly])

  return (
    <div ref={containerRef} className="relative max-h-48 lg:max-h-56 overflow-auto text-sm font-mono pr-1 flex flex-wrap content-start gap-x-0.5 gap-y-0.5">
      {rows.map((r) => (
        <span key={r.num} className="inline-flex items-baseline">
          <span className="text-neutral-500 pl-1.5 pr-0.5 leading-6">{r.num}.</span>
          {!r.white && <span className="text-neutral-500 px-1 leading-6">…</span>}
          {r.white && <MoveCell move={r.white} active={currentPly === r.white.ply} onClick={() => onClick(r.white!.ply)} userColor={userColor} />}
          {r.black && <MoveCell move={r.black} active={currentPly === r.black.ply} onClick={() => onClick(r.black!.ply)} userColor={userColor} />}
        </span>
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
  const glyph = CLASSIFICATION_GLYPHS[move.classification]
  return (
    <button
      onClick={onClick}
      data-active={active}
      title={glyph ? `${CLASSIFICATION_LABELS[move.classification]}${isUser ? '' : ' (adversaire)'}` : undefined}
      className={`text-left px-1 rounded leading-6 ${active ? 'bg-[var(--color-accent)] text-white' : 'hover:bg-neutral-800'}`}
    >
      <span>{move.san}</span>
      {glyph && (
        <span
          className="ml-0.5 font-bold"
          style={{ color: active ? 'white' : CLASSIFICATION_COLORS[move.classification], opacity: isUser || active ? 1 : 0.55 }}
        >{glyph}</span>
      )}
    </button>
  )
}
