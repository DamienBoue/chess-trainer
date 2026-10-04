// Reverse-color drill: replay your most-played opening line from the
// opposite side. The repertoire trainer covers what you do best with your
// usual color; this view forces you to handle the same structures as the
// opponent. Useful for understanding "why" your habits work — once you've
// played both sides of a structure, the tactical motifs stick deeper.
//
// We take the user's most-played line, mirror every FEN and SAN, and walk
// the user through it ply by ply. The opponent's mirrored moves are auto-
// played; the user must enter the mirrored own moves.

import { useMemo, useState } from 'react'
import { Chess } from 'chess.js'
import TrainingBoard from './TrainingBoard'
import EmptyState from './EmptyState'
import type { GameAnalysis } from '../types'
import { buildRepertoire } from '../analysis/repertoire'
import { mostPlayedLine } from '../analysis/openingLine'
import { mirrorFen, mirrorSan } from '../analysis/mirror'

interface Props {
  analyses: GameAnalysis[]
  onGoToGames?: () => void
}

interface MirrorLine {
  rootKey: string
  rootLabel: string
  originalColor: 'white' | 'black'
  /** Mirrored side the user will play in the drill. */
  drillColor: 'white' | 'black'
  /** Mirrored ply-by-ply sequence the user must reproduce.
   *  Each entry is one *user* move in the mirror. */
  steps: Array<{
    /** The mirrored FEN before the user's move. */
    fenBefore: string
    /** The expected mirrored SAN the user must enter. */
    expectedSan: string
    /** The mirrored opponent move that comes after (or null if last). */
    nextOppSan: string | null
    /** Statistics from the original (un-mirrored) line. */
    count: number
    totalAtNode: number
  }>
}

function buildMirrorLines(analyses: GameAnalysis[]): MirrorLine[] {
  const roots = buildRepertoire(analyses).filter(r => r.total >= 2)
  const out: MirrorLine[] = []
  for (const r of roots) {
    const line = mostPlayedLine(r, { maxPlies: 6 })
    if (line.length === 0) continue
    out.push({
      rootKey: `${r.parent}::${r.color}`,
      rootLabel: r.parent,
      originalColor: r.color,
      drillColor: r.color === 'white' ? 'black' : 'white',
      steps: line.map((step, i) => ({
        fenBefore: mirrorFen(step.fenBefore),
        expectedSan: mirrorSan(step.userSan),
        nextOppSan: i + 1 < line.length ? mirrorSan(line[i + 1].oppPrev) : null,
        count: step.count,
        totalAtNode: step.totalAtNode,
      })),
    })
  }
  return out
}

