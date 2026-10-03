import { useEffect, useMemo, useState } from 'react'
import { Chess } from 'chess.js'
import TrainingBoard from './TrainingBoard'
import type { ChessComGame, GameAnalysis, MoveAnalysis } from '../types'
import { StockfishEngine } from '../engine/stockfish'
import { analyzeGame } from '../analysis/analyze'
import { CLASSIFICATION_COLORS, CLASSIFICATION_GLYPHS, CLASSIFICATION_LABELS } from '../analysis/classify'
import { generateGameSummary } from '../analysis/summary'
import { buildRepertoire } from '../analysis/repertoire'
import { explainBlunder, reviewGame } from '../coach/coach'
import LlmAskBox from './LlmAskBox'
import { exportAnnotatedPgn } from '../analysis/pgnExport'
import EvalBar from './EvalBar'
import EvalGraph from './EvalGraph'
import PositionNote from './PositionNote'
import ExplorerSection from './ExplorerSection'
import MovesList from './MovesList'
import StrategyPanel from './StrategyPanel'
import GameStrategyCard, { MoveStrategyNotes } from './GameStrategyCard'
import { EMPTY_OVERLAY, OVERLAY_COLORS, type BoardOverlay } from './strategyBoard'
import { reviewOf } from './useStrategyReviews'
import { loadStrategyOverlays, saveStrategyOverlays } from '../storage/strategyPrefs'

interface Props {
  engine: StockfishEngine
  username: string
  game: ChessComGame
  existingAnalysis: GameAnalysis | null
  allAnalyses: GameAnalysis[]
  onAnalysisComplete: (analysis: GameAnalysis) => void
  onBack: () => void
  /** Open directly at this ply (deep link), on the strategic reading. */
  initialPly?: number
}

