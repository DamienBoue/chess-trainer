import { useEffect, useMemo, useState } from 'react'
import { Chess } from 'chess.js'
import TrainingBoard from './TrainingBoard'
import type { ChessComGame, GameAnalysis, MoveAnalysis } from '../types'
import { StockfishEngine } from '../engine/stockfish'
import { analyzeGame } from '../analysis/analyze'
import { CLASSIFICATION_COLORS, CLASSIFICATION_LABELS } from '../analysis/classify'
import { generateGameSummary } from '../analysis/summary'
import { buildRepertoire } from '../analysis/repertoire'
import { fetchExplorer, type ExplorerResponse } from '../api/lichess'
import { explainBlunder, reviewGame } from '../coach/coach'
import LlmAskBox from './LlmAskBox'
import { exportAnnotatedPgn } from '../analysis/pgnExport'
import EvalBar from './EvalBar'
import EvalGraph from './EvalGraph'
import PositionNote from './PositionNote'

interface Props {
  engine: StockfishEngine
  username: string
  game: ChessComGame
  existingAnalysis: GameAnalysis | null
  allAnalyses: GameAnalysis[]
  onAnalysisComplete: (analysis: GameAnalysis) => void
  onBack: () => void
}

export default function AnalysisView({
  engine,
  username,
  game,
  existingAnalysis,
  allAnalyses,
  onAnalysisComplete,
  onBack,
}: Props) {
  const repertoireRoots = useMemo(() => buildRepertoire(allAnalyses), [allAnalyses])
  const [analysis, setAnalysis] = useState<GameAnalysis | null>(existingAnalysis)
  const [progress, setProgress] = useState<{ done: number; total: number; currentSan?: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [currentPly, setCurrentPly] = useState(0) // 0 = start position
  const [flipped, setFlipped] = useState(false)
  // When non-null, the board shows the engine's PV starting from the
  // current ply's fenBefore — pvStep is how many half-moves into the PV.
  const [pvStep, setPvStep] = useState<number | null>(null)

  // Reset PV preview whenever the user navigates to a different ply.
  useEffect(() => { setPvStep(null) }, [currentPly])

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
          depth: 12,
          movetimeMs: 600,
          onProgress: (p) => { if (!cancelled) setProgress(p) },
        })
        if (cancelled) return
        setAnalysis(result)
        onAnalysisComplete(result)
      } catch (err) {
        if (cancelled) return
        console.error('[analyze] failed:', err)
        setError(err instanceof Error ? err.message : 'Erreur d\'analyse')
      }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.url])

  // Determine current FEN to display
  const currentMove: MoveAnalysis | null =
    analysis && currentPly > 0 ? analysis.moves[currentPly - 1] ?? null : null
  const pvSans = useMemo(
    () => currentMove?.bestLineSan ? currentMove.bestLineSan.split(/\s+/).filter(Boolean) : [],
    [currentMove],
  )
  const currentFen = useMemo(() => {
    if (!analysis || analysis.moves.length === 0) {
      return 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    }
    // PV preview: start from current move's fenBefore and replay N PV moves.
    if (pvStep !== null && currentMove) {
      const c = new Chess(currentMove.fenBefore)
      for (let i = 0; i < pvStep && i < pvSans.length; i++) {
        try { c.move(pvSans[i]) } catch { break }
      }
      return c.fen()
    }
    if (currentPly === 0) return analysis.moves[0].fenBefore
    const idx = Math.min(currentPly - 1, analysis.moves.length - 1)
    return analysis.moves[idx].fenAfter
  }, [analysis, currentPly, pvStep, currentMove, pvSans])

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
      else if (e.key === 'f' || e.key === 'F') setFlipped(f => !f)
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
      <div className="flex items-center justify-between mb-4">
        <button onClick={onBack} className="text-neutral-400 hover:text-white text-sm">← Retour aux parties</button>
        <button
          onClick={() => {
            const pgn = exportAnnotatedPgn(analysis)
            const blob = new Blob([pgn], { type: 'application/x-chess-pgn' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `analysis-vs-${analysis.opponent}-${new Date(analysis.endTime * 1000).toISOString().slice(0, 10)}.pgn`
            document.body.appendChild(a); a.click(); a.remove()
            setTimeout(() => URL.revokeObjectURL(url), 1000)
          }}
          className="text-xs px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200"
          title="Exporter en PGN avec NAGs + commentaires moteur — compatible Lichess study"
        >📤 Export PGN annoté</button>
      </div>

      <div className="grid lg:grid-cols-[auto_1fr] gap-6">
        <div className="flex gap-2 items-start">
          <EvalBar evalCp={currentEvalWhite} />
          <div className="w-[min(70vw,560px)]">
            <TrainingBoard
              position={currentFen}
              orientation={flipped
                ? (analysis.userColor === 'white' ? 'black' : 'white')
                : analysis.userColor}
              allowDragging={false}
              animationDurationInMs={150}
              arrows={arrows}
            />
            <div className="flex items-center justify-between mt-3 text-sm">
              <button onClick={() => setCurrentPly(0)} className="px-2 py-1 hover:bg-neutral-800 rounded">⏮</button>
              <button onClick={() => setCurrentPly(p => Math.max(0, p - 1))} className="px-2 py-1 hover:bg-neutral-800 rounded">◀</button>
              <span className="text-neutral-400 text-xs">
                {currentPly === 0 ? 'Position initiale' : `Coup ${Math.ceil(currentPly / 2)}${currentPly % 2 === 1 ? '.' : '...'} ${currentMove?.san}`}
              </span>
              <button onClick={() => setCurrentPly(p => Math.min(analysis.moves.length, p + 1))} className="px-2 py-1 hover:bg-neutral-800 rounded">▶</button>
              <button onClick={() => setCurrentPly(analysis.moves.length)} className="px-2 py-1 hover:bg-neutral-800 rounded">⏭</button>
              <button onClick={() => setFlipped(f => !f)} className="px-2 py-1 hover:bg-neutral-800 rounded ml-2" title="Retourner l'échiquier (F)">⇅</button>
            </div>
            <div className="text-xs text-neutral-500 text-center mt-1">← → naviguer · F retourner</div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-4">
            <h3 className="font-semibold mb-2">Résumé</h3>
            <p className="text-sm text-neutral-300 leading-relaxed">{generateGameSummary(analysis, repertoireRoots)}</p>
            <div className="mt-3 pt-3 border-t border-[var(--color-border)]">
              <LlmAskBox
                ctaLabel="✨ Revue complète de la partie (IA)"
                hint="L'IA pointe la phase où tu as souffert, le moment charnière, et un axe d'entraînement."
                resetKey={analysis.url}
                run={signal => reviewGame(analysis, { signal })}
              />
            </div>
          </div>

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

          <ExplorerSection fen={currentFen} currentSan={currentMove?.san} />

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
                  </div>
                )}
              </div>

              {(currentMove.classification === 'blunder' || currentMove.classification === 'mistake') && (
                <CoachExplain analysis={analysis} move={currentMove} />
              )}

              <div className="mt-3 pt-3 border-t border-[var(--color-border)]">
                <PositionNote fen={currentFen} />
              </div>

              {pvSans.length > 0 && currentMove.bestMoveSan && currentMove.bestMoveSan !== currentMove.san && (
                <div className="mt-3 pt-3 border-t border-[var(--color-border)]">
                  <div className="flex items-baseline justify-between mb-1.5">
                    <span className="text-xs uppercase tracking-wider text-neutral-500">Ligne du moteur</span>
                    {pvStep !== null && (
                      <button
                        onClick={() => setPvStep(null)}
                        className="text-xs text-neutral-400 hover:text-white underline"
                      >← Retour à la partie</button>
                    )}
                  </div>
                  <PvLine
                    sans={pvSans}
                    currentMoveStartsWhite={currentMove.ply % 2 === 1}
                    activeStep={pvStep}
                    onStep={setPvStep}
                  />
                  <p className="text-[11px] text-neutral-500 mt-1.5">
                    Clique un coup pour voir la position correspondante. {pvStep !== null && '(Aperçu — pas la vraie partie.)'}
                  </p>
                </div>
              )}
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

