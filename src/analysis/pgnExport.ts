// Render an analysed game as PGN with NAGs + side-comments. The output
// can be pasted directly into Lichess study / chessbase / scid /
// chess.com analysis — anywhere that accepts standard PGN.
//
// Mapping cpLoss → NAGs:
//   blunder        → ?? (4)
//   mistake        → ?  (2)
//   inaccuracy     → ?! (6)
//   best           → !  (1)  (only when it's also the engine's best AND
//                              cpLoss was already 0 — avoids noise)
//   great          → !? (5)
//   good / book    → no NAG
//
// Each non-best user move gets a side comment with the engine's best
// move + cpLoss, e.g.: { Nf3? was best (−214) }

import type { GameAnalysis } from '../types'

const NAG: Record<string, number> = {
  best:       1,    // !
  great:      5,    // !?
  inaccuracy: 6,    // ?!
  mistake:    2,    // ?
  blunder:    4,    // ??
}

function escapeComment(s: string): string {
  return s.replace(/[{}]/g, '')
}

function maybeNagAndComment(move: GameAnalysis['moves'][number]): string {
  const parts: string[] = []
  const nag = NAG[move.classification]
  if (nag) parts.push(`$${nag}`)

  // Comment for any user-visible quality deviation, plus mate flags.
  const interesting = ['inaccuracy', 'mistake', 'blunder'].includes(move.classification)
  if (interesting && move.bestMoveSan && move.bestMoveSan !== move.san) {
    const lossPawns = (move.cpLoss / 100).toFixed(2)
    const line = move.bestLineSan ? ` line: ${move.bestLineSan}` : ''
    parts.push(`{ best ${move.bestMoveSan} (-${lossPawns})${escapeComment(line)} }`)
  }
  return parts.length > 0 ? ' ' + parts.join(' ') : ''
}

/** Build a PGN text from an analysis. Preserves the original tag pairs
 *  if we can read them out of analysis.pgn, then re-emits the move list
 *  with classification NAGs and engine-best comments. */
export function exportAnnotatedPgn(analysis: GameAnalysis): string {
  const headerLines = (analysis.pgn.match(/^\[[^\]]+\]\s*$/gm) ?? []).slice()
  if (headerLines.length === 0) {
    // Synthesise minimal headers when the source PGN didn't have any.
    headerLines.push(
      `[Event "Chess Trainer review"]`,
      `[Date "${new Date(analysis.endTime * 1000).toISOString().slice(0, 10).replace(/-/g, '.')}"]`,
      `[White "${analysis.userColor === 'white' ? 'You' : analysis.opponent}"]`,
      `[Black "${analysis.userColor === 'black' ? 'You' : analysis.opponent}"]`,
      `[Result "${resultTag(analysis)}"]`,
    )
  }
  // Insert / replace an Annotator header.
  const annotatorIdx = headerLines.findIndex(l => l.startsWith('[Annotator '))
  const annotator = `[Annotator "Chess Trainer + Stockfish"]`
  if (annotatorIdx === -1) headerLines.push(annotator)
  else headerLines[annotatorIdx] = annotator

  const tokens: string[] = []
  for (const m of analysis.moves) {
    const moveNum = Math.ceil(m.ply / 2)
    const whiteMove = m.ply % 2 === 1
    if (whiteMove) tokens.push(`${moveNum}.`)
    else if (tokens.length === 0) tokens.push(`${moveNum}...`)
    tokens.push(m.san + maybeNagAndComment(m))
  }
  tokens.push(resultTag(analysis))

  return headerLines.join('\n') + '\n\n' + tokens.join(' ') + '\n'
}

function resultTag(a: GameAnalysis): string {
  if (a.result === 'draw') return '1/2-1/2'
  if (a.result === 'win')  return a.userColor === 'white' ? '1-0' : '0-1'
  return a.userColor === 'white' ? '0-1' : '1-0'
}
