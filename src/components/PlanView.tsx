import { useMemo, useState } from 'react'
import type { GameAnalysis } from '../types'
import { type ExerciseProgress, loadRepertoireProgress } from '../storage/persist'
import { buildPlan, totalMinutes, type PlanItem } from '../analysis/plan'
import { loadDaily, todayString } from '../storage/daily'
import { loadPlanState, markPlanItemDone, unmarkPlanItem } from '../storage/plan'
import { bracketForElo, effectiveElo, loadEloPreference } from '../skill/elo'
import { aggregate } from '../analysis/aggregate'
import { MOTIF_LABELS } from '../analysis/motifs'
import type { MotifTag } from '../analysis/motifs'
import { summariseDailyPlan } from '../coach/coach'
import { conceptForMotif } from '../concepts/lookup'
import ChecklistRow from './ChecklistRow'
import LlmAskBox from './LlmAskBox'
import { openConcept } from './ConceptModal'
import RoadmapView from './RoadmapView'

interface Props {
  analyses: GameAnalysis[]
  progress: Record<string, ExerciseProgress>
  username?: string
  onNavigate: (target: 'daily' | 'exercises' | 'repertoire' | 'stats' | 'games' | 'roadmap' | 'home' | 'blunder' | 'calc' | 'library' | 'play' | 'book', opts?: { motif?: MotifTag }) => void
}

export default function PlanView({ analyses, progress, username, onNavigate }: Props) {
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

  const [tab, setTab] = useState<'today' | 'roadmap'>('today')
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

  // Empty state: user is connected but hasn't analysed anything yet.
  if (analyses.length === 0) {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-5">
        {username && <PlanHeader username={username} analyses={analyses} onOpenRoadmap={() => onNavigate('roadmap')} onLogout={() => onNavigate('home')} />}
        <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-5">
          <h3 className="font-semibold mb-2">Démarrer en 3 étapes</h3>
          <ol className="list-decimal pl-5 text-sm text-neutral-300 space-y-1 mb-4">
            <li>Va dans <strong>Parties</strong> — tes dernières parties chess.com sont déjà chargées.</li>
            <li>Clique <em>Tout analyser</em>. Stockfish tourne en local.</li>
            <li>Reviens ici : ton plan, tes exercices et ton répertoire sont débloqués.</li>
          </ol>
          <button
            onClick={() => onNavigate('games')}
            className="px-4 py-2 text-sm rounded bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white font-medium"
          >Voir mes parties</button>
        </div>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="p-6 max-w-3xl mx-auto space-y-5">
        {username && <PlanHeader username={username} analyses={analyses} onOpenRoadmap={() => onNavigate('roadmap')} onLogout={() => onNavigate('home')} />}
        <h2 className="text-xl font-semibold">Plan du jour <span className="text-sm font-normal text-neutral-500 ml-2">{today}</span></h2>
        <div className="bg-green-500/10 border border-green-500/30 rounded-md p-5 text-sm text-green-200">
          <p className="font-semibold mb-1">✓ Rien au programme aujourd'hui</p>
          <p>SRS à jour, pas d'erreur récurrente flagrante, répertoire propre. Reviens demain.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto space-y-5">
      {username && <PlanHeader username={username} analyses={analyses} onOpenRoadmap={() => setTab('roadmap')} onLogout={() => onNavigate('home')} />}

      <div className="flex gap-1 border-b border-[var(--color-border)] text-sm">
        <PlanTabBtn active={tab === 'today'} onClick={() => setTab('today')}>Aujourd'hui</PlanTabBtn>
        <PlanTabBtn active={tab === 'roadmap'} onClick={() => setTab('roadmap')}>Mon niveau</PlanTabBtn>
      </div>

      {tab === 'roadmap' && (
        <RoadmapView
          analyses={analyses}
          embedded
          onNavigate={target => onNavigate(target as 'exercises' | 'blunder' | 'calc' | 'repertoire' | 'stats')}
        />
      )}

      {tab === 'today' && <>
      <div className="flex items-baseline justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-semibold">Plan du jour <span className="text-sm font-normal text-neutral-500 ml-2">{today}</span></h2>
          <p className="text-xs text-neutral-500">
            {items.length} étape{items.length > 1 ? 's' : ''} · ≈ {totalMin} min
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
      </>}
    </div>
  )
}

function PlanTabBtn({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-2 -mb-px border-b-2 transition-colors ${
        active
          ? 'border-[var(--color-accent)] text-white'
          : 'border-transparent text-neutral-400 hover:text-neutral-200'
      }`}
    >{children}</button>
  )
}

// Greeting + Elo bracket badge + 1-line stats. Sits at the top of the
// authenticated home (= Plan). Replaces the old Dashboard banner.
function PlanHeader({
  username, analyses, onOpenRoadmap, onLogout,
}: {
  username: string
  analyses: GameAnalysis[]
  onOpenRoadmap: () => void
  onLogout: () => void
}) {
  const bracket = useMemo(
    () => bracketForElo(effectiveElo(loadEloPreference(), analyses)),
    [analyses],
  )
  const elo = useMemo(() => effectiveElo(loadEloPreference(), analyses), [analyses])
  const stats = useMemo(() => aggregate(analyses), [analyses])
  const dailyState = loadDaily()
  const streak = dailyState?.streak ?? 0

  return (
    <div className="flex items-baseline justify-between flex-wrap gap-3 pb-4 border-b border-[var(--color-border)]">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2 flex-wrap">
          Bonjour @{username}
          <button
            onClick={onOpenRoadmap}
            className="text-[11px] px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 font-normal uppercase tracking-wider"
            title="Niveau actuel — ouvrir la roadmap"
          >
            {bracket.label}{elo != null && <span className="ml-1 text-neutral-400">{elo}</span>}
          </button>
          {streak > 0 && (
            <span
              className="text-[11px] px-2 py-0.5 rounded bg-orange-500/15 border border-orange-500/30 text-orange-300 font-normal"
              title={`Série quotidienne — ${streak} jour${streak > 1 ? 's' : ''} consécutifs`}
            >🔥 {streak}</span>
          )}
        </h1>
        {analyses.length > 0 && (
          <p className="text-sm text-neutral-400">
            {analyses.length} parties analysées · précision moyenne {stats.avgCpLossUser.toFixed(0)} cp/coup
          </p>
        )}
      </div>
      <button
        onClick={onLogout}
        className="text-xs text-neutral-400 hover:text-white underline"
      >Changer de compte</button>
    </div>
  )
}

// Optional AI-generated framing of today's session. Hidden if no LLM key.
function CoachIntro({ items, bracket }: { items: PlanItem[]; bracket: ReturnType<typeof bracketForElo> }) {
  if (items.length === 0) return null
  const signature = items.map(i => i.id).join('|')
  return (
    <div className="mb-4">
      <LlmAskBox
        ctaLabel="✨ Demander à l'IA un cadrage pour aujourd'hui"
        tinted
        resetKey={signature}
        run={signal => summariseDailyPlan(items, bracket, { signal })}
      />
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
        {item.motif && conceptForMotif(item.motif) && (
          <button
            onClick={e => { e.stopPropagation(); openConcept(conceptForMotif(item.motif!)!.id) }}
            className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300"
            title="Voir la fiche concept"
          >📖 Lire</button>
        )}
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
