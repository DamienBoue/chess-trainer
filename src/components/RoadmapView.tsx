import { useEffect, useMemo, useState } from 'react'
import type { GameAnalysis } from '../types'
import {
  BRACKETS,
  bracketForElo,
  effectiveElo,
  inferEloFromGames,
  loadEloPreference,
  saveEloPreference,
  suggestBracketChange,
  type SkillBracket,
} from '../skill/elo'
import {
  loadModuleProgress,
  modulesForBracket,
  toggleModuleDone,
  type ModuleArea,
  type RoadmapModule,
} from '../skill/roadmap'
import ChecklistRow from './ChecklistRow'
import ConceptChip from './ConceptChip'

interface Props {
  analyses: GameAnalysis[]
  onNavigate: (view: 'exercises' | 'blunder' | 'calc' | 'repertoire' | 'library' | 'play' | 'stats' | 'book') => void
  /** Skip the page-level header and outer padding so it can be embedded
   *  inside another container (e.g. PlanView's tab). */
  embedded?: boolean
}

export default function RoadmapView({ analyses, onNavigate, embedded = false }: Props) {
  const [pref, setPref] = useState(() => loadEloPreference())
  const [progress, setProgress] = useState(() => loadModuleProgress())
  const inferred = useMemo(() => inferEloFromGames(analyses), [analyses])
  const elo = effectiveElo(pref, analyses)
  const bracket = bracketForElo(elo)
  // Which bracket's modules are currently displayed. Defaults to the
  // user's real bracket but the ladder lets them browse other levels.
  const [viewBracketId, setViewBracketId] = useState<SkillBracket['id']>(bracket.id)
  const viewBracket = BRACKETS.find(b => b.id === viewBracketId) ?? bracket
  const isPreview = viewBracket.id !== bracket.id
  const modules = modulesForBracket(viewBracket)
  const suggestion = useMemo(() => suggestBracketChange(pref, analyses), [pref, analyses])

  // Keep viewBracket in sync when the real bracket changes (e.g. user
  // updates declared Elo) unless they're actively previewing another.
  useEffect(() => {
    if (!isPreview) setViewBracketId(bracket.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bracket.id])

  function updateDeclared(value: string) {
    const n = parseInt(value, 10)
    const next = { ...pref, declared: Number.isFinite(n) && n > 0 ? n : null }
    setPref(next)
    saveEloPreference(next)
  }

  function toggle(id: string) {
    setProgress(toggleModuleDone(id))
  }

  const completed = new Set(progress.completed)
  const completedCount = modules.filter(m => completed.has(m.id)).length

  function selectBracket(id: SkillBracket['id']) {
    setViewBracketId(id)
  }

  return (
    <div className={embedded ? 'space-y-5' : 'p-4 lg:p-6 max-w-3xl mx-auto space-y-5'}>
      {!embedded && (
        <div>
          <h2 className="text-2xl font-semibold">Roadmap d'apprentissage</h2>
          <p className="text-sm text-neutral-400">
            Les modules à maîtriser en priorité pour ton palier. Coche au fur et à mesure.
          </p>
        </div>
      )}

      <section className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-4 space-y-3">
        <h3 className="font-semibold text-sm">Ton niveau</h3>
        <div className="flex gap-2 items-center flex-wrap">
          <label className="text-sm text-neutral-300">Elo déclaré</label>
          <input
            type="number"
            min={400}
            max={3500}
            step={10}
            placeholder={inferred ? `auto: ${inferred}` : '1200'}
            value={pref.declared ?? ''}
            onChange={e => updateDeclared(e.target.value)}
            className="w-24 px-2 py-1 text-sm rounded bg-neutral-900 border border-[var(--color-border)] font-mono"
          />
          {pref.declared != null && (
            <button
              onClick={() => updateDeclared('')}
              className="text-xs text-neutral-400 hover:text-white underline"
            >Effacer</button>
          )}
          {inferred != null && pref.declared == null && (
            <span className="text-xs text-neutral-500">Auto-détecté depuis tes parties analysées : {inferred}</span>
          )}
        </div>
        <BracketLadder
          activeBracket={bracket}
          viewBracket={viewBracket}
          onSelect={selectBracket}
        />
        <p className="text-sm text-neutral-300">
          <span className="font-medium" style={{ color: BRACKET_COLORS[viewBracket.id] }}>{viewBracket.label}</span>
          {' — '}{viewBracket.description}
        </p>

        {suggestion && (
          <div className={`mt-2 p-3 rounded border text-sm ${
            suggestion.kind === 'promote'
              ? 'bg-green-500/10 border-green-500/40 text-green-200'
              : 'bg-amber-500/10 border-amber-500/40 text-amber-200'
          }`}>
            {suggestion.kind === 'promote'
              ? `📈 Tes parties récentes pointent vers ${suggestion.inferred} (palier ${suggestion.nextBracket.label}). Mettre à jour ton Elo déclaré ?`
              : `📉 Tes parties récentes pointent vers ${suggestion.inferred} (palier ${suggestion.nextBracket.label}). Période difficile ? Tu peux revoir ton Elo à la baisse.`}
            <button
              onClick={() => updateDeclared(String(suggestion.inferred))}
              className="ml-2 text-xs px-2 py-0.5 rounded bg-neutral-900/60 hover:bg-neutral-900 underline"
            >Appliquer {suggestion.inferred}</button>
          </div>
        )}
      </section>

      <section className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-4">
        <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
          <div className="flex items-baseline gap-2 flex-wrap">
            <h3 className="font-semibold">Modules · {viewBracket.label}</h3>
            {isPreview && (
              <>
                <span className="text-[11px] uppercase tracking-wider text-amber-300">Aperçu</span>
                <button
                  onClick={() => selectBracket(bracket.id)}
                  className="text-xs text-neutral-400 hover:text-white underline"
                >← Revenir à ton palier ({bracket.label})</button>
              </>
            )}
          </div>
          <span className="text-sm font-mono">{completedCount}/{modules.length}</span>
        </div>
        <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden mb-4">
          <div
            className="h-full bg-[var(--color-accent)] transition-all"
            style={{ width: `${modules.length === 0 ? 0 : (completedCount / modules.length) * 100}%` }}
          />
        </div>

        <div className="space-y-2">
          {modules.map(m => (
            <ModuleRow
              key={m.id}
              mod={m}
              done={completed.has(m.id)}
              onToggle={() => toggle(m.id)}
              onGo={() => m.surface && onNavigate(m.surface)}
            />
          ))}
        </div>
      </section>

      {!isPreview && bracket.id !== 'master' && (
        <div className="text-xs text-neutral-500 text-center">
          Quand tu auras coché tous les modules de ce palier, monte ton Elo déclaré → la roadmap se reconfigure.
        </div>
      )}
    </div>
  )
}

function BracketLadder({
  activeBracket, viewBracket, onSelect,
}: {
  activeBracket: SkillBracket
  viewBracket: SkillBracket
  onSelect: (id: SkillBracket['id']) => void
}) {
  return (
    <div className="flex gap-1 flex-wrap text-[10px] font-mono">
      {BRACKETS.map(b => {
        const isViewing = b.id === viewBracket.id
        const isReal = b.id === activeBracket.id
        return (
          <button
            key={b.id}
            onClick={() => onSelect(b.id)}
            className={`px-2 py-0.5 rounded transition-colors ${
              isViewing
                ? 'text-white'
                : 'text-neutral-400 bg-neutral-900 hover:bg-neutral-800 hover:text-neutral-200'
            } ${isReal && !isViewing ? 'ring-1 ring-neutral-500' : ''}`}
            style={isViewing ? { backgroundColor: BRACKET_COLORS[b.id] } : undefined}
            title={`${b.label} · ${b.min}-${b.max}${isReal ? ' (ton palier)' : ''} — cliquer pour voir les modules`}
          >
            {b.label}
          </button>
        )
      })}
    </div>
  )
}

function ModuleRow({
  mod, done, onToggle, onGo,
}: { mod: RoadmapModule; done: boolean; onToggle: () => void; onGo: () => void }) {
  const action = mod.surface ? (
    <button
      onClick={onGo}
      className="text-xs px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200"
      title={`Ouvrir : ${SURFACE_LABELS[mod.surface]}`}
    >
      {SURFACE_LABELS[mod.surface]} →
    </button>
  ) : null
  return (
    <ChecklistRow done={done} onToggle={onToggle} action={action}>
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className={`text-[10px] uppercase tracking-wider ${AREA_COLORS[mod.area]}`}>{AREA_LABELS[mod.area]}</span>
        {mod.conceptId && <ConceptChip id={mod.conceptId} />}
      </div>
      <h4 className={`font-medium ${done ? 'line-through text-neutral-500' : ''}`}>{mod.title}</h4>
      <p className="text-xs text-neutral-400 mt-0.5">{mod.why}</p>
      {mod.studyHint && !mod.surface && (
        <div className="mt-2 text-xs text-amber-200/90 bg-amber-500/5 border border-amber-500/20 rounded p-2 leading-relaxed">
          <span className="text-[10px] uppercase tracking-wider text-amber-300 block mb-0.5">Piste d'étude</span>
          {mod.studyHint}
        </div>
      )}
    </ChecklistRow>
  )
}

const SURFACE_LABELS: Record<NonNullable<RoadmapModule['surface']>, string> = {
  exercises:  'Exercices',
  blunder:    'Réflexe',
  calc:       'Calcul',
  repertoire: 'Répertoire',
  library:    'Bibliothèque',
  play:       'Jouer',
  stats:      'Stats',
  book:       'Livre',
}

const BRACKET_COLORS: Record<SkillBracket['id'], string> = {
  beginner:   '#9b9b9b',
  casual:     '#7aa6ee',
  club:       '#5fa052',
  tournament: '#ef9a3a',
  expert:     '#c47aee',
  master:     '#d04a4a',
}

const AREA_LABELS: Record<ModuleArea, string> = {
  tactics:     'Tactique',
  endgame:     'Finale',
  opening:     'Ouverture',
  middlegame:  'Milieu',
  calculation: 'Calcul',
  mindset:     'Mental',
}

const AREA_COLORS: Record<ModuleArea, string> = {
  tactics:     'text-orange-300',
  endgame:     'text-amber-200',
  opening:     'text-blue-300',
  middlegame:  'text-green-300',
  calculation: 'text-purple-300',
  mindset:     'text-pink-300',
}
