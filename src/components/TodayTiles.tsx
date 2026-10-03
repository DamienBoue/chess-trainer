// Three one-click shortcuts at the top of "Aujourd'hui" (chess.com home /
// Anki style): review the last game, revise due exercises, work on the
// weakest phase.

import { useMemo } from 'react'
import type { GameAnalysis } from '../types'
import type { ExerciseProgress } from '../storage/persist'
import { isDue } from '../storage/persist'
import { extractExercises } from '../analysis/exercises'
import { aggregate, PHASE_LABELS, type Phase } from '../analysis/aggregate'

interface Props {
  analyses: GameAnalysis[]
  progress: Record<string, ExerciseProgress>
  onOpenGame: (url: string) => void
  onNavigate: (target: 'exercises' | 'strategyProfile' | 'stats') => void
}

const RESULT_FR = { win: 'Victoire', loss: 'Défaite', draw: 'Nulle' } as const

export default function TodayTiles({ analyses, progress, onOpenGame, onNavigate }: Props) {
  const last = useMemo(() => [...analyses].sort((a, b) => b.endTime - a.endTime)[0], [analyses])
  const due = useMemo(
    () => extractExercises(analyses).filter(e => isDue(progress[e.id])).length,
    [analyses, progress],
  )
  const weakest = useMemo(() => {
    const stats = aggregate(analyses)
    const phases = (Object.keys(stats.phases) as Phase[]).filter(p => stats.phases[p].userMoves >= 10)
    if (phases.length < 2) return null
    const worst = phases.reduce((a, b) => (stats.phases[a].avgCpLoss >= stats.phases[b].avgCpLoss ? a : b))
    return { phase: worst, cp: stats.phases[worst].avgCpLoss }
  }, [analyses])
  if (!last) return null

  const userIsWhite = last.userColor === 'white'
  const userErrors = last.moves.filter(m => (m.ply % 2 === 1) === userIsWhite && (m.classification === 'blunder' || m.classification === 'mistake')).length

  return (
    <div className="grid sm:grid-cols-3 gap-3">
      <Tile
        title="Dernière partie"
        body={<>vs <span className="text-neutral-100">{last.opponent}</span> · {RESULT_FR[last.result]}<br />{userErrors === 0 ? 'Aucune erreur grave' : `${userErrors} erreur${userErrors > 1 ? 's' : ''} ou gaffe${userErrors > 1 ? 's' : ''}`}</>}
        cta="Revoir"
        onClick={() => onOpenGame(last.url)}
      />
      <Tile
        title="À réviser"
        body={due > 0 ? <><span className="text-neutral-100 font-semibold">{due}</span> exercice{due > 1 ? 's' : ''} dû{due > 1 ? 's' : ''} aujourd'hui</> : 'Rien à réviser : SRS à jour'}
        cta={due > 0 ? 'Réviser' : 'S\'exercer quand même'}
        onClick={() => onNavigate('exercises')}
      />
      <Tile
        title="Point faible n°1"
        body={weakest
          ? <>{PHASE_LABELS[weakest.phase]} : <span className="text-neutral-100">{Math.round(weakest.cp)} cp perdus</span> par coup</>
          : 'Analyse plus de parties pour le faire émerger'}
        cta="Comprendre"
        onClick={() => onNavigate(weakest ? 'strategyProfile' : 'stats')}
      />
    </div>
  )
}

function Tile({ title, body, cta, onClick }: { title: string; body: React.ReactNode; cta: string; onClick: () => void }) {
  return (
    <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-3 flex flex-col">
      <div className="text-[11px] uppercase tracking-wider text-neutral-500 mb-1">{title}</div>
      <div className="text-sm text-neutral-300 leading-snug flex-1">{body}</div>
      <button
        onClick={onClick}
        className="mt-2 self-start text-xs px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-100"
      >{cta} →</button>
    </div>
  )
}
