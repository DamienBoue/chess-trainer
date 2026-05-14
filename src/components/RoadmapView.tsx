import { useMemo, useState } from 'react'
import type { GameAnalysis } from '../types'
import {
  BRACKETS,
  bracketForElo,
  effectiveElo,
  inferEloFromGames,
  loadEloPreference,
  saveEloPreference,
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

interface Props {
  analyses: GameAnalysis[]
  onNavigate: (view: 'exercises' | 'blunder' | 'calc' | 'repertoire' | 'library' | 'play' | 'stats' | 'book') => void
}

export default function RoadmapView({ analyses, onNavigate }: Props) {
  const [pref, setPref] = useState(() => loadEloPreference())
  const [progress, setProgress] = useState(() => loadModuleProgress())
  const inferred = useMemo(() => inferEloFromGames(analyses), [analyses])
  const elo = effectiveElo(pref, analyses)
  const bracket = bracketForElo(elo)
  const modules = modulesForBracket(bracket)

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

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto space-y-5">
      <div>
        <h2 className="text-2xl font-semibold">Roadmap d'apprentissage</h2>
        <p className="text-sm text-neutral-400">
          Les modules à maîtriser en priorité pour ton palier. Coche au fur et à mesure.
        </p>
      </div>

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
        <BracketLadder activeBracket={bracket} />
        <p className="text-sm text-neutral-300">
          <span className="font-medium" style={{ color: BRACKET_COLORS[bracket.id] }}>{bracket.label}</span>
          {' — '}{bracket.description}
        </p>
      </section>

      <section className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-4">
        <div className="flex items-baseline justify-between mb-3">
          <h3 className="font-semibold">Modules · {bracket.label}</h3>
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

      {bracket.id !== 'master' && (
        <div className="text-xs text-neutral-500 text-center">
          Quand tu auras coché tous les modules de ce palier, monte ton Elo déclaré → la roadmap se reconfigure.
        </div>
      )}
    </div>
  )
}

function BracketLadder({ activeBracket }: { activeBracket: SkillBracket }) {
  return (
    <div className="flex gap-1 flex-wrap text-[10px] font-mono">
      {BRACKETS.map(b => (
        <span
          key={b.id}
          className={`px-2 py-0.5 rounded ${
            b.id === activeBracket.id
              ? 'text-white'
              : 'text-neutral-500 bg-neutral-900'
          }`}
          style={b.id === activeBracket.id ? { backgroundColor: BRACKET_COLORS[b.id] } : undefined}
          title={`${b.min}-${b.max}`}
        >
          {b.label}
        </span>
      ))}
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
    >
      Aller →
    </button>
  ) : null
  return (
    <ChecklistRow done={done} onToggle={onToggle} action={action}>
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className={`text-[10px] uppercase tracking-wider ${AREA_COLORS[mod.area]}`}>{AREA_LABELS[mod.area]}</span>
      </div>
      <h4 className={`font-medium ${done ? 'line-through text-neutral-500' : ''}`}>{mod.title}</h4>
      <p className="text-xs text-neutral-400 mt-0.5">{mod.why}</p>
    </ChecklistRow>
  )
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
