import { useMemo } from 'react'
import type { GameAnalysis } from '../types'

interface Props {
  analyses: GameAnalysis[]
}

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1']

// Heatmap of squares where the user's mistakes/blunders happened — based on
// the destination square of the played wrong move, viewed from the user's
// perspective so a1 is always bottom-left of the user's pieces.
export default function BlunderHeatmap({ analyses }: Props) {
  const { counts, max } = useMemo(() => {
    // Aggregate: counts['e4'] = number of user mistakes/blunders going there.
    const counts: Record<string, number> = {}
    for (const game of analyses) {
      const userIsWhite = game.userColor === 'white'
      for (const mv of game.moves) {
        const moverIsWhite = mv.ply % 2 === 1
        if (moverIsWhite !== userIsWhite) continue
        if (mv.classification !== 'mistake' && mv.classification !== 'blunder') continue
        const sq = destSquareFromSan(mv.san)
        if (!sq) continue
        const flipped = userIsWhite ? sq : flipSquare(sq)
        counts[flipped] = (counts[flipped] ?? 0) + 1
      }
    }
    const max = Math.max(0, ...Object.values(counts))
    return { counts, max }
  }, [analyses])

  if (max === 0) return null

  return (
    <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-4">
      <h3 className="font-semibold mb-3">Heatmap des erreurs</h3>
      <p className="text-xs text-neutral-500 mb-3">
        Cases d'arrivée des coups classés erreur ou gaffe (vues depuis ta couleur, donc a1 toujours en bas à gauche pour toi).
      </p>
      <div className="inline-grid grid-cols-[auto_repeat(8,minmax(0,1fr))] gap-px bg-[var(--color-border)] p-px rounded text-xs">
        <div />
        {FILES.map(f => <div key={f} className="text-center text-neutral-500 py-1">{f}</div>)}
        {RANKS.map(rank => (
          <Row key={rank} rank={rank} counts={counts} max={max} />
        ))}
      </div>
      <div className="text-xs text-neutral-500 mt-3">
        {max} erreur{max > 1 ? 's' : ''} max sur une seule case.
      </div>
    </div>
  )
}

function Row({ rank, counts, max }: { rank: string; counts: Record<string, number>; max: number }) {
  return (
    <>
      <div className="text-neutral-500 px-1 self-center">{rank}</div>
      {FILES.map(f => {
        const sq = `${f}${rank}`
        const n = counts[sq] ?? 0
        const intensity = max ? n / max : 0
        const bg = intensity === 0
          ? 'rgba(118, 150, 86, 0.15)'
          : `rgba(208, 74, 74, ${0.15 + intensity * 0.75})`
        return (
          <div
            key={sq}
            className="aspect-square flex items-center justify-center text-[10px] font-mono"
            style={{ backgroundColor: bg, color: intensity > 0.5 ? '#fff' : '#999', minWidth: 28, minHeight: 28 }}
            title={`${sq}: ${n}`}
          >
            {n > 0 ? n : ''}
          </div>
        )
      })}
    </>
  )
}

function destSquareFromSan(san: string): string | null {
  // Strip annotations, then take the last 2 chars matching a square.
  const cleaned = san.replace(/[+#!?]+$/, '')
  // Castling
  if (cleaned === 'O-O' || cleaned === '0-0') return null
  if (cleaned === 'O-O-O' || cleaned === '0-0-0') return null
  // Promotion: e8=Q. Square is before '='.
  const promo = cleaned.match(/([a-h][1-8])=[QRBN]/)
  if (promo) return promo[1]
  // Find the last [a-h][1-8] match.
  const matches = cleaned.match(/[a-h][1-8]/g)
  return matches ? matches[matches.length - 1] : null
}

function flipSquare(sq: string): string {
  const f = sq[0]
  const r = parseInt(sq[1], 10)
  return f + (9 - r).toString()
}
