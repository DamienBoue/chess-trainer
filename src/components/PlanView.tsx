import { useMemo, useState } from 'react'
import type { GameAnalysis } from '../types'
import { type ExerciseProgress, loadRepertoireProgress } from '../storage/persist'
import { buildPlan, totalMinutes, type PlanItem } from '../analysis/plan'
import { loadDaily, todayString } from '../storage/daily'
import { loadPlanState, markPlanItemDone, unmarkPlanItem } from '../storage/plan'
import { bracketForElo, effectiveElo, loadEloPreference } from '../skill/elo'
import { MOTIF_LABELS } from '../analysis/motifs'
import type { MotifTag } from '../analysis/motifs'
import { llmAvailable, summariseDailyPlan } from '../llm/coach'
import ChecklistRow from './ChecklistRow'
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

      <CoachIntro items={items} bracket={bracket} />

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

// Optional AI-generated framing of today's session. Hidden if no LLM key.
// Stored cache key includes plan signature so the prose stays stable
// across re-renders of the same plan.
function CoachIntro({ items, bracket }: { items: PlanItem[]; bracket: ReturnType<typeof bracketForElo> }) {
  const available = useMemo(() => llmAvailable(), [])
  const [text, setText] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  if (!available || items.length === 0) return null

  async function run() {
    setLoading(true); setErr(null); setText(null)
    try {
      setText(await summariseDailyPlan(items, bracket) || '(Réponse vide.)')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erreur LLM')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mb-4 p-3 rounded-md bg-purple-500/5 border border-purple-500/30">
      {!text && !loading && !err && (
        <button
          onClick={run}
          className="text-xs px-2.5 py-1 rounded bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 border border-purple-500/30"
        >✨ Demander à l'IA un cadrage pour aujourd'hui</button>
      )}
      {loading && <p className="text-xs text-neutral-400">L'IA prépare la session…</p>}
      {err && <p className="text-xs text-red-400">⚠ {err}</p>}
      {text && (
        <>
          <div className="text-sm text-neutral-200 leading-relaxed whitespace-pre-wrap">{text}</div>
          <button
            onClick={run}
            className="mt-2 text-[11px] text-neutral-500 hover:text-white underline"
          >Régénérer</button>
        </>
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
  const action = (
    <button
      onClick={onGo}
      className="px-3 py-1.5 text-sm rounded bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white font-medium"
    >
      {done ? 'Revoir' : 'Faire'}
    </button>
  )
  return (
    <ChecklistRow
      done={done}
      onToggle={onToggle}
      toggleLocked={item.id === 'daily'}
      action={action}
    >
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
    </ChecklistRow>
  )
}

const KIND_LABELS: Record<PlanItem['kind'], string> = {
  'daily': 'Quotidien',
  'srs-exercises': 'SRS exercices',
  'srs-repertoire': 'SRS répertoire',
  'motif-drill': 'Drill motif',
  'phase-focus': 'Phase faible',
  'recurring': 'Erreur récurrente',
  'hole': 'Trou répertoire',
}

const ACCENTS: Record<PlanItem['kind'], string> = {
  'daily': 'text-orange-300',
  'srs-exercises': 'text-blue-300',
  'srs-repertoire': 'text-purple-300',
  'motif-drill': 'text-pink-300',
  'phase-focus': 'text-teal-300',
  'recurring': 'text-red-300',
  'hole': 'text-amber-300',
}

void MOTIF_LABELS // re-exported by motifs; keep import for type narrowing
