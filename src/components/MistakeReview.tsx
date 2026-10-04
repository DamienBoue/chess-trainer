// "Revoir mes erreurs": replay each of the player's costly moves from the
// decision point and look for better (Lichess "Learn from your mistakes").
// The engine checks alternatives; hints go from the idea (strategic plan
// or tactical motif) to the piece to move; the solution comes with the
// engine line, the plan and what the game move damaged.

import { useEffect, useMemo, useRef, useState } from 'react'
import { Chess } from 'chess.js'
import type { GameAnalysis } from '../types'
import { toWhitePerspective, type StockfishEngine } from '../engine/stockfish'
import { CLASSIFICATION_LABELS } from '../analysis/classify'
import { attemptLossCp, judgeAttempt, type RetryItem, type RetryVerdict } from '../analysis/retry'
import { tryUserMove } from '../utils/move'
import { playSuccess, playWrong } from '../audio/sounds'
import TrainingBoard from './TrainingBoard'
import ConceptChip from './ConceptChip'
import { MoveStrategyNotes } from './GameStrategyCard'
import { retryItemsFor } from './retryItems'
import { OVERLAY_COLORS } from './strategyBoard'

interface Props {
  analysis: GameAnalysis
  engine: StockfishEngine
  /** Leave the review; `ply` = position to show in the analysis afterwards. */
  onExit: (ply?: number) => void
}

type Status = 'solving' | 'checking' | RetryVerdict | 'revealed'
type Outcome = 'first' | 'helped' | 'missed'

