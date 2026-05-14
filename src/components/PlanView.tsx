import { useMemo, useState } from 'react'
import type { GameAnalysis } from '../types'
import { type ExerciseProgress, loadRepertoireProgress } from '../storage/persist'
import { buildPlan, totalMinutes, type PlanItem } from '../analysis/plan'
import { loadDaily, todayString } from '../storage/daily'
import { loadPlanState, markPlanItemDone, unmarkPlanItem } from '../storage/plan'
import { bracketForElo, effectiveElo, loadEloPreference } from '../skill/elo'
import { MOTIF_LABELS } from '../analysis/motifs'
import type { MotifTag } from '../analysis/motifs'
import EmptyState from './EmptyState'

interface Props {
  analyses: GameAnalysis[]
  progress: Record<string, ExerciseProgress>
  onNavigate: (target: 'daily' | 'exercises' | 'repertoire' | 'stats', opts?: { motif?: MotifTag }) => void
}

export default function PlanView({ analyses, progress, onNavigate }: Props) {
  const today = todayString()
  const dailyState = loadDaily()
  const dailyDone = dailyState?.date === today && !!dailyState.solved
  const repProgress = useMemo(() => loadRepertoireProgress(), [])
  const bracket = useMemo(
    () => bracketForElo(effectiveElo(loadEloPreference(), analyses)),
    [analyses],
  )

  const items = useMemo(
    () => buildPlan(analyses, progress, repProgress, { dailyDone, bracket }),
    [analyses, progress, repProgress, dailyDone, bracket],
  )

  const [planState, setPlanState] = useState(() => loadPlanState(today))
  const doneSet = new Set(planState.done)
  // The daily item counts as done as soon as the daily streak says so.
  if (dailyDone) doneSet.add('daily')

  function toggle(id: string) {
    if (id === 'daily') return // controlled by the daily view itself
    setPlanState(doneSet.has(id) ? unmarkPlanItem(today, id) : markPlanItemDone(today, id))
  }

  const totalDone = items.filter(it => doneSet.has(it.id)).length
  const totalMin = totalMinutes(items)
  const completion = items.length === 0 ? 0 : totalDone / items.length

  if (analyses.length === 0) {
    return (
      <EmptyState
        icon="📋"
        title="Pas encore de plan"
        description="Le plan quotidien synthétise tes SRS dues, ton répertoire et tes erreurs récurrentes en une session de 10-15 min. Il faut au moins une partie analysée pour démarrer."
      />
    )
  }

  if (items.length === 0) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <h2 className="text-2xl font-semibold mb-2">Plan du jour</h2>
        <p className="text-sm text-neutral-500 mb-4">{today}</p>
        <div className="bg-green-500/10 border border-green-500/30 rounded-md p-5 text-sm text-green-200">
          <p className="font-semibold mb-1">✓ Rien au programme aujourd'hui</p>
          <p>SRS à jour, pas d'erreur récurrente flagrante, répertoire propre. Reviens demain.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto">
      <div className="flex items-baseline justify-between flex-wrap gap-3 mb-4">
        <div>
          <h2 className="text-2xl font-semibold">Plan du jour</h2>
          <p className="text-sm text-neutral-400">
            {today} · {items.length} étape{items.length > 1 ? 's' : ''} · ≈ {totalMin} min
          </p>
        </div>
        <div className="text-sm">
          <span className="font-mono text-lg">{totalDone}/{items.length}</span>{' '}
          <span className="text-neutral-500">fait</span>
        </div>
      </div>

      <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden mb-5">
        <div
          className="h-full bg-[var(--color-accent)] transition-all duration-300"
          style={{ width: `${completion * 100}%` }}
        />
      </div>

      <div className="space-y-2">
        {items.map(item => (
          <PlanRow
            key={item.id}
            item={item}
            done={doneSet.has(item.id)}
            onToggle={() => toggle(item.id)}
            onGo={() => {
              if (!doneSet.has(item.id) && item.id !== 'daily') {
                setPlanState(markPlanItemDone(today, item.id))
              }
              onNavigate(item.target, item.motif ? { motif: item.motif } : undefined)
            }}
          />
        ))}
      </div>

      {totalDone === items.length && (
        <div className="mt-5 bg-green-500/10 border border-green-500/30 rounded-md p-4 text-sm text-green-200">
          <p className="font-semibold mb-1">✓ Session terminée</p>
          <p>Tu as fait toutes les étapes du jour. Reviens demain pour la suivante.</p>
        </div>
      )}
    </div>
  )
}

