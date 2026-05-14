import { useMemo } from 'react'
import type { GameAnalysis } from '../types'
import { type ExerciseProgress, isDue, loadRepertoireProgress } from '../storage/persist'
import { extractExercises } from '../analysis/exercises'
import { buildRepertoire, enumerateDrillCards } from '../analysis/repertoire'
import { findRecurringMistakes } from '../analysis/recurringMistakes'
import { aggregate } from '../analysis/aggregate'
import { buildPlan, totalMinutes } from '../analysis/plan'
import { loadDaily, todayString } from '../storage/daily'
import { loadPlanState } from '../storage/plan'
import { bracketForElo, effectiveElo, loadEloPreference } from '../skill/elo'
import Tooltip from './Tooltip'

interface Props {
  username: string
  analyses: GameAnalysis[]
  progress: Record<string, ExerciseProgress>
  onNavigate: (view:
    | 'games' | 'daily' | 'plan' | 'roadmap' | 'exercises' | 'stats' | 'repertoire'
    | 'library' | 'play' | 'scouting' | 'blunder' | 'home') => void
}

export default function Dashboard({ username, analyses, progress, onNavigate }: Props) {
  const exercises = useMemo(() => extractExercises(analyses), [analyses])
  const dueExercises = useMemo(
    () => exercises.filter(e => isDue(progress[e.id])).length,
    [exercises, progress],
  )
  const roots = useMemo(() => buildRepertoire(analyses), [analyses])
  const drillCards = useMemo(() => enumerateDrillCards(roots), [roots])
  const repProgress = useMemo(() => loadRepertoireProgress(), [])
  const dueSrs = useMemo(
    () => drillCards.filter(c => isDue(repProgress[c.id])).length,
    [drillCards, repProgress],
  )
  const recurring = useMemo(() => findRecurringMistakes(analyses), [analyses])
  const topRecurring = recurring.exact[0] ?? recurring.byOpening[0] ?? null
  const stats = useMemo(() => aggregate(analyses), [analyses])

  const dailyState = loadDaily()
  const today = todayString()
  const dailyDone = dailyState?.date === today && dailyState.solved
  const dailyStreak = dailyState?.streak ?? 0

  const plan = useMemo(
    () => buildPlan(analyses, progress, repProgress, { dailyDone: !!dailyDone }),
    [analyses, progress, repProgress, dailyDone],
  )
  const planState = useMemo(() => loadPlanState(today), [today])
  const planDoneCount = useMemo(() => {
    const doneSet = new Set(planState.done)
    if (dailyDone) doneSet.add('daily')
    return plan.filter(p => doneSet.has(p.id)).length
  }, [plan, planState, dailyDone])
  const planMinutes = totalMinutes(plan)

  const totalGames = analyses.length
  const eloPref = useMemo(() => loadEloPreference(), [])
  const elo = effectiveElo(eloPref, analyses)
  const bracket = bracketForElo(elo)

  if (totalGames === 0) {
    return (
      <EmptyDashboard
        username={username}
        onAnalyze={() => onNavigate('games')}
        onSwitch={() => onNavigate('home')}
      />
    )
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <div className="flex items-baseline justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-semibold flex items-center gap-2 flex-wrap">
            Bonjour @{username}
            <button
              onClick={() => onNavigate('roadmap')}
              className="text-[11px] px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 font-normal uppercase tracking-wider"
              title={`Niveau ${bracket.label} — ouvrir la roadmap`}
            >
              {bracket.label}{elo != null && <span className="ml-1 text-neutral-400">{elo}</span>}
            </button>
          </h2>
          <p className="text-sm text-neutral-400">
            {totalGames} parties analysées · précision moyenne {stats.avgCpLossUser.toFixed(0)} cp / coup
          </p>
        </div>
        <button
          onClick={() => onNavigate('home')}
          className="text-xs text-neutral-400 hover:text-white underline"
        >
          Changer de compte
        </button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <DashCard
          accent="#7fd8c4"
          title={plan.length === 0 ? '✓ Rien au programme' : plan.length === planDoneCount ? '✓ Plan du jour terminé' : 'Plan du jour'}
          metric={plan.length === 0 ? '—' : `${planDoneCount}/${plan.length}`}
          subtitle={plan.length === 0
            ? 'Tu es à jour partout. Reviens demain.'
            : `${plan.length} étape${plan.length > 1 ? 's' : ''} pour ≈ ${planMinutes} min — synthèse SRS, répertoire et erreurs récurrentes.`}
          cta={plan.length === planDoneCount ? 'Revoir' : 'Démarrer'}
          onClick={() => onNavigate('plan')}
          disabled={plan.length === 0}
        />

        <DashCard
          accent={dailyDone ? '#5fa052' : '#ef9a3a'}
          title={dailyDone ? '✓ Quotidien fait' : 'Quotidien'}
          metric={dailyStreak > 0 ? `🔥 ${dailyStreak} j` : null}
          metricTooltip="Série de jours consécutifs avec le quotidien résolu. Saute un jour = retour à 0."
          subtitle={dailyDone
            ? 'Reviens demain pour conserver la série.'
            : 'Un puzzle daily déterministe pour entretenir le rituel.'}
          cta={dailyDone ? 'Rejouer pour s\'amuser' : 'Jouer maintenant'}
          onClick={() => onNavigate('daily')}
          disabled={exercises.length === 0}
        />

        <DashCard
          accent="#7aa6ee"
          title="Exercices à réviser"
          metric={dueExercises > 0 ? String(dueExercises) : 'À jour'}
          subtitle={dueExercises > 0
            ? `${dueExercises} positions ressorties par SM-2.`
            : 'Tu es à jour. Reviens demain.'}
          cta={dueExercises > 0 ? 'Drill' : 'Voir tous'}
          onClick={() => onNavigate('exercises')}
          disabled={exercises.length === 0}
        />

        <DashCard
          accent="#c47aee"
          title="Répertoire SRS"
          metric={dueSrs > 0 ? String(dueSrs) : drillCards.length === 0 ? '—' : 'À jour'}
          subtitle={drillCards.length === 0
            ? 'Analyse 2-3 parties d\'une même ouverture pour générer des cartes.'
            : dueSrs > 0
              ? `${dueSrs} positions du répertoire à réviser.`
              : 'Tout le répertoire est à jour.'}
          cta={drillCards.length === 0 ? 'Analyser' : dueSrs > 0 ? 'Drill SRS' : 'Voir'}
          onClick={() => onNavigate(drillCards.length === 0 ? 'games' : 'repertoire')}
        />

        <DashCard
          accent="#d04a4a"
          title="Réflexe blunder"
          metric={null}
          subtitle="Drille les positions où tu retombes dans le même piège, contre la montre."
          cta="Lancer une session"
          onClick={() => onNavigate('blunder')}
          disabled={exercises.length < 3}
        />

        <DashCard
          accent="#5fa052"
          title="Bilan & faiblesses"
          metric={null}
          subtitle="Radar des motifs, ouvertures jouées, erreurs récurrentes — tout en une page."
          cta="Voir Stats"
          onClick={() => onNavigate('stats')}
        />

        <DashCard
          accent="#bbbbbb"
          title="Jouer contre Stockfish"
          metric={null}
          subtitle="Partie complète avec Elo ajustable. Export PGN à la fin pour analyse."
          cta="Nouvelle partie"
          onClick={() => onNavigate('play')}
        />
      </div>

      {topRecurring && (
        <div className="bg-red-900/20 border border-red-700/40 rounded-md p-4">
          <h3 className="font-semibold mb-1 text-red-200">⚠️ Erreur récurrente du moment</h3>
          <p className="text-sm text-red-100">
            <span className="font-mono font-bold">{topRecurring.sanPlayed}</span>{' '}
            joué <span className="font-bold">{topRecurring.occurrences.length} fois</span>
            {topRecurring.parentOpening && <> dans <span className="text-red-200">{topRecurring.parentOpening}</span></>}.
            {topRecurring.bestSan && topRecurring.bestSan !== topRecurring.sanPlayed && (
              <> Engine voulait <span className="font-mono text-green-300">{topRecurring.bestSan}</span>.</>
            )}
          </p>
          <button
            onClick={() => onNavigate('stats')}
            className="mt-2 text-xs px-3 py-1 rounded bg-red-900/40 hover:bg-red-900/60 text-red-100"
          >
            Voir le détail
          </button>
        </div>
      )}

      <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-4">
        <h3 className="font-semibold mb-2 text-sm">Accès rapide</h3>
        <div className="flex flex-wrap gap-2 text-sm">
          <QuickLink onClick={() => onNavigate('games')}>Parties</QuickLink>
          <QuickLink onClick={() => onNavigate('library')}>Bibliothèque</QuickLink>
          <QuickLink onClick={() => onNavigate('scouting')}>Scouting</QuickLink>
        </div>
      </div>
    </div>
  )
}

