import { useMemo } from 'react'
import type { GameAnalysis } from '../types'
import { aggregate, deriveInsights } from '../analysis/aggregate'
import { CLASSIFICATION_COLORS, CLASSIFICATION_LABELS } from '../analysis/classify'

interface Props {
  analyses: GameAnalysis[]
}

export default function StatsView({ analyses }: Props) {
  const stats = useMemo(() => aggregate(analyses), [analyses])
  const insights = useMemo(() => deriveInsights(stats), [stats])

  if (analyses.length === 0) {
    return (
      <div className="p-8 max-w-3xl mx-auto text-neutral-400">
        Aucune partie analysée pour l'instant. Va dans l'onglet "Parties" et clique sur une partie pour lancer son analyse.
      </div>
    )
  }

  const totalUserMistakes =
    stats.byClass.blunder + stats.byClass.mistake + stats.byClass.inaccuracy
  const classOrder: (keyof typeof stats.byClass)[] = ['best', 'great', 'good', 'inaccuracy', 'mistake', 'blunder', 'book']

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <h2 className="text-2xl font-semibold">Bilan global ({stats.gamesAnalyzed} parties)</h2>

      {insights.length > 0 && (
        <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-4">
          <h3 className="font-semibold mb-3">Points clés</h3>
          <ul className="space-y-2 text-sm">
            {insights.map((i, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span
                  className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${
                    i.kind === 'strength' ? 'bg-green-500'
                    : i.kind === 'weakness' ? 'bg-red-500'
                    : 'bg-neutral-500'
                  }`}
                />
                <span>{i.text}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-4">
          <h3 className="font-semibold mb-3">Distribution des coups (toi + adversaires)</h3>
          <div className="space-y-2">
            {classOrder.map(c => {
              const n = stats.byClass[c]
              const pct = stats.totalMoves ? (n / stats.totalMoves) * 100 : 0
              return (
                <div key={c} className="text-sm">
                  <div className="flex justify-between text-xs text-neutral-400 mb-1">
                    <span>{CLASSIFICATION_LABELS[c]}</span>
                    <span>{n} · {pct.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-neutral-900 rounded h-2 overflow-hidden">
                    <div
                      className="h-full"
                      style={{ width: `${pct}%`, backgroundColor: CLASSIFICATION_COLORS[c] }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-4">
          <h3 className="font-semibold mb-3">Erreurs par phase de jeu</h3>
          <table className="w-full text-sm">
            <thead className="text-neutral-500 text-xs">
              <tr><th className="text-left font-normal">Phase</th><th>Inex.</th><th>Erreurs</th><th>Gaffes</th></tr>
            </thead>
            <tbody>
              {(['opening', 'middlegame', 'endgame'] as const).map(phase => (
                <tr key={phase}>
                  <td className="py-1 capitalize">{phase === 'opening' ? 'Ouverture' : phase === 'middlegame' ? 'Milieu' : 'Finale'}</td>
                  <td className="text-center" style={{ color: CLASSIFICATION_COLORS.inaccuracy }}>{stats.inaccuraciesByPhase[phase]}</td>
                  <td className="text-center" style={{ color: CLASSIFICATION_COLORS.mistake }}>{stats.mistakesByPhase[phase]}</td>
                  <td className="text-center" style={{ color: CLASSIFICATION_COLORS.blunder }}>{stats.blundersByPhase[phase]}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-3 text-xs text-neutral-500">
            Total : {totalUserMistakes} coups imprécis (toutes phases, joueurs confondus).
          </div>
        </div>

        <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-4">
          <h3 className="font-semibold mb-1">Précision moyenne</h3>
          <p className="text-xs text-neutral-500 mb-3">
            Combien de "petits-pions" tu perds en moyenne par coup vs le meilleur coup de Stockfish (1 cp = 0.01 pion).
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-3xl font-bold text-green-400">{stats.avgCpLossUser.toFixed(0)}<span className="text-sm font-normal text-neutral-500 ml-1">cp</span></div>
              <div className="text-xs text-neutral-500">Toi</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-neutral-300">{stats.avgCpLossOpponent.toFixed(0)}<span className="text-sm font-normal text-neutral-500 ml-1">cp</span></div>
              <div className="text-xs text-neutral-500">Adversaires</div>
            </div>
          </div>
          <p className="text-xs text-neutral-500 mt-3 leading-relaxed">
            Plus c'est bas, mieux c'est.<br />
            <span className="text-green-400">~20-30</span> niveau maître ·{' '}
            <span className="text-neutral-300">30-60</span> joueur solide ·{' '}
            <span className="text-orange-400">60-100</span> joueur club ·{' '}
            <span className="text-red-400">100+</span> à améliorer
          </p>
        </div>

        <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-4">
          <h3 className="font-semibold mb-3">Résultats par couleur</h3>
          <div className="space-y-2">
            {(['white', 'black'] as const).map(color => {
              const r = stats.resultsByColor[color]
              const total = r.w + r.l + r.d
              return (
                <div key={color} className="text-sm">
                  <div className="flex justify-between mb-1">
                    <span>{color === 'white' ? 'Blancs' : 'Noirs'}</span>
                    <span className="text-neutral-500">{r.w}V / {r.l}D / {r.d}N</span>
                  </div>
                  {total > 0 && (
                    <div className="flex h-2 rounded overflow-hidden bg-neutral-900">
                      <div className="bg-green-500" style={{ width: `${(r.w / total) * 100}%` }} />
                      <div className="bg-neutral-500" style={{ width: `${(r.d / total) * 100}%` }} />
                      <div className="bg-red-500" style={{ width: `${(r.l / total) * 100}%` }} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-4">
        <h3 className="font-semibold mb-3">Ouvertures jouées</h3>
        {stats.openings.length === 0 ? (
          <p className="text-sm text-neutral-500">Pas encore de données.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-neutral-500 text-xs border-b border-[var(--color-border)]">
              <tr>
                <th className="text-left font-normal py-2">Ouverture</th>
                <th className="text-center font-normal">ECO</th>
                <th className="text-center font-normal">Parties</th>
                <th className="text-center font-normal">% Victoire</th>
              </tr>
            </thead>
            <tbody>
              {stats.openings.slice(0, 15).map(o => {
                const winRate = o.played ? (o.wins / o.played) * 100 : 0
                return (
                  <tr key={o.name} className="border-b border-[var(--color-border)] last:border-0">
                    <td className="py-1.5">{o.name}</td>
                    <td className="text-center text-neutral-500 font-mono text-xs">{o.ecoCode || '—'}</td>
                    <td className="text-center">{o.played}</td>
                    <td className="text-center">
                      <span className={winRate >= 50 ? 'text-green-400' : winRate >= 33 ? 'text-neutral-300' : 'text-red-400'}>
                        {winRate.toFixed(0)}%
                      </span>
                      <span className="text-xs text-neutral-500 ml-1">({o.wins}/{o.played})</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