function PlanRow({
  item, done, onToggle, onGo,
}: {
  item: PlanItem
  done: boolean
  onToggle: () => void
  onGo: () => void
}) {
  const accent = ACCENTS[item.kind]
  return (
    <div
      className={`bg-[var(--color-panel)] border rounded-md p-3 flex items-center gap-3 transition-all ${
        done ? 'border-green-500/30 opacity-60' : 'border-[var(--color-border)] hover:border-neutral-600'
      }`}
    >
      <button
        onClick={onToggle}
        disabled={item.id === 'daily'}
        className={`w-6 h-6 shrink-0 rounded-full border-2 flex items-center justify-center transition-colors ${
          done
            ? 'bg-green-500/30 border-green-500/60 text-green-300'
            : 'border-neutral-600 hover:border-neutral-400'
        } ${item.id === 'daily' ? 'cursor-default' : ''}`}
        title={item.id === 'daily' ? 'Marqué automatiquement quand le quotidien est résolu' : (done ? 'Marquer non fait' : 'Marquer fait')}
        aria-label={done ? 'Marquer non fait' : 'Marquer fait'}
      >
        {done ? '✓' : ''}
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className={`text-xs font-medium ${accent}`}>{KIND_LABELS[item.kind]}</span>
          <span className="text-xs text-neutral-500">≈ {item.estMinutes} min</span>
        </div>
        <h3 className={`font-semibold ${done ? 'line-through text-neutral-500' : ''}`}>{item.title}</h3>
        <p className="text-xs text-neutral-400 mt-0.5">{item.subtitle}</p>
        {item.recurring && (
          <p className="mt-1 text-xs text-red-300 font-mono">
            {item.recurring.parentOpening ? `${item.recurring.parentOpening} · ` : ''}
            {item.recurring.sanPlayed}
            {item.recurring.bestSan && item.recurring.bestSan !== item.recurring.sanPlayed && (
              <> → <span className="text-green-300">{item.recurring.bestSan}</span></>
            )}
          </p>
        )}
        {item.hole && (
          <p className="mt-1 text-xs text-neutral-400">
            <span className="font-mono">{item.hole.oppPrev}</span> · {item.hole.visits} visites ·{' '}
            {item.hole.choices.slice(0, 3).map(c => (
              <span key={c.san} className="font-mono mr-1.5">
                {c.san} <span className="text-neutral-500">{Math.round(c.share * 100)}%</span>
              </span>
            ))}
          </p>
        )}
      </div>
      <button
        onClick={onGo}
        className="px-3 py-1.5 text-sm rounded bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white font-medium shrink-0"
      >
        {done ? 'Revoir' : 'Faire'}
      </button>
    </div>
  )
}

const KIND_LABELS: Record<PlanItem['kind'], string> = {
  'daily': 'Quotidien',
  'srs-exercises': 'SRS exercices',
  'srs-repertoire': 'SRS répertoire',
  'motif-drill': 'Drill motif',
  'recurring': 'Erreur récurrente',
  'hole': 'Trou répertoire',
}

const ACCENTS: Record<PlanItem['kind'], string> = {
  'daily': 'text-orange-300',
  'srs-exercises': 'text-blue-300',
  'srs-repertoire': 'text-purple-300',
  'motif-drill': 'text-pink-300',
  'recurring': 'text-red-300',
  'hole': 'text-amber-300',
}

void MOTIF_LABELS // re-exported by motifs; keep import for type narrowing