// "Explain in plain French" — only renders when an LLM is configured.
function CoachExplain({ analysis, move }: { analysis: GameAnalysis; move: MoveAnalysis }) {
  return (
    <div className="mt-3 pt-3 border-t border-[var(--color-border)]">
      <LlmAskBox
        ctaLabel="✨ Expliquer ce coup (IA)"
        resetKey={`${analysis.url}#${move.ply}`}
        run={signal => explainBlunder(analysis, move, { signal })}
        fallback={
          <div className="text-xs text-neutral-500">
            Active une clé LLM dans Préférences pour expliquer ce coup en langage naturel.
          </div>
        }
      />
    </div>
  )
}

// Clickable principal-variation line. Each chip steps the board to the
// position after that PV move. White's plies look like "1. e4", black's
// like "1...c5" — matches the conventional notation readers expect.
function PvLine({
  sans, currentMoveStartsWhite, activeStep, onStep,
}: {
  sans: string[]
  currentMoveStartsWhite: boolean
  activeStep: number | null
  onStep: (step: number | null) => void
}) {
  // The PV runs from the current move's fenBefore. If the side to move at
  // that point is white, PV[0] is a white move; otherwise it's black's.
  return (
    <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-1 text-sm font-mono">
      {sans.map((san, i) => {
        const step = i + 1
        const isWhitePly = currentMoveStartsWhite ? (i % 2 === 0) : (i % 2 === 1)
        const fullMoveNum = currentMoveStartsWhite
          ? Math.floor(i / 2) + 1 + (i > 0 && i % 2 === 0 ? 0 : 0)
          : Math.floor((i + 1) / 2) + 1
        const showNumber = isWhitePly || i === 0
        const active = activeStep === step
        return (
          <span key={i} className="inline-flex items-baseline">
            {showNumber && (
              <span className="text-neutral-500 mr-0.5">
                {fullMoveNum}{isWhitePly ? '.' : '…'}
              </span>
            )}
            <button
              onClick={() => onStep(active ? null : step)}
              className={`px-1.5 py-0.5 rounded transition-colors ${
                active
                  ? 'bg-[var(--color-accent)] text-white'
                  : 'text-neutral-200 hover:bg-neutral-800'
              }`}
            >{san}</button>
          </span>
        )
      })}
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

// Lichess opening explorer for the currently-displayed position. Tries the
// community DB first; the API can be rate-limited or auth-restricted, so we
// silently hide the section when unreachable.
function ExplorerSection({ fen, currentSan }: { fen: string; currentSan?: string }) {
  const [data, setData] = useState<ExplorerResponse | null>(null)
  const [source, setSource] = useState<'lichess' | 'masters'>('lichess')
  const [unavailable, setUnavailable] = useState(false)

  useEffect(() => {
    let aborted = false
    const ctrl = new AbortController()
    setUnavailable(false)
    setData(null)
    fetchExplorer({
      source,
      fen,
      speeds: ['blitz', 'rapid', 'classical'],
      ratings: [1600, 1800, 2000, 2200, 2500],
      moves: 8,
    }, ctrl.signal).then(r => {
      if (aborted) return
      if (!r) { setUnavailable(true); return }
      setData(r)
    })
    return () => { aborted = true; ctrl.abort() }
  }, [fen, source])

  if (unavailable && !data) return null     // hide gracefully
  if (!data) {
    return (
      <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-4 text-sm text-neutral-500">
        Chargement de l'explorateur d'ouvertures…
      </div>
    )
  }
  const total = data.white + data.draws + data.black
  return (
    <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-4">
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <h3 className="font-semibold">Explorateur d'ouvertures</h3>
        <div className="inline-flex rounded-md border border-[var(--color-border)] bg-neutral-900 p-0.5 text-xs">
          <button
            onClick={() => setSource('lichess')}
            className={`px-2 py-1 rounded ${source === 'lichess' ? 'bg-[var(--color-accent)] text-white' : 'text-neutral-300 hover:bg-neutral-800'}`}
          >Community</button>
          <button
            onClick={() => setSource('masters')}
            className={`px-2 py-1 rounded ${source === 'masters' ? 'bg-[var(--color-accent)] text-white' : 'text-neutral-300 hover:bg-neutral-800'}`}
          >Masters</button>
        </div>
      </div>
      {data.opening?.name && (
        <p className="text-xs text-neutral-400 mb-2">{data.opening.eco} · {data.opening.name}</p>
      )}
      <div className="text-xs text-neutral-500 mb-2">{total.toLocaleString()} parties à cette position</div>
      {data.moves.length === 0 ? (
        <p className="text-sm text-neutral-500">Position hors livre — plus de coups répertoriés.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-neutral-500 text-xs">
            <tr>
              <th className="text-left font-normal pb-1">Coup</th>
              <th className="text-right font-normal">Parties</th>
              <th className="text-right font-normal">B / N / =</th>
            </tr>
          </thead>
          <tbody>
            {data.moves.slice(0, 6).map(m => {
              const moveTotal = m.white + m.draws + m.black
              const freq = total > 0 ? moveTotal / total : 0
              const w = moveTotal > 0 ? m.white / moveTotal : 0
              const d = moveTotal > 0 ? m.draws / moveTotal : 0
              const l = moveTotal > 0 ? m.black / moveTotal : 0
              const matchesPlayed = currentSan && currentSan.replace(/[!?+#]+$/, '') === m.san.replace(/[!?+#]+$/, '')
              return (
                <tr key={m.uci} className={`border-t border-[var(--color-border)]/40 ${matchesPlayed ? 'bg-[var(--color-accent)]/10' : ''}`}>
                  <td className="py-1 font-mono">
                    {m.san}
                    {matchesPlayed && <span className="ml-2 text-xs text-[var(--color-accent)]">← joué</span>}
                    <span className="text-neutral-600 ml-2 text-xs">{(freq * 100).toFixed(0)}%</span>
                  </td>
                  <td className="py-1 text-right text-neutral-400 font-mono text-xs">{moveTotal.toLocaleString()}</td>
                  <td className="py-1 text-right text-xs">
                    <span className="text-neutral-100">{(w * 100).toFixed(0)}</span>
                    <span className="text-neutral-500"> / </span>
                    <span className="text-neutral-100">{(l * 100).toFixed(0)}</span>
                    <span className="text-neutral-500"> / </span>
                    <span className="text-neutral-500">{(d * 100).toFixed(0)}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
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