function EmptyDashboard({
  username, onAnalyze, onSwitch,
}: { username: string; onAnalyze: () => void; onSwitch: () => void }) {
  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5">
      <div>
        <h2 className="text-2xl font-semibold">Bonjour @{username}</h2>
        <p className="text-sm text-neutral-400">Tu n'as encore analysé aucune partie.</p>
      </div>
      <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-5">
        <p className="text-sm mb-3">Pour démarrer :</p>
        <ol className="list-decimal pl-5 text-sm text-neutral-300 space-y-1 mb-4">
          <li>Va dans <strong>Parties</strong> — tes 20 dernières parties chess.com sont chargées.</li>
          <li>Clique <em>Tout analyser</em> pour lancer Stockfish en lot.</li>
          <li>Reviens ici quand c'est fini : exercices, répertoire, et stats sont débloqués.</li>
        </ol>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={onAnalyze}
            className="px-4 py-2 text-sm rounded bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white font-medium"
          >Voir mes parties</button>
          <button
            onClick={onSwitch}
            className="px-4 py-2 text-sm rounded bg-neutral-800 hover:bg-neutral-700"
          >Changer de pseudo</button>
        </div>
      </div>
    </div>
  )
}

function DashCard({
  accent, title, metric, metricTooltip, subtitle, cta, onClick, disabled,
}: {
  accent: string
  title: string
  metric: string | null
  metricTooltip?: string
  subtitle: string
  cta: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <div
      className={`bg-[var(--color-panel)] border rounded-md p-4 flex flex-col gap-2 transition-all ${
        disabled ? 'opacity-50 border-[var(--color-border)]'
                 : 'border-[var(--color-border)] hover:border-neutral-600'
      }`}
    >
      <div className="flex items-baseline justify-between">
        <h3 className="font-semibold text-sm" style={{ color: accent }}>{title}</h3>
        {metric && (
          metricTooltip ? (
            <Tooltip content={metricTooltip}>
              <span className="font-mono text-xl text-neutral-100 cursor-help">{metric}</span>
            </Tooltip>
          ) : (
            <span className="font-mono text-xl text-neutral-100">{metric}</span>
          )
        )}
      </div>
      <p className="text-xs text-neutral-400 leading-relaxed flex-1">{subtitle}</p>
      <button
        onClick={onClick}
        disabled={disabled}
        className={`mt-1 text-sm px-3 py-1.5 rounded text-white font-medium ${
          disabled ? 'bg-neutral-800 cursor-not-allowed'
                   : 'bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)]'
        }`}
      >{cta}</button>
    </div>
  )
}

function QuickLink({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 rounded bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-[var(--color-border)]"
    >
      {children}
    </button>
  )
}
