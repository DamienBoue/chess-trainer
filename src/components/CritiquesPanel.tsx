// Repertoire critiques: habitual moves that bleed cpLoss or have a bad
// score. Extracted from RepertoireView.

import { rollupString, type RepertoireCritique } from '../analysis/repertoire'

export default function CritiquesPanel({ critiques }: { critiques: RepertoireCritique[] }) {
  if (critiques.length === 0) {
    return (
      <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-6 text-sm text-neutral-400">
        Aucun mauvais réflexe détecté pour l'instant. Continue à analyser des parties pour que des habitudes se dessinent.
      </div>
    )
  }
  return (
    <div className="space-y-3">
      <p className="text-sm text-neutral-400">
        Des coups que tu joues souvent mais qui méritent d'être étudiés : soit Stockfish n'est pas d'accord (perte cp moyenne élevée), soit ton score y est mauvais.
      </p>
      <ul className="space-y-3">
        {critiques.slice(0, 12).map((c, i) => (
          <li key={i} className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-3">
            <div className="flex items-baseline justify-between gap-3 flex-wrap">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="font-medium">{c.parent}</span>
                <span className={`text-xs px-2 py-0.5 rounded ${c.color === 'white' ? 'bg-neutral-100/10 text-neutral-200' : 'bg-neutral-700/50 text-neutral-300'}`}>
                  {c.color === 'white' ? 'Blancs' : 'Noirs'}
                </span>
                <span className="text-xs text-neutral-500">après {c.oppPrev === '<start>' ? 'le début' : c.oppPrev} · coup {c.ply}</span>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded ${
                c.reason === 'high-cploss' ? 'bg-orange-500/20 text-orange-300'
                : c.reason === 'low-winrate' ? 'bg-red-500/20 text-red-300'
                : 'bg-purple-500/20 text-purple-300'
              }`}>
                {c.reason === 'high-cploss' ? 'Imprécis' : c.reason === 'low-winrate' ? 'Mauvais score' : 'Imprécis + mauvais score'}
              </span>
            </div>
            <div className="mt-2 text-sm">
              Tu joues d'habitude <span className="font-mono text-neutral-100">{c.san}</span> ({c.count}×, {rollupString({ wins: 0, losses: 0, draws: 0 })}…
              <span className="text-neutral-500"> CPL moyen {c.avgCpLoss.toFixed(0)} cp · WR {(c.winRate * 100).toFixed(0)}% sur {c.total} parties</span>).
              {c.engineSuggestion && (
                <div className="text-xs text-neutral-400 mt-1">
                  Stockfish a souvent préféré <span className="font-mono text-green-400">{c.engineSuggestion.san}</span> ({c.engineSuggestion.count}× dans tes parties).
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
