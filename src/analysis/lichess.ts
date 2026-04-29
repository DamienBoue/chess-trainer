import type { Exercise } from './exercises'
import { CATEGORY_LABELS } from './exercises'
import type { ExerciseProgress } from '../storage/persist'

// Build a multi-game PGN. Lichess studies accept PGN with multiple games separated
// by blank lines; each game becomes a chapter starting from the puzzle's FEN, with
// the engine's best line as the chapter's main line.
export function exportExercisesToPgn(
  exercises: Exercise[],
  progress: Record<string, ExerciseProgress>,
): string {
  return exercises.map((e, i) => exerciseToPgn(e, i + 1, progress[e.id])).join('\n\n')
}

function exerciseToPgn(e: Exercise, chapterNum: number, p: ExerciseProgress | undefined): string {
  const date = new Date(e.context.endTime).toISOString().slice(0, 10).replace(/-/g, '.')

  const headers = [
    `[Event "Chess Trainer — ${CATEGORY_LABELS[e.category]}"]`,
    `[Site "${e.context.gameUrl}"]`,
    `[Date "${date}"]`,
    `[Round "${chapterNum}"]`,
    `[White "${e.userColor === 'white' ? 'Toi' : e.context.opponent}"]`,
    `[Black "${e.userColor === 'black' ? 'Toi' : e.context.opponent}"]`,
    `[Result "*"]`,
    `[FEN "${e.fen}"]`,
    `[SetUp "1"]`,
    `[Annotator "Chess Trainer + Stockfish"]`,
  ].join('\n')

  const intro = `{ ${CATEGORY_LABELS[e.category]}. Joué dans la partie : ${e.playedMoveSan}. Meilleur : ${e.bestMoveSan}.${
    e.category === 'missed' ? ` Perte de ${e.cpSwing} cp.` : ''
  }${p ? ` (Tentatives : ${p.attempts}, réussites : ${p.successes})` : ''} }`

  // Render best line (or just the best move) starting from the puzzle's ply.
  const sansRaw = (e.bestLineSan ?? e.bestMoveSan).split(/\s+/).filter(Boolean)
  const tokens: string[] = []
  let ply = e.context.ply
  sansRaw.forEach((san, i) => {
    const moveNum = Math.ceil(ply / 2)
    if (ply % 2 === 1) {
      // White move
      tokens.push(`${moveNum}.${i === 0 ? ' ' : ''}${san}${i === 0 ? '!' : ''}`)
    } else if (i === 0) {
      // Black move and it's the first move of the line: prefix with "N..."
      tokens.push(`${moveNum}... ${san}!`)
    } else {
      tokens.push(san)
    }
    ply++
  })

  return `${headers}\n\n${intro} ${tokens.join(' ')} *`
}

export function downloadPgn(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'application/x-chess-pgn' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
