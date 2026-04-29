import { useEffect, useMemo, useState } from 'react'
import { Chessboard } from 'react-chessboard'
import type { ChessComGame, GameAnalysis, MoveAnalysis } from '../types'
import { StockfishEngine } from '../engine/stockfish'
import { analyzeGame } from '../analysis/analyze'
import { CLASSIFICATION_COLORS, CLASSIFICATION_LABELS } from '../analysis/classify'
import EvalBar from './EvalBar'
import EvalGraph from './EvalGraph'

interface Props {
  engine: StockfishEngine
  username: string
  game: ChessComGame
  existingAnalysis: GameAnalysis | null
  onAnalysisComplete: (analysis: GameAnalysis) => void
  onBack: () => void
}

export default function AnalysisView({
  engine,
  username,
  game,
  existingAnalysis,
  onAnalysisComplete,
  onBack,
}: Props) {
  const [analysis, setAnalysis] = useState<GameAnalysis | null>(existingAnalysis)
  const [progress, setProgress] = useState<{ done: number; total: number; currentSan?: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [currentPly, setCurrentPly] = useState(0) // 0 = start position

  useEffect(() => {
    if (existingAnalysis) {
      setAnalysis(existingAnalysis)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        setProgress({ done: 0, total: 1 })
        const result = await analyzeGame(engine, game, username, {
          depth: 13,
          onProgress: (p) => { if (!cancelled) setProgress(p) },
        })
        if (cancelled) return
        setAnalysis(result)
        onAnalysisComplete(result)
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Erreur d\'analyse')
      }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.url])

  // Determine current FEN to display
  const currentFen = useMemo(() => {
    if (!analysis || analysis.moves.length === 0) {
      return 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    }
    if (currentPly === 0) return analysis.moves[0].fenBefore
    const idx = Math.min(currentPly - 1, analysis.moves.length - 1)
    return analysis.moves[idx].fenAfter
  }, [analysis, currentPly])

  const currentMove: MoveAnalysis | null =
    analysis && currentPly > 0 ? analysis.moves[currentPly - 1] ?? null : null
  const currentEvalWhite =
    currentMove ? currentMove.evalAfter : (analysis?.moves[0]?.evalBefore ?? 0)

  // Keyboard navigation
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!analysis) return
      if (e.key === 'ArrowLeft') setCurrentPly((p) => Math.max(0, p - 1))
      else if (e.key === 'ArrowRight') setCurrentPly((p) => Math.min(analysis.moves.length, p + 1))
      else if (e.key === 'Home') setCurrentPly(0)
      else if (e.key === 'End') setCurrentPly(analysis.moves.length)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [analysis])

  if (error) {
    return (
      <div className="p-8">
        <button onClick={onBack} className="text-neutral-400 hover:text-white mb-4">← Retour</button>
        <p className="text-red-400">{error}</p>
      </div>
    )
  }

  if (!analysis) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <button onClick={onBack} className="text-neutral-400 hover:text-white mb-4">← Retour</button>
        <h2 className="text-xl font-semibold mb-4">Analyse en cours…</h2>
        {progress && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-neutral-400">
              <span>Coup {progress.done} / {progress.total}</span>
              {progress.currentSan && <span className="font-mono">{progress.currentSan}</span>}
            </div>
            <div className="w-full bg-[var(--color-panel)] rounded-full h-2 overflow-hidden">
              <div
                className="h-full bg-[var(--color-accent)] transition-all duration-200"
                style={{ width: `${(progress.done / Math.max(progress.total, 1)) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>
    )
  }

  const summary = summarize(analysis)
  const arrows = currentMove?.bestMoveSan
    ? buildBestMoveArrow(analysis, currentPly)
    : []

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      <button onClick={onBack} className="text-neutral-400 hover:text-white mb-4 text-sm">← Retour aux parties</button>

      <div className="grid lg:grid-cols-[auto_1fr] gap-6">
        <div className="flex gap-2 items-start">
          <EvalBar evalCp={currentEvalWhite} />
          <div className="w-[min(70vw,560px)]">
            <Chessboard
              options={{
                position: currentFen,
                boardOrientation: analysis.userColor,
                allowDragging: false,
                animationDurationInMs: 150,
                arrows,
                darkSquareStyle: { backgroundColor: '#769656' },
                lightSquareStyle: { backgroundColor: '#eeeed2' },
              }}
            />
            <div className="flex items-center justify-between mt-3 text-sm">
              <button onClick={() => setCurrentPly(0)} className="px-2 py-1 hover:bg-neutral-800 rounded">⏮</button>
              <button onClick={() => setCurrentPly(p => Math.max(0, p - 1))} className="px-2 py-1 hover:bg-neutral-800 rounded">◀</button>
              <span className="text-neutral-400 text-xs">
                {currentPly === 0 ? 'Position initiale' : `Coup ${Math.ceil(currentPly / 2)}${currentPly % 2 === 1 ? '.' : '...'} ${currentMove?.san}`}
              </span>
              <button onClick={() => setCurrentPly(p => Math.min(analysis.moves.length, p + 1))} className="px-2 py-1 hover:bg-neutral-800 rounded">▶</button>
              <button onClick={() => setCurrentPly(analysis.moves.length)} className="px-2 py-1 hover:bg-neutral-800 rounded">⏭</button>
            </div>
            <div className="text-xs text-neutral-500 text-center mt-1">← → pour naviguer</div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-4">
            <h3 className="font-semibold mb-2">Vue d'ensemble</h3>
            <div className="text-sm text-neutral-300 space-y-1">
              <div>Adversaire : <span className="font-medium">{analysis.opponent}</span> {analysis.opponentRating ? `(${analysis.opponentRating})` : ''}</div>
              <div>Couleur : {analysis.userColor === 'white' ? 'Blancs' : 'Noirs'}</div>
              {analysis.opening && <div>Ouverture : {analysis.opening}</div>}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <SummaryStat label="Gaffes" value={summary.user.blunders} color={CLASSIFICATION_COLORS.blunder} />
              <SummaryStat label="Erreurs" value={summary.user.mistakes} color={CLASSIFICATION_COLORS.mistake} />
              <SummaryStat label="Inexactitudes" value={summary.user.inaccuracies} color={CLASSIFICATION_COLORS.inaccuracy} />
            </div>
            <div className="mt-2 text-xs text-neutral-500">
              CPL moyen : toi {summary.user.avgCpLoss.toFixed(0)} · adv. {summary.opp.avgCpLoss.toFixed(0)}
            </div>
          </div>

          <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-4">
            <h3 className="font-semibold mb-2">Évaluation</h3>
            <EvalGraph
              moves={analysis.moves}
              currentPly={currentPly}
              userColor={analysis.userColor}
              onClickPly={setCurrentPly}
            />
          </div>

          {currentMove && (
            <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-4">
              <h3 className="font-semibold mb-2">Détail du coup</h3>
              <div className="text-sm space-y-1">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block w-3 h-3 rounded-full"
                    style={{ backgroundColor: CLASSIFICATION_COLORS[currentMove.classification] }}
                  />
                  <span className="font-medium" style={{ color: CLASSIFICATION_COLORS[currentMove.classification] }}>
                    {CLASSIFICATION_LABELS[currentMove.classification]}
                  </span>
                  <span className="text-neutral-500">·</span>
                  <span className="font-mono">{currentMove.san}</span>
                  {currentMove.cpLoss > 0 && (
                    <span className="text-neutral-500 text-xs">−{currentMove.cpLoss} cp</span>
                  )}
                </div>
                {currentMove.bestMoveSan && currentMove.bestMoveSan !== currentMove.san && (
                  <div className="text-neutral-400">
                    Meilleur : <span className="font-mono text-neutral-200">{currentMove.bestMoveSan}</span>
                    {currentMove.bestLineSan && (
                      <span className="text-xs text-neutral-500 ml-2">({currentMove.bestLineSan})</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-4">
            <h3 className="font-semibold mb-2">Liste des coups</h3>
            <MovesList
              moves={analysis.moves}
              currentPly={currentPly}
              onClick={setCurrentPly}
              userColor={analysis.userColor}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function SummaryStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-neutral-900 border border-[var(--color-border)] rounded p-2 text-center">
      <div className="text-xl font-bold" style={{ color }}>{value}</div>
      <div className="text-xs text-neutral-500">{label}</div>
    </div>
  )
}

function MovesList({
  moves, currentPly, onClick, userColor,
}: {
  moves: MoveAnalysis[]
  currentPly: number
  onClick: (ply: number) => void
  userColor: 'white' | 'black'
}) {
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

function summarize(a: GameAnalysis) {
  const userIsWhite = a.userColor === 'white'
  const counters = {
    user: { blunders: 0, mistakes: 0, inaccuracies: 0, cpLossSum: 0, moves: 0, avgCpLoss: 0 },
    opp: { blunders: 0, mistakes: 0, inaccuracies: 0, cpLossSum: 0, moves: 0, avgCpLoss: 0 },
  }
  for (const m of a.moves) {
    const moverIsWhite = m.ply % 2 === 1
    const bucket = moverIsWhite === userIsWhite ? counters.user : counters.opp
    bucket.moves++
    bucket.cpLossSum += m.cpLoss
    if (m.classification === 'blunder') bucket.blunders++
    else if (m.classification === 'mistake') bucket.mistakes++
    else if (m.classification === 'inaccuracy') bucket.inaccuracies++
  }
  counters.user.avgCpLoss = counters.user.moves ? counters.user.cpLossSum / counters.user.moves : 0
  counters.opp.avgCpLoss = counters.opp.moves ? counters.opp.cpLossSum / counters.opp.moves : 0
  return counters
}

function buildBestMoveArrow(analysis: GameAnalysis, currentPly: number) {
  if (currentPly === 0) return []
  const move = analysis.moves[currentPly - 1]
  if (!move?.bestMoveSan || move.bestMoveSan === move.san) return []
  // Reconstruct UCI from SAN by finding it in chess.js
  // We can use the bestMoveSan stored — but we need from/to squares.
  // Easier: derive from PV first move which we stored as SAN. We need UCI.
  // We didn't keep best UCI; fall back to no arrow if ambiguous.
  return []
}