export default function ReverseDrillView({ analyses, onGoToGames }: Props) {
  const lines = useMemo(() => buildMirrorLines(analyses), [analyses])
  const [activeKey, setActiveKey] = useState<string | null>(lines[0]?.rootKey ?? null)
  const [stepIdx, setStepIdx] = useState(0)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [status, setStatus] = useState<'pending' | 'correct' | 'wrong' | 'finished'>('pending')
  const [currentFen, setCurrentFen] = useState<string | null>(null)

  const active = useMemo(
    () => lines.find(l => l.rootKey === activeKey) ?? null,
    [lines, activeKey],
  )

  if (analyses.length === 0) {
    return (
      <EmptyState
        icon="🪞"
        title="Ouvertures en miroir"
        description="Tu n'as pas encore de parties analysées. Importe ton historique pour générer un répertoire, puis reviens ici rejouer tes structures à l'envers."
        cta={onGoToGames ? { label: 'Voir mes parties', onClick: onGoToGames } : undefined}
      />
    )
  }
  if (lines.length === 0) {
    return (
      <EmptyState
        icon="🪞"
        title="Ouvertures en miroir"
        description="Tu n'as pas encore au moins 2 parties dans une même ouverture pour générer une ligne miroir. Joue (et analyse) plus de parties dans la même ouverture."
        cta={onGoToGames ? { label: 'Voir mes parties', onClick: onGoToGames } : undefined}
      />
    )
  }

  function start(key: string) {
    const line = lines.find(l => l.rootKey === key)
    if (!line || line.steps.length === 0) return
    setActiveKey(key)
    setStepIdx(0)
    setFeedback(null)
    setStatus('pending')
    setCurrentFen(line.steps[0].fenBefore)
  }

  function tryMove(from: string, to: string): boolean {
    if (!active || status === 'finished') return false
    const step = active.steps[stepIdx]
    if (!step) return false
    const c = new Chess(currentFen ?? step.fenBefore)
    let mv
    try { mv = c.move({ from, to, promotion: 'q' }) } catch { return false }
    if (!mv) return false

    if (mv.san !== step.expectedSan) {
      setStatus('wrong')
      setFeedback(`✗ ${mv.san} ≠ ${step.expectedSan} (miroir de ton coup le plus joué ${step.count}/${step.totalAtNode}).`)
      return false
    }

    // Correct. Apply opponent's mirrored move (if any) to land on the next decision.
    let nextFen = c.fen()
    if (step.nextOppSan) {
      const c2 = new Chess(c.fen())
      try { c2.move(step.nextOppSan); nextFen = c2.fen() } catch { /* noop */ }
    }
    const nextIdx = stepIdx + 1
    const finished = nextIdx >= active.steps.length
    setStepIdx(nextIdx)
    setStatus(finished ? 'finished' : 'correct')
    setCurrentFen(finished ? nextFen : active.steps[nextIdx]?.fenBefore ?? nextFen)
    setFeedback(finished
      ? `✓ ${mv.san}. Fin de la ligne miroir.`
      : `✓ ${mv.san}. Adversaire joue ${step.nextOppSan}.`)
    return true
  }

  function reveal() {
    if (!active) return
    const step = active.steps[stepIdx]
    if (!step) return
    setFeedback(`Coup miroir attendu : ${step.expectedSan}.`)
  }

  function restart() {
    if (active) start(active.rootKey)
  }

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto">
      <header className="mb-4 flex flex-wrap items-baseline gap-3">
        <h2 className="text-2xl font-semibold">Ouvertures en miroir</h2>
        <p className="text-sm text-neutral-400">
          Rejoue tes ouvertures côté opposé pour mieux comprendre les structures sous-jacentes.
        </p>
      </header>

      <div className="mb-4">
        <p className="text-xs text-neutral-500 mb-2">Lignes mémorisées disponibles :</p>
        <div className="flex gap-2 flex-wrap">
          {lines.map(l => {
            const isActive = activeKey === l.rootKey && currentFen != null
            return (
              <button
                key={l.rootKey}
                onClick={() => start(l.rootKey)}
                className={`px-3 py-1.5 text-sm rounded border ${
                  isActive
                    ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10'
                    : 'border-[var(--color-border)] hover:bg-neutral-800'
                }`}
              >
                <span className="text-xs text-neutral-500 mr-1">
                  {l.originalColor === 'white' ? '♔' : '♚'}→{l.drillColor === 'white' ? '♔' : '♚'}
                </span>
                {l.rootLabel}
              </button>
            )
          })}
        </div>
      </div>

      {active && currentFen && (
        <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-4 space-y-3">
          <div className="text-sm text-neutral-300">
            {active.rootLabel} miroir — tu joues les{' '}
            {active.drillColor === 'white' ? 'blancs' : 'noirs'} · coup {Math.min(stepIdx + 1, active.steps.length)}/{active.steps.length}
          </div>
          <TrainingBoard
            position={currentFen}
            orientation={active.drillColor}
            allowDragging={status !== 'finished'}
            maxWidth={440}
            onPieceDrop={({ sourceSquare, targetSquare }) => {
              if (!targetSquare) return false
              return tryMove(sourceSquare, targetSquare)
            }}
          />
          {feedback && (
            <div className={`text-sm rounded p-2 ${
              status === 'correct' || status === 'finished' ? 'text-green-400 bg-green-500/10'
              : status === 'wrong' ? 'text-red-400 bg-red-500/10'
              : 'text-neutral-300 bg-neutral-800'
            }`}>{feedback}</div>
          )}
          <div className="flex gap-2">
            <button onClick={reveal} className="px-3 py-1 text-sm bg-neutral-800 hover:bg-neutral-700 rounded">
              Indice
            </button>
            <button onClick={restart} className="px-3 py-1 text-sm bg-neutral-800 hover:bg-neutral-700 rounded">
              Recommencer
            </button>
          </div>
        </div>
      )}
      {!currentFen && active && (
        <p className="text-sm text-neutral-500">Clique sur une ligne pour démarrer.</p>
      )}
    </div>
  )
}
