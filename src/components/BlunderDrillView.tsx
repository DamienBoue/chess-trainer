import { useEffect, useMemo, useRef, useState } from 'react'
import { Chess } from 'chess.js'
import { Chessboard } from 'react-chessboard'
import type { Square } from 'chess.js'
import type { GameAnalysis } from '../types'
import { extractExercises } from '../analysis/exercises'
import { detectThreats, type Threat } from '../analysis/threats'
import { playSuccess, playWrong } from '../audio/sounds'

interface Props {
  analyses: GameAnalysis[]
  onExit: () => void
}

// Each position lifted from the user's blunders: we keep just what the drill
// needs (position + the opponent's last move highlight + the ground truth).
interface DrillPosition {
  id: string
  fen: string
  userColor: 'white' | 'black'
  opponentMoveFrom?: Square
  opponentMoveTo?: Square
  threats: Threat[]
  context: { opponent: string; ply: number; moveLabel: string }
}

interface AttemptResult {
  correct: boolean
  pickedSquare: Square | null
  expected: Threat[]
}

const DRILL_TIMEOUT_MS = 12000  // soft deadline per puzzle

function buildPool(analyses: GameAnalysis[]): DrillPosition[] {
  // Pull positions just before user blunders/mistakes from the existing
  // exercises pipeline. extractExercises already does the heavy lifting
  // (classification, motifs, dedup). We reuse the 'missed' category which
  // is exactly "user blunder, engine wanted something else".
  const exs = extractExercises(analyses, { minMissedCpLoss: 150, maxPerGame: 4 })
    .filter(e => e.category === 'missed')

  const out: DrillPosition[] = []
  for (const e of exs) {
    const userColor = e.userColor
    const threats = detectThreats(e.fen, userColor === 'white' ? 'w' : 'b')
    if (threats.length === 0) continue   // skip no-threat positions for now
    // Determine the opponent's last move from the analyses (the move at ply-1).
    const game = analyses.find(a => a.url === e.context.gameUrl)
    const oppMove = game?.moves[e.context.ply - 2]
    let from: Square | undefined, to: Square | undefined
    if (oppMove?.fenBefore && oppMove?.fenAfter) {
      // Re-derive from/to via chess.js by replaying.
      try {
        const b = new Chess(oppMove.fenBefore)
        const mv = b.move(oppMove.san)
        if (mv) { from = mv.from; to = mv.to }
      } catch { /* noop */ }
    }
    out.push({
      id: e.id,
      fen: e.fen,
      userColor,
      opponentMoveFrom: from,
      opponentMoveTo: to,
      threats,
      context: { opponent: e.context.opponent, ply: e.context.ply, moveLabel: e.context.moveLabel },
    })
  }
  // Shuffle for variety on each session.
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

export default function BlunderDrillView({ analyses, onExit }: Props) {
  const pool = useMemo(() => buildPool(analyses), [analyses])
  const [idx, setIdx] = useState(0)
  const [score, setScore] = useState(0)
  const [attempts, setAttempts] = useState(0)
  const [last, setLast] = useState<AttemptResult | null>(null)
  const [tick, setTick] = useState(DRILL_TIMEOUT_MS)
  const timerRef = useRef<number | null>(null)

  const current = pool[idx] ?? null

  // Per-puzzle countdown.
  useEffect(() => {
    if (!current || last) return
    setTick(DRILL_TIMEOUT_MS)
    const start = Date.now()
    const interval = window.setInterval(() => {
      const left = DRILL_TIMEOUT_MS - (Date.now() - start)
      if (left <= 0) {
        window.clearInterval(interval)
        // Time-out → register as a miss with no pick.
        recordAnswer(null)
      } else {
        setTick(left)
      }
    }, 100)
    timerRef.current = interval
    return () => { window.clearInterval(interval); timerRef.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id, last])

  function recordAnswer(picked: Square | null) {
    if (!current || last) return
    if (timerRef.current) { window.clearInterval(timerRef.current); timerRef.current = null }
    const expectedSquares = new Set(current.threats.map(t => t.square))
    // Correct if "no threat" picked AND there genuinely are none (we filter
    // those out at pool build time, so for current always treat null as wrong),
    // OR if user clicked one of the threatened squares.
    const correct = picked !== null && expectedSquares.has(picked)
    setAttempts(a => a + 1)
    if (correct) {
      setScore(s => s + 1)
      playSuccess()
    } else {
      playWrong()
    }
    setLast({ correct, pickedSquare: picked, expected: current.threats })
  }

  function next() {
    setLast(null)
    setIdx(i => i + 1)
  }

  if (pool.length === 0) {
    return (
      <div className="p-8 max-w-3xl mx-auto text-neutral-400">
        <button onClick={onExit} className="text-sm hover:text-white mb-4">← Retour</button>
        <p>Aucune position de blunder trouvée. Analyse plus de parties pour alimenter le drill.</p>
      </div>
    )
  }
  if (!current) {
    const accuracy = attempts > 0 ? (score / attempts) * 100 : 0
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <h2 className="text-2xl font-semibold mb-4">Session terminée</h2>
        <div className="grid grid-cols-3 gap-3 mb-6">
          <Stat label="Score" value={score} />
          <Stat label="Tentés" value={attempts} />
          <Stat label="Précision" value={`${accuracy.toFixed(0)}%`} />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setIdx(0); setScore(0); setAttempts(0); setLast(null) }}
            className="flex-1 px-4 py-2 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white rounded-md"
          >Rejouer</button>
          <button onClick={onExit} className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 rounded-md">
            Sortir
          </button>
        </div>
      </div>
    )
  }

  const squareStyles: Record<string, React.CSSProperties> = {}
  if (current.opponentMoveFrom) {
    squareStyles[current.opponentMoveFrom] = { backgroundColor: 'rgba(250, 200, 80, 0.45)' }
  }
  if (current.opponentMoveTo) {
    squareStyles[current.opponentMoveTo] = { backgroundColor: 'rgba(250, 200, 80, 0.65)' }
  }
  if (last) {
    for (const t of last.expected) {
      squareStyles[t.square] = { backgroundColor: 'rgba(95, 160, 82, 0.55)', outline: '2px solid rgba(95, 160, 82, 0.9)' }
    }
    if (last.pickedSquare && !last.expected.some(t => t.square === last.pickedSquare)) {
      squareStyles[last.pickedSquare] = { backgroundColor: 'rgba(208, 74, 74, 0.55)', outline: '2px solid rgba(208, 74, 74, 0.9)' }
    }
  }

  function onSquareClick({ square }: { square: string }) {
    if (last) return
    recordAnswer(square as Square)
  }

  const secondsLeft = Math.max(0, Math.ceil(tick / 1000))

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <button onClick={onExit} className="text-sm text-neutral-400 hover:text-white">← Sortir</button>
        <div className="flex items-center gap-3 text-sm">
          <span><span className="font-mono text-green-300">{score}</span> / {attempts}</span>
          <span className={`font-mono ${secondsLeft <= 3 ? 'text-red-400' : 'text-neutral-300'}`}>
            {secondsLeft}s
          </span>
        </div>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-4">
        <div className="w-[min(85vw,560px)] mx-auto">
          <Chessboard
            options={{
              position: current.fen,
              boardOrientation: current.userColor,
              allowDragging: false,
              squareStyles,
              darkSquareStyle: { backgroundColor: '#769656' },
              lightSquareStyle: { backgroundColor: '#eeeed2' },
              id: current.id,
              onSquareClick,
            }}
          />
        </div>

        <aside className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-4 space-y-3">
          <h3 className="font-semibold text-sm">Quelle est la menace ?</h3>
          <p className="text-xs text-neutral-400 leading-relaxed">
            Le coup adverse est surligné en orange. Clique la pièce de TON camp la plus en
            danger. Si tu penses qu'il n'y a aucune menace concrète, clique le bouton.
          </p>
          <button
            onClick={() => recordAnswer(null)}
            disabled={!!last}
            className="w-full px-3 py-2 text-sm rounded bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50"
          >Aucune menace</button>

          {last && (
            <div className={`p-3 rounded text-sm ${
              last.correct
                ? 'bg-green-900/30 border border-green-700/50 text-green-200'
                : 'bg-red-900/30 border border-red-700/50 text-red-200'
            }`}>
              <div className="font-bold mb-1">{last.correct ? '✓ Bien vu !' : '✗ Raté'}</div>
              <div className="text-xs">
                {last.expected.length > 0 && (
                  <>
                    Pièces en danger :{' '}
                    {last.expected.map(t => (
                      <span key={t.square} className="font-mono mr-2">
                        {t.square}{t.pieceType !== 'p' ? ` (${labelPiece(t.pieceType)})` : ''}
                      </span>
                    ))}
                  </>
                )}
                <div className="text-neutral-400 mt-1">
                  Contexte : {current.context.moveLabel} vs {current.context.opponent}
                </div>
              </div>
              <button
                onClick={next}
                className="mt-3 w-full px-3 py-1.5 text-sm rounded bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white"
              >Suivant ({idx + 2} / {pool.length})</button>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}

function labelPiece(t: 'p' | 'n' | 'b' | 'r' | 'q' | 'k'): string {
  return { p: 'pion', n: 'cavalier', b: 'fou', r: 'tour', q: 'dame', k: 'roi' }[t]
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-3 text-center">
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-neutral-500">{label}</div>
    </div>
  )
}