export default function AnalysisView({
  engine,
  username,
  game,
  existingAnalysis,
  allAnalyses,
  onAnalysisComplete,
  onBack,
  initialPly,
}: Props) {
  const repertoireRoots = useMemo(() => buildRepertoire(allAnalyses), [allAnalyses])
  const [analysis, setAnalysis] = useState<GameAnalysis | null>(existingAnalysis)
  const [progress, setProgress] = useState<{ done: number; total: number; currentSan?: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [currentPly, setCurrentPly] = useState(initialPly ?? 0) // 0 = start position
  const [flipped, setFlipped] = useState(false)
  // When non-null, the board shows the engine's PV starting from the
  // current ply's fenBefore — pvStep is how many half-moves into the PV.
  const [pvStep, setPvStep] = useState<number | null>(null)

  // Board decorations requested by the strategic panel (squares, plan arrows).
  const [strategyOverlay, setStrategyOverlay] = useState<BoardOverlay>(EMPTY_OVERLAY)
  // Right-hand panel: the game review first, then move-by-move study.
  const [tab, setTab] = useState<AnalysisTab>(initialPly !== undefined ? 'strategy' : 'review')
  const [engineArrow, setEngineArrow] = useState(() => loadStrategyOverlays().engineArrow)
  const toggleEngineArrow = () => setEngineArrow(v => {
    saveStrategyOverlays({ ...loadStrategyOverlays(), engineArrow: !v })
    return !v
  })

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

  // Key moments: the player's inaccuracies/mistakes/blunders and the
  // strategic moments of the game review, in chronological order (key N).
  const keyMoments = useMemo(() => {
    if (!analysis) return []
    const userIsWhite = analysis.userColor === 'white'
    const plies = new Set<number>()
    for (const m of analysis.moves) {
      if ((m.ply % 2 === 1) !== userIsWhite) continue
      if (m.classification === 'inaccuracy' || m.classification === 'mistake' || m.classification === 'blunder') plies.add(m.ply)
    }
    try {
      for (const e of reviewOf(analysis).events) {
        if ((e.side === 'w') === userIsWhite && e.polarity === 'minus') plies.add(e.focusPly)
      }
    } catch { /* strategic review is optional */ }
    return [...plies].filter(p => p > 0).sort((a, b) => a - b)
  }, [analysis])

  // Keyboard navigation (ignored while typing a note).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!analysis) return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'ArrowLeft') setCurrentPly((p) => Math.max(0, p - 1))
      else if (e.key === 'ArrowRight') setCurrentPly((p) => Math.min(analysis.moves.length, p + 1))
      else if (e.key === 'Home' || e.key === 'ArrowUp') setCurrentPly(0)
      else if (e.key === 'End' || e.key === 'ArrowDown') setCurrentPly(analysis.moves.length)
      else if (e.key === 'f' || e.key === 'F') setFlipped(f => !f)
      else if (e.key === 'a' || e.key === 'A') toggleEngineArrow()
      else if (e.key === 'Escape') setPvStep(null)
      else if (e.key === 'n') setCurrentPly(p => keyMoments.find(k => k > p) ?? p)
      else if (e.key === 'N') setCurrentPly(p => [...keyMoments].reverse().find(k => k < p) ?? p)
      else if (TAB_KEYS[e.key]) setTab(TAB_KEYS[e.key])
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [analysis, keyMoments])

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
  const nextMove = pvStep === null ? analysis.moves[currentPly] : undefined
  const arrows = engineArrow && nextMove?.bestMoveSan
    ? buildBestMoveArrow(currentFen, nextMove.bestMoveSan)
    : []
  const nextKeyMoment = keyMoments.find(k => k > currentPly)
  const result = RESULT_STYLE[analysis.result]
  const exportPgn = () => {
    const pgn = exportAnnotatedPgn(analysis)
    const blob = new Blob([pgn], { type: 'application/x-chess-pgn' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `analysis-vs-${analysis.opponent}-${new Date(analysis.endTime * 1000).toISOString().slice(0, 10)}.pgn`
    document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <div className="p-3 lg:p-5 max-w-[1400px] mx-auto">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 mb-4">
        <button onClick={onBack} className="text-neutral-400 hover:text-white text-sm">← Retour aux parties</button>
        <span className="text-neutral-700" aria-hidden>|</span>
        <h2 className="text-base font-semibold">
          <span className="text-neutral-400 font-normal">{analysis.userColor === 'white' ? 'Blancs' : 'Noirs'} contre </span>
          {analysis.opponent}{analysis.opponentRating ? <span className="text-neutral-400 font-normal"> ({analysis.opponentRating})</span> : null}
        </h2>
        <span className={`text-xs px-2 py-0.5 rounded border ${result.cls}`}>{result.label}</span>
        {analysis.opening && <span className="text-xs text-neutral-400 truncate max-w-[42ch]" title={analysis.opening}>{analysis.opening}</span>}
        <span className="text-xs text-neutral-500">{analysis.timeClass} · {new Date(analysis.endTime * 1000).toLocaleDateString('fr-FR')}</span>
        <button
          onClick={exportPgn}
          className="ml-auto text-xs px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200"
          title="Exporter en PGN avec NAGs + commentaires moteur — compatible Lichess study"
        >📤 Export PGN annoté</button>
      </header>

      <div className="grid gap-5 lg:grid-cols-[auto_minmax(360px,1fr)] items-start">
        <section aria-label="Échiquier" className="lg:sticky lg:top-3">
          <div className="flex gap-2 items-start">
            <EvalBar evalCp={currentEvalWhite} heightClass="h-[min(84vw,560px)]" />
            <div className="w-[min(84vw,560px)]">
              <TrainingBoard
                position={currentFen}
                orientation={flipped
                  ? (analysis.userColor === 'white' ? 'black' : 'white')
                  : analysis.userColor}
                allowDragging={false}
                animationDurationInMs={150}
                arrows={[...arrows, ...strategyOverlay.arrows]}
                squareStyles={strategyOverlay.squareStyles}
              />
            </div>
          </div>
          <div className="flex items-center justify-between mt-2 text-sm pl-8">
            <button onClick={() => setCurrentPly(0)} className="px-2 py-1 hover:bg-neutral-800 rounded" aria-label="Début">⏮</button>
            <button onClick={() => setCurrentPly(p => Math.max(0, p - 1))} className="px-2 py-1 hover:bg-neutral-800 rounded" aria-label="Coup précédent">◀</button>
            <span className="text-neutral-400 text-xs">
              {pvStep !== null ? 'Aperçu de la ligne du moteur' : currentPly === 0 ? 'Position initiale' : `Coup ${Math.ceil(currentPly / 2)}${currentPly % 2 === 1 ? '.' : '...'} ${currentMove?.san}`}
            </span>
            <button onClick={() => setCurrentPly(p => Math.min(analysis.moves.length, p + 1))} className="px-2 py-1 hover:bg-neutral-800 rounded" aria-label="Coup suivant">▶</button>
            <button onClick={() => setCurrentPly(analysis.moves.length)} className="px-2 py-1 hover:bg-neutral-800 rounded" aria-label="Fin">⏭</button>
            <button onClick={() => setFlipped(f => !f)} className="px-2 py-1 hover:bg-neutral-800 rounded ml-2" title="Retourner l'échiquier (F)" aria-label="Retourner l'échiquier">⇅</button>
            <button
              onClick={toggleEngineArrow}
              aria-pressed={engineArrow}
              className={`px-2 py-1 rounded text-xs ${engineArrow ? 'bg-neutral-800 text-emerald-300' : 'text-neutral-500 hover:bg-neutral-800'}`}
              title="Flèche du meilleur coup du moteur (A)"
            >➚ moteur</button>
          </div>
          <div className="mt-3 pl-8">
            <div className="flex items-baseline justify-between mb-1">
              <h3 className="text-xs uppercase tracking-wider text-neutral-500">Évaluation</h3>
              <span className="hidden sm:inline text-[11px] text-neutral-500">← → naviguer · N moment clé · F retourner · ? aide</span>
            </div>
            <EvalGraph
              moves={analysis.moves}
              currentPly={currentPly}
              userColor={analysis.userColor}
              onClickPly={setCurrentPly}
            />
          </div>
        </section>

        <section aria-label="Analyse" className="min-w-0 space-y-3">
          <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md px-3 py-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm min-h-[2.75rem]" aria-live="polite">
            {pvStep !== null ? (
              <>
                <span className="text-sky-300">Aperçu de la ligne du moteur — pas la partie</span>
                <button onClick={() => setPvStep(null)} className="text-xs text-neutral-400 hover:text-white underline">← Retour à la partie (Échap)</button>
              </>
            ) : currentMove ? (
              <>
                <span className="font-mono text-neutral-100">{Math.ceil(currentMove.ply / 2)}{currentMove.ply % 2 === 1 ? '.' : '...'} {currentMove.san}</span>
                <span className="font-medium" style={{ color: CLASSIFICATION_COLORS[currentMove.classification] }}>
                  {CLASSIFICATION_GLYPHS[currentMove.classification] ? `${CLASSIFICATION_GLYPHS[currentMove.classification]} ` : ''}{CLASSIFICATION_LABELS[currentMove.classification]}
                </span>
                {currentMove.cpLoss > 0 && <span className="text-xs text-neutral-500">−{currentMove.cpLoss} cp</span>}
                {currentMove.bestMoveSan && currentMove.bestMoveSan !== currentMove.san && currentMove.cpLoss > 10 && currentMove.classification !== 'book' && (
                  <span className="text-xs text-neutral-400">Le moteur préférait <span className="font-mono text-neutral-200">{currentMove.bestMoveSan}</span></span>
                )}
              </>
            ) : (
              <span className="text-neutral-400">Position initiale</span>
            )}
            <button
              onClick={() => nextKeyMoment && setCurrentPly(nextKeyMoment)}
              disabled={!nextKeyMoment}
              className="ml-auto text-xs px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 disabled:opacity-40"
              title="Tes erreurs et moments stratégiques, dans l'ordre (N / Maj+N)"
            >Moment clé suivant →</button>
          </div>

          <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-3">
            <div className="flex items-baseline justify-between mb-1.5">
              <h3 className="text-sm font-semibold">Liste des coups</h3>
              <span className="text-[11px] text-neutral-500">
                <span style={{ color: CLASSIFICATION_COLORS.inaccuracy }}>?!</span> inexactitude ·{' '}
                <span style={{ color: CLASSIFICATION_COLORS.mistake }}>?</span> erreur ·{' '}
                <span style={{ color: CLASSIFICATION_COLORS.blunder }}>??</span> gaffe
              </span>
            </div>
            <MovesList
              moves={analysis.moves}
              currentPly={currentPly}
              onClick={setCurrentPly}
              userColor={analysis.userColor}
            />
          </div>

          <div role="tablist" aria-label="Panneaux d'analyse" className="flex gap-1 border-b border-[var(--color-border)]">
            {TABS.map(t => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                title={`Raccourci : ${t.key}`}
                className={`px-3 py-2 text-sm -mb-px border-b-2 transition-colors ${tab === t.id
                  ? 'border-[var(--color-accent)] text-white'
                  : 'border-transparent text-neutral-400 hover:text-neutral-200'}`}
              >{t.label}</button>
            ))}
          </div>

          <div role="tabpanel" className="space-y-3">
            {tab === 'review' && (
              <>
                <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-4">
                  <h3 className="font-semibold mb-2">Résumé</h3>
                  <p className="text-sm text-neutral-300 leading-relaxed">{generateGameSummary(analysis, repertoireRoots)}</p>
                  <h4 className="text-xs uppercase tracking-wider text-neutral-500 mt-3 mb-1.5">Vue d'ensemble</h4>
                  <div className="grid grid-cols-3 gap-2">
                    <SummaryStat label="Gaffes" value={summary.user.blunders} color={CLASSIFICATION_COLORS.blunder} />
                    <SummaryStat label="Erreurs" value={summary.user.mistakes} color={CLASSIFICATION_COLORS.mistake} />
                    <SummaryStat label="Inexactitudes" value={summary.user.inaccuracies} color={CLASSIFICATION_COLORS.inaccuracy} />
                  </div>
                  <div className="mt-2 text-xs text-neutral-500">
                    Perte moyenne : toi {summary.user.avgCpLoss.toFixed(0)} cp/coup · adversaire {summary.opp.avgCpLoss.toFixed(0)} cp/coup
                  </div>
                  <div className="mt-3 pt-3 border-t border-[var(--color-border)] flex flex-wrap items-start gap-3">
                    <button
                      onClick={() => { setCurrentPly(1); setTab('move') }}
                      className="text-xs px-2.5 py-1 rounded bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white"
                    >▶ Revoir coup par coup</button>
                    <LlmAskBox
                      ctaLabel="✨ Revue complète de la partie (IA)"
                      hint="L'IA pointe la phase où tu as souffert, le moment charnière, et un axe d'entraînement."
                      resetKey={analysis.url}
                      run={signal => reviewGame(analysis, { signal })}
                    />
                  </div>
                </div>
                <GameStrategyCard analysis={analysis} currentPly={currentPly} onJump={setCurrentPly} />
              </>
            )}

            {tab === 'move' && (currentMove ? (
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

                <MoveStrategyNotes analysis={analysis} ply={currentMove.ply} />

                {(currentMove.classification === 'blunder' || currentMove.classification === 'mistake') && (
                  <CoachExplain analysis={analysis} move={currentMove} />
                )}

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

                <div className="mt-3 pt-3 border-t border-[var(--color-border)]">
                  <PositionNote fen={currentFen} />
                </div>
              </div>
            ) : (
              <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-4 text-sm text-neutral-400">
                Position initiale. Avance avec <kbd className="px-1 rounded bg-neutral-800">→</kbd> ou clique un coup dans la liste pour voir son analyse.
              </div>
            ))}

            {tab === 'strategy' && (
              <StrategyPanel
                fen={currentFen}
                userColor={analysis.userColor}
                // The next move's analysis was computed from the displayed position.
                engineBestSan={pvStep === null ? analysis.moves[currentPly]?.bestMoveSan : undefined}
                playedSan={pvStep === null ? analysis.moves[currentPly]?.san : undefined}
                onOverlay={setStrategyOverlay}
              />
            )}

            {tab === 'opening' && <ExplorerSection fen={currentFen} currentSan={currentMove?.san} />}
          </div>
        </section>
      </div>
    </div>
  )
}

type AnalysisTab = 'review' | 'move' | 'strategy' | 'opening'

const TABS: { id: AnalysisTab; label: string; key: string }[] = [
  { id: 'review', label: 'Bilan', key: 'B' },
  { id: 'move', label: 'Coup', key: 'C' },
  { id: 'strategy', label: 'Stratégie', key: 'S' },
  { id: 'opening', label: 'Ouverture', key: 'O' },
]

const TAB_KEYS: Record<string, AnalysisTab> = { b: 'review', c: 'move', s: 'strategy', o: 'opening' }

const RESULT_STYLE: Record<GameAnalysis['result'], { label: string; cls: string }> = {
  win: { label: 'Victoire', cls: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30' },
  loss: { label: 'Défaite', cls: 'text-red-300 bg-red-500/10 border-red-500/30' },
  draw: { label: 'Nulle', cls: 'text-neutral-300 bg-neutral-500/10 border-neutral-500/30' },
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

/** Green arrow of the engine's preferred move in the displayed position. */
function buildBestMoveArrow(fen: string, san: string): { startSquare: string; endSquare: string; color: string }[] {
  try {
    const m = new Chess(fen).move(san)
    return [{ startSquare: m.from, endSquare: m.to, color: OVERLAY_COLORS.engine }]
  } catch {
    return []
  }
}