export default function MistakeReview({ analysis, engine, onExit }: Props) {
  const items = useMemo(() => retryItemsFor(analysis), [analysis])
  const [index, setIndex] = useState(0)
  const [fen, setFen] = useState(items[0]?.fen ?? '')
  const [status, setStatus] = useState<Status>('solving')
  const [attempt, setAttempt] = useState<{ san: string; lossCp?: number } | null>(null)
  const [hintLevel, setHintLevel] = useState(0)
  const [stumbled, setStumbled] = useState(false)
  const [outcomes, setOutcomes] = useState<Record<number, Outcome>>({})
  // Ignores a late engine answer once the player moved on.
  const requestRef = useRef(0)
  // Leaving the review drops the engine's pending verdict (and its sound).
  useEffect(() => () => { requestRef.current = -1 }, [])

  const item: RetryItem | undefined = items[index]
  const done = index >= items.length
  const userIsWhite = analysis.userColor === 'white'

  function goTo(i: number) {
    requestRef.current++
    setIndex(i)
    setFen(items[i]?.fen ?? '')
    setStatus('solving')
    setAttempt(null)
    setHintLevel(0)
    setStumbled(false)
  }

  function record(outcome: Outcome) {
    if (!item) return
    setOutcomes(o => (o[item.ply] ? o : { ...o, [item.ply]: outcome }))
  }

  function settle(verdict: RetryVerdict, san: string, lossCp?: number) {
    setAttempt({ san, lossCp })
    setStatus(verdict)
    if (verdict === 'best' || verdict === 'good') {
      playSuccess()
      record(hintLevel === 0 && !stumbled ? 'first' : 'helped')
    } else {
      playWrong()
      setStumbled(true)
    }
  }

  function handleDrop(args: { sourceSquare: string; targetSquare: string | null; piece: { pieceType: string } }): boolean {
    if (!item || status !== 'solving') return false
    const chess = new Chess(item.fen)
    // No promotion picker on the board: a pawn pushed onto the engine's
    // squares promotes to the engine's piece, so an under-promotion stays
    // playable (anything else promotes to a queen).
    const under = args.sourceSquare === item.bestFrom && args.targetSquare === item.bestTo
      ? item.bestSan.match(/=([NBR])/)
      : null
    let move: ReturnType<typeof tryUserMove> = null
    if (under) {
      try { move = chess.move({ from: item.bestFrom, to: item.bestTo, promotion: under[1].toLowerCase() }) } catch { move = null }
    } else {
      move = tryUserMove(chess, args)
    }
    if (!move) return false
    setFen(chess.fen())
    const verdict = judgeAttempt(item, move.san)
    if (verdict !== 'pending') {
      settle(verdict, move.san)
      return true
    }
    setAttempt({ san: move.san })
    setStatus('checking')
    const id = ++requestRef.current
    const after = chess.fen()
    engine.evaluate(after, 12, 600)
      .then(r => {
        if (id !== requestRef.current) return
        // The engine scores for the side to move (the opponent, now): the
        // item's evaluations are from White's point of view.
        const white = toWhitePerspective(r.scoreCp, after)
        const v = judgeAttempt(item, move.san, white)
        settle(v === 'pending' ? 'wrong' : v, move.san, attemptLossCp(item, white))
      })
      .catch(() => {
        if (id !== requestRef.current) return
        setStatus('solving')
        setFen(item.fen)
        setAttempt(null)
      })
    return true
  }

  function retry() {
    if (!item) return
    requestRef.current++
    setFen(item.fen)
    setStatus('solving')
    setAttempt(null)
  }

  function reveal() {
    if (!item) return
    requestRef.current++
    record('missed')
    setFen(item.fen)
    setStatus('revealed')
  }

  if (items.length === 0) {
    return (
      <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-5 text-sm text-neutral-300 max-w-xl">
        <p className="mb-3">Aucune erreur à revoir dans cette partie : pas de gaffe ni d'erreur de ta part, et aucun plan manqué.</p>
        <button onClick={() => onExit()} className="text-xs px-3 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-100">← Retour à l'analyse</button>
      </div>
    )
  }

  if (done) {
    const values = Object.values(outcomes)
    const first = values.filter(v => v === 'first').length
    const helped = values.filter(v => v === 'helped').length
    const missed = items.length - first - helped
    return (
      <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-5 max-w-xl">
        <h3 className="font-semibold mb-3">Revue terminée</h3>
        <ul className="text-sm text-neutral-300 space-y-1 mb-4">
          <li><span className="text-emerald-300 font-semibold">{first}</span> trouvée{first > 1 ? 's' : ''} du premier coup</li>
          <li><span className="text-sky-300 font-semibold">{helped}</span> trouvée{helped > 1 ? 's' : ''} avec un indice ou un second essai</li>
          <li><span className="text-amber-300 font-semibold">{missed}</span> solution{missed > 1 ? 's' : ''} vue{missed > 1 ? 's' : ''} ou passée{missed > 1 ? 's' : ''}</li>
        </ul>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => { setOutcomes({}); goTo(0) }} className="text-xs px-3 py-1.5 rounded bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white">↻ Recommencer</button>
          <button onClick={() => onExit()} className="text-xs px-3 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-100">← Retour à l'analyse</button>
        </div>
      </div>
    )
  }

  const solved = status === 'best' || status === 'good'
  const showSolution = solved || status === 'revealed'
  const moveLabel = `${Math.ceil(item.ply / 2)}${item.ply % 2 === 1 ? '.' : '...'}`
  const squareStyles: Record<string, React.CSSProperties> = {}
  if (hintLevel >= 2 && !showSolution) squareStyles[item.bestFrom] = { boxShadow: `inset 0 0 0 4px ${OVERLAY_COLORS.focus}` }
  const arrows = status === 'revealed'
    ? [{ startSquare: item.bestFrom, endSquare: item.bestTo, color: OVERLAY_COLORS.engine }]
    : []

  return (
    <div className="grid gap-5 lg:grid-cols-[auto_minmax(360px,1fr)] items-start">
      <section aria-label="Échiquier de la revue" className="lg:sticky lg:top-3">
        <div className="w-[min(90vw,560px)]">
          <TrainingBoard
            id={`retry-${item.ply}`}
            position={fen}
            orientation={userIsWhite ? 'white' : 'black'}
            allowDragging={status === 'solving'}
            onPieceDrop={handleDrop}
            squareStyles={squareStyles}
            arrows={arrows}
            animationDurationInMs={150}
          />
        </div>
      </section>

      <section aria-label="Revoir mes erreurs" className="min-w-0 space-y-3">
        <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-4">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h3 className="font-semibold">Revoir mes erreurs <span className="text-sm font-normal text-neutral-500">· {index + 1} / {items.length}</span></h3>
            <button onClick={() => onExit(item.ply - 1)} className="text-xs text-neutral-400 hover:text-white">Quitter</button>
          </div>
          <div className="h-1 bg-neutral-800 rounded-full overflow-hidden mb-3">
            <div className="h-full bg-[var(--color-accent)] transition-all" style={{ width: `${(index / items.length) * 100}%` }} />
          </div>

          <p className="text-sm text-neutral-200 leading-relaxed">
            À toi de jouer ({userIsWhite ? 'Blancs' : 'Noirs'}). Au coup {moveLabel}, tu as joué{' '}
            <span className="font-mono">{item.playedSan}</span>{' '}
            <span className="text-neutral-400">({CLASSIFICATION_LABELS[item.classification].toLowerCase()}, −{item.cpLoss} cp)</span>.
            {' '}Trouve mieux.
          </p>

          {!showSolution && hintLevel > 0 && (
            <ul className="mt-2 space-y-1 text-sm text-sky-200">
              {item.hints.slice(0, hintLevel).map((h, i) => <li key={i}>💡 {h}</li>)}
            </ul>
          )}

          <div className="mt-3 min-h-[1.5rem] text-sm" aria-live="polite">
            {status === 'checking' && <span className="text-neutral-400">Le moteur vérifie {attempt?.san}…</span>}
            {status === 'best' && <span className="text-emerald-300">✓ Exactement le coup du moteur : <span className="font-mono">{item.bestSan}</span> !</span>}
            {status === 'good' && <span className="text-emerald-300">✓ Bon coup : <span className="font-mono">{attempt?.san}</span> tient la position. Le moteur préférait <span className="font-mono">{item.bestSan}</span>.</span>}
            {status === 'same' && <span className="text-red-300">✗ C'est le coup de la partie. Cherche autre chose.</span>}
            {status === 'wrong' && <span className="text-red-300">✗ <span className="font-mono">{attempt?.san}</span> n'est pas mieux{attempt?.lossCp ? ` (−${attempt.lossCp} cp par rapport au meilleur coup)` : ''}.</span>}
            {status === 'revealed' && <span className="text-amber-200">Solution : <span className="font-mono">{item.bestSan}</span> (flèche verte).</span>}
          </div>

          <div className="flex flex-wrap gap-2 mt-3">
            {(status === 'same' || status === 'wrong') && (
              <button onClick={retry} className="text-xs px-3 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-100">↻ Réessayer</button>
            )}
            {!showSolution && hintLevel < item.hints.length && status !== 'checking' && (
              <button onClick={() => setHintLevel(h => h + 1)} className="text-xs px-3 py-1.5 rounded bg-sky-500/15 hover:bg-sky-500/25 text-sky-200 border border-sky-500/30">
                💡 {hintLevel === 0 ? 'Indice' : 'Autre indice'}
              </button>
            )}
            {!showSolution && status !== 'checking' && (
              <button onClick={reveal} className="text-xs px-3 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300">Voir la solution</button>
            )}
            {showSolution ? (
              <button onClick={() => goTo(index + 1)} className="ml-auto text-xs px-3 py-1.5 rounded bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white">
                {index + 1 < items.length ? 'Suivant →' : 'Voir le bilan →'}
              </button>
            ) : (
              <button onClick={() => { record('missed'); goTo(index + 1) }} className="ml-auto text-xs px-3 py-1.5 rounded text-neutral-500 hover:text-neutral-200">Passer</button>
            )}
          </div>
        </div>

        {showSolution && (
          <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-4 text-sm space-y-2">
            <h4 className="text-xs uppercase tracking-wider text-neutral-500">Pourquoi</h4>
            {item.bestLineSan && (
              <p className="text-neutral-300">Ligne du moteur : <span className="font-mono text-neutral-100">{item.bestLineSan}</span></p>
            )}
            {item.plan && (
              <div className="text-neutral-300">
                <p><span className="text-neutral-100">Plan : {item.plan.title}.</span> {item.plan.why}</p>
                {item.plan.conceptId && <div className="mt-1.5"><ConceptChip id={item.plan.conceptId} /></div>}
              </div>
            )}
            <MoveStrategyNotes analysis={analysis} ply={item.ply} omitMissedPlan={!!item.plan} />
          </div>
        )}
      </section>
    </div>
  )
}
