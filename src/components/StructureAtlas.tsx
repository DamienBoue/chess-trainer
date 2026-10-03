// Atlas of the named pawn structures: what each one is about, the plans of
// both sides, the thematic pawn breaks and key squares drawn on a
// reference position — plus how the player scores in it, when known.

import { useMemo, useState } from 'react'
import TrainingBoard from './TrainingBoard'
import ConceptChip from './ConceptChip'
import { type Side, SIDE_LABEL, parseFen, sqName } from '../strategy/board'
import { STRUCTURES, detectStructures, structureRole } from '../strategy/structures'
import { STRUCTURE_SAMPLES, sampleFen } from '../strategy/samples'
import type { StructureStat } from '../strategy/profile'
import { OVERLAY_COLORS, strongSquareStyle } from './strategyBoard'

const FAMILIES: { label: string; ids: string[] }[] = [
  { label: 'Pions isolés et pendants', ids: ['iqp', 'hanging-pawns', 'panov-chain'] },
  { label: 'Structures du Gambit Dame', ids: ['carlsbad', 'slav', 'caro-slav', 'triangle', 'nimzo-doubled', 'big-center'] },
  { label: 'Siciliennes', ids: ['maroczy', 'hedgehog', 'scheveningen', 'boleslavsky', 'd5-chain', 'dragon'] },
  { label: 'Françaises', ids: ['french-chain', 'french-open', 'french-e5'] },
  { label: 'Centres fermés et Benoni', ids: ['kid-closed', 'benoni', 'benoni-sym', 'stonewall'] },
  { label: 'Majorités', ids: ['majority-3-4'] },
]

interface Props {
  /** Per-structure stats from the strategic profile (optional). */
  stats?: StructureStat[]
  initialId?: string
}

export default function StructureAtlas({ stats = [], initialId }: Props) {
  const [selected, setSelected] = useState<string>(initialId ?? FAMILIES[0].ids[0])
  const [side, setSide] = useState<Side>('w')
  const pattern = STRUCTURES.find(p => p.id === selected) ?? STRUCTURES[0]
  const sample = STRUCTURE_SAMPLES.find(s => s.structureId === pattern.id)
  const fen = sample ? sampleFen(sample) : null
  const match = useMemo(() => {
    if (!fen) return null
    return detectStructures(parseFen(fen)).find(m => m.pattern.id === pattern.id) ?? null
  }, [fen, pattern.id])
  const role = match ? structureRole(match, side) : null
  const otherRole = match ? structureRole(match, side === 'w' ? 'b' : 'w') : null
  const mine = stats.filter(s => s.id === pattern.id)

  const arrows = (role?.breaks ?? []).map(([from, to]) => ({ startSquare: sqName(from), endSquare: sqName(to), color: OVERLAY_COLORS.plan }))
  const squareStyles: Record<string, React.CSSProperties> = {}
  for (const sq of role?.squares ?? []) squareStyles[sqName(sq)] = strongSquareStyle()

  return (
    <div className="grid lg:grid-cols-[220px_1fr] gap-4">
      <nav aria-label="Structures" className="space-y-3">
        {FAMILIES.map(f => (
          <div key={f.label}>
            <h4 className="text-[11px] uppercase tracking-wider text-neutral-500 mb-1">{f.label}</h4>
            <ul className="space-y-0.5">
              {f.ids.map(id => {
                const p = STRUCTURES.find(x => x.id === id)
                if (!p) return null
                const played = stats.filter(s => s.id === id).reduce((n, s) => n + s.games, 0)
                return (
                  <li key={id}>
                    <button
                      onClick={() => setSelected(id)}
                      aria-current={selected === id}
                      className={`w-full text-left text-sm px-2 py-1 rounded flex items-center justify-between gap-2 ${selected === id ? 'bg-[var(--color-accent)]/20 text-white' : 'text-neutral-300 hover:bg-neutral-800'}`}
                    >
                      <span className="truncate">{p.name}</span>
                      {played > 0 && <span className="text-[11px] text-neutral-400 shrink-0">{played} p.</span>}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      <article className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-4 min-w-0">
        <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
          <div>
            <h3 className="text-lg font-semibold">{pattern.name}</h3>
            {sample && <p className="text-xs text-neutral-500">Exemple : {sample.opening}</p>}
          </div>
          {pattern.conceptId && <ConceptChip id={pattern.conceptId} label="📖 Fiche détaillée" />}
        </div>
        <p className="text-sm text-neutral-300 leading-relaxed mb-4">{pattern.summary}</p>

        <div className="grid md:grid-cols-[minmax(0,300px)_1fr] gap-4">
          <div>
            {fen && (
              <TrainingBoard
                position={fen}
                orientation={side === 'w' ? 'white' : 'black'}
                maxWidth={300}
                arrows={arrows}
                squareStyles={squareStyles}
                animationDurationInMs={0}
              />
            )}
            <p className="text-[11px] text-neutral-500 mt-1.5">
              Flèches : ruptures thématiques de {SIDE_LABEL[side].toLowerCase()} · en vert : leurs cases clés.
            </p>
          </div>
          <div className="min-w-0">
            <div className="inline-flex rounded-md border border-[var(--color-border)] bg-neutral-900 p-0.5 text-xs mb-3" role="group" aria-label="Camp">
              {(['w', 'b'] as Side[]).map(s => (
                <button
                  key={s}
                  onClick={() => setSide(s)}
                  aria-pressed={side === s}
                  className={`px-2.5 py-1 rounded ${side === s ? 'bg-[var(--color-accent)] text-white' : 'text-neutral-300 hover:bg-neutral-800'}`}
                >Plans des {SIDE_LABEL[s]}</button>
              ))}
            </div>
            {role && (
              <>
                <p className="text-xs text-neutral-500 mb-1">Dans cet exemple, les {SIDE_LABEL[side]} sont {role.role}.</p>
                <ul className="list-disc pl-5 space-y-1.5 text-sm text-neutral-200">
                  {role.plans.map((p, i) => <li key={i}>{p}</li>)}
                </ul>
                {otherRole && (
                  <details className="mt-3">
                    <summary className="text-xs text-neutral-400 cursor-pointer hover:text-white">Et l'adversaire ? ({otherRole.role})</summary>
                    <ul className="list-disc pl-5 space-y-1 text-sm text-neutral-400 mt-1.5">
                      {otherRole.plans.map((p, i) => <li key={i}>{p}</li>)}
                    </ul>
                  </details>
                )}
              </>
            )}
          </div>
        </div>

        {mine.length > 0 && (
          <div className="mt-4 pt-3 border-t border-[var(--color-border)]">
            <h4 className="text-xs uppercase tracking-wider text-neutral-500 mb-1.5">Dans tes parties</h4>
            <ul className="space-y-1 text-sm">
              {mine.map(s => (
                <li key={s.role} className="text-neutral-300">
                  {s.roleLabel.charAt(0).toUpperCase() + s.roleLabel.slice(1)} : <span className="font-medium">{s.games} partie{s.games > 1 ? 's' : ''}</span>,
                  score {Math.round(s.score * 100)} %, {Math.round(s.avgCpLoss)} cp perdus par coup.
                </li>
              ))}
            </ul>
          </div>
        )}
      </article>
    </div>
  )
}
