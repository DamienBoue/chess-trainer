import { useMemo, useState } from 'react'
import type { GameAnalysis } from '../types'
import { buildRepertoire, topLines, alternativesAt, rollupString, type RepertoireRoot } from '../analysis/repertoire'

interface Props { analyses: GameAnalysis[] }

export default function RepertoireView({ analyses }: Props) {
  const roots = useMemo(() => buildRepertoire(analyses), [analyses])
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const active = roots.find(r => keyOf(r) === activeKey) ?? roots[0] ?? null

  if (analyses.length < 3) {
    return (
      <div className="p-8 max-w-3xl mx-auto text-neutral-400">
        Analyse au moins 3 parties pour voir ton répertoire émerger (regroupé par ouverture et couleur).
      </div>
    )
  }
  if (roots.length === 0) {
    return (
      <div className="p-8 max-w-3xl mx-auto text-neutral-400">
        Aucune ouverture jouée plus d'une fois pour l'instant.
      </div>
    )
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h2 className="text-2xl font-semibold mb-2">Répertoire</h2>
      <p className="text-sm text-neutral-400 mb-4">
        Tes lignes principales par ouverture, construites à partir des parties analysées. Coups les plus joués mis en avant.
      </p>

      <div className="grid lg:grid-cols-[300px_1fr] gap-4">
        <aside className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-3 max-h-[80vh] overflow-auto">
          <h3 className="text-sm font-semibold text-neutral-300 mb-2">Ouvertures</h3>
          <ul className="space-y-1">
            {roots.map(r => {
              const k = keyOf(r)
              return (
                <li key={k}>
                  <button
                    onClick={() => setActiveKey(k)}
                    className={`w-full text-left px-2 py-1.5 rounded text-sm transition-colors ${
                      active && keyOf(active) === k ? 'bg-[var(--color-accent)] text-white' : 'hover:bg-neutral-800 text-neutral-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${r.color === 'white' ? 'bg-neutral-100' : 'bg-neutral-700 border border-neutral-500'}`} />
                      <span className="flex-1 truncate">{r.parent}</span>
                      <span className="text-xs text-neutral-500">{r.total}×</span>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        </aside>

        {active ? (
          <RootDetail key={keyOf(active)} root={active} />
        ) : null}
      </div>
    </div>
  )
}

function RootDetail({ root }: { root: RepertoireRoot }) {
  const main = useMemo(() => topLines(root, 8), [root])
  const [openAt, setOpenAt] = useState<number | null>(null)

  return (
    <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-4 space-y-4">
      <div>
        <h3 className="font-semibold text-lg">{root.parent}</h3>
        <p className="text-xs text-neutral-500">
          {root.total} partie{root.total > 1 ? 's' : ''} avec les {root.color === 'white' ? 'Blancs' : 'Noirs'}
        </p>
      </div>

      <div>
        <h4 className="text-sm font-medium text-neutral-300 mb-2">Ligne principale (la plus jouée à chaque coup)</h4>
        <ol className="space-y-1">
          {main.moves.length === 0 && <li className="text-sm text-neutral-500">Pas assez de données.</li>}
          {main.moves.map((m, i) => {
            const path = main.moves.slice(0, i + 1).map(x => x.san)
            const alts = alternativesAt(root, path).filter(a => a.san !== m.san)
            const isOpen = openAt === i
            return (
              <li key={i} className="text-sm">
                <button
                  className="w-full text-left flex items-center gap-2 hover:bg-neutral-800/50 rounded px-2 py-1"
                  onClick={() => setOpenAt(isOpen ? null : i)}
                >
                  <span className="text-neutral-500 w-7 text-right">{i + 1}.</span>
                  <span className="font-mono">{m.san}</span>
                  <span className="text-xs text-neutral-500 ml-1">×{m.count}</span>
                  <span className="text-xs text-neutral-500">{rollupString({ wins: m.w, losses: m.l, draws: m.d })}</span>
                  {alts.length > 0 && (
                    <span className="text-xs text-blue-400 ml-auto">
                      {isOpen ? '▾' : '▸'} {alts.length} alternative{alts.length > 1 ? 's' : ''}
                    </span>
                  )}
                </button>
                {isOpen && alts.length > 0 && (
                  <ul className="ml-12 mt-1 space-y-1">
                    {alts.slice(0, 6).map(a => (
                      <li key={a.san} className="flex items-baseline gap-2 text-xs text-neutral-400">
                        <span className="font-mono">{a.san}</span>
                        <span className="text-neutral-500">×{a.count}</span>
                        <span className="text-neutral-500">{rollupString(a)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}

function keyOf(r: RepertoireRoot): string { return `${r.parent}::${r.color}` }
