// "Trous du répertoire" panel — surfaces positions where the user has no
// dominant move (i.e. they've split their plays across several choices,
// suggesting they haven't memorised one). Extracted from RepertoireView.

import { useMemo, useState } from 'react'
import { findRepertoireHoles, type RepertoireHole, type RepertoireRoot } from '../analysis/repertoire'
import PositionExplorer from './PositionExplorer'

export default function HolesPanel({ roots }: { roots: RepertoireRoot[] }) {
  const holes = useMemo(() => findRepertoireHoles(roots).slice(0, 5), [roots])
  const [opened, setOpened] = useState<RepertoireHole | null>(null)
  if (holes.length === 0) return null
  return (
    <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-4 mb-3">
      <div className="flex items-baseline justify-between flex-wrap gap-2 mb-3">
        <h3 className="font-semibold">🕳️ Trous du répertoire</h3>
        <span className="text-xs text-neutral-500">
          Positions où tu n'as pas choisi un coup à mémoriser
        </span>
      </div>
      <ul className="space-y-2">
        {holes.map((h, i) => (
          <li
            key={i}
            onClick={() => h.fenBefore && setOpened(h)}
            className={`bg-neutral-900/50 border border-[var(--color-border)] rounded p-3 ${
              h.fenBefore ? 'cursor-pointer hover:border-[var(--color-accent)]/60' : ''
            }`}
          >
            <div className="flex items-baseline gap-2 flex-wrap text-sm">
              <span className="font-medium text-neutral-200">{h.parent}</span>
              <span className="text-xs text-neutral-500">
                {h.color === 'white' ? '♔ Blancs' : '♚ Noirs'} · coup {h.ply}
              </span>
              <span className="ml-auto text-xs text-neutral-500">
                {h.visits} visites · top {(h.topShare * 100).toFixed(0)}%
              </span>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-2 text-xs">
              {h.choices.map((c, j) => (
                <span
                  key={j}
                  className={`px-1.5 py-0.5 rounded font-mono ${
                    j === 0 ? 'bg-neutral-800 text-neutral-100' : 'bg-neutral-900 text-neutral-400'
                  }`}
                  title={`${c.count} parties (${(c.share * 100).toFixed(0)}%)`}
                >{c.san} <span className="opacity-60">{(c.share * 100).toFixed(0)}%</span></span>
              ))}
            </div>
            {(h.avgCpLoss > 30 || h.winRate < 0.4) && (
              <div className="mt-1 text-[10px] text-orange-300">
                {h.avgCpLoss > 30 && <>CPL moyen : {h.avgCpLoss.toFixed(0)} · </>}
                {h.winRate < 0.4 && <>Win rate : {(h.winRate * 100).toFixed(0)}%</>}
              </div>
            )}
          </li>
        ))}
      </ul>
      <p className="text-[10px] text-neutral-500 mt-3">
        Choisis UN coup, drill-le dans l'onglet SRS et c'est plié. Mieux vaut un coup correct mémorisé qu'un choix aléatoire à chaque partie.
      </p>
      {opened && opened.fenBefore && (
        <PositionExplorer
          fen={opened.fenBefore.split(' ').length >= 4
            ? opened.fenBefore
            : opened.fenBefore + ' - - 0 1'}
          onClose={() => setOpened(null)}
          playedSan={opened.choices[0]?.san}
          title={`${opened.parent} · coup ${opened.ply}`}
        />
      )}
    </div>
  )
}
