// Per-phase cpLoss + classification breakdown. Bars + highlight of the
// "worst" phase. Extracted from StatsView.

import { CLASSIFICATION_COLORS } from '../analysis/classify'
import { PHASE_LABELS, type AggregateStats, type Phase } from '../analysis/aggregate'
import Tooltip from './Tooltip'

interface Props {
  stats: AggregateStats
  totalUserMistakes: number
}

export default function PhaseBreakdownPanel({ stats, totalUserMistakes }: Props) {
  const phases = ['opening', 'middlegame', 'endgame'] as const
  const phaseList = phases.map(p => ({ key: p, ...stats.phases[p] }))
  const activePhases = phaseList.filter(p => p.userMoves > 0)
  const worstByCpLoss = activePhases.length > 0
    ? activePhases.reduce((a, b) => a.avgCpLoss > b.avgCpLoss ? a : b)
    : null
  const maxCpLoss = Math.max(40, ...activePhases.map(p => p.avgCpLoss))

  return (
    <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-4">
      <div className="flex items-baseline justify-between mb-1">
        <h3 className="font-semibold">Performance par phase</h3>
        <Tooltip content="Ouverture = 1-20 plies. Finale = 20 derniers plies. Milieu = le reste.">
          <span className="text-[10px] text-neutral-500 cursor-help">ℹ︎</span>
        </Tooltip>
      </div>
      <p className="text-xs text-neutral-500 mb-3">
        Où la précision décroche dans la partie.
      </p>
      <div className="space-y-2.5">
        {phaseList.map(p => {
          const pct = maxCpLoss > 0 ? Math.min(100, (p.avgCpLoss / maxCpLoss) * 100) : 0
          const isWorst = worstByCpLoss?.key === p.key && activePhases.length > 1
          return (
            <div key={p.key} className="text-sm">
              <div className="flex justify-between items-baseline text-xs mb-1">
                <span className={isWorst ? 'text-red-300 font-medium' : 'text-neutral-300'}>
                  {PHASE_LABELS[p.key as Phase]}
                  {isWorst && <span className="ml-1 text-[10px] uppercase tracking-wider">le plus faible</span>}
                </span>
                <span className="text-neutral-400 font-mono">
                  {p.userMoves > 0 ? `${p.avgCpLoss.toFixed(0)} cp/coup` : '—'}
                </span>
              </div>
              <div className="w-full bg-neutral-900 rounded h-1.5 overflow-hidden">
                <div
                  className="h-full transition-all"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: isWorst ? '#ef4444' : '#7aa6ee',
                  }}
                />
              </div>
              <div className="flex gap-3 text-[11px] text-neutral-500 mt-1">
                <span>{p.userMoves} coups</span>
                {p.blunders > 0 && <span style={{ color: CLASSIFICATION_COLORS.blunder }}>{p.blunders} gaffes</span>}
                {p.mistakes > 0 && <span style={{ color: CLASSIFICATION_COLORS.mistake }}>{p.mistakes} err.</span>}
                {p.inaccuracies > 0 && <span style={{ color: CLASSIFICATION_COLORS.inaccuracy }}>{p.inaccuracies} inex.</span>}
              </div>
            </div>
          )
        })}
      </div>
      <div className="mt-3 text-xs text-neutral-500">
        Total : {totalUserMistakes} coups imprécis toutes phases.
      </div>
    </div>
  )
}
