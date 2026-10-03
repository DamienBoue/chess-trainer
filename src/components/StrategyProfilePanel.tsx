// "Mon profil stratégique": where the player struggles positionally across
// all analysed games — structures, types of centre, recurring structural
// concessions, missed plans — with links back to the games.

import { useMemo } from 'react'
import type { GameAnalysis } from '../types'
import { buildStrategyProfile, type StrategyProfile } from '../strategy/profile'
import type { ReviewsState } from './useStrategyReviews'
import ConceptChip from './ConceptChip'

interface Props {
  analyses: GameAnalysis[]
  reviews: ReviewsState
  onOpenGame: (url: string, ply?: number) => void
  onOpenStructure: (id: string) => void
}

export default function StrategyProfilePanel({ analyses, reviews, onOpenGame, onOpenStructure }: Props) {
  const profile = useMemo<StrategyProfile | null>(() => {
    if (!reviews.ready) return null
    return buildStrategyProfile(analyses, a => {
      const r = reviews.reviews.get(a.url)
      if (!r) throw new Error('missing review')
      return r
    })
  }, [analyses, reviews])

  if (!profile) {
    return (
      <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-4">
        <p className="text-sm text-neutral-300 mb-2">Lecture stratégique de tes parties… {reviews.done}/{reviews.total}</p>
        <div className="w-full bg-neutral-900 rounded-full h-2 overflow-hidden">
          <div className="h-full bg-[var(--color-accent)] transition-all" style={{ width: `${(reviews.done / Math.max(1, reviews.total)) * 100}%` }} />
        </div>
      </div>
    )
  }

  const gameLabel = (url: string) => {
    const a = analyses.find(x => x.url === url)
    return a ? `vs ${a.opponent}` : 'partie'
  }

  return (
    <div className="space-y-4">
      <section className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-4">
        <h3 className="font-semibold mb-2">À retenir</h3>
        {profile.headlines.length === 0 ? (
          <p className="text-sm text-neutral-400">
            Pas encore de tendance nette sur {profile.games} partie{profile.games > 1 ? 's' : ''}. Analyse davantage de parties pour faire émerger tes points forts et tes faiblesses stratégiques.
          </p>
        ) : (
          <ul className="space-y-2">
            {profile.headlines.map((h, i) => (
              <li key={i} className="text-sm text-neutral-200 flex gap-2"><span className="text-[var(--color-accent)]">▸</span>{h}</li>
            ))}
          </ul>
        )}
        <p className="text-xs text-neutral-500 mt-3">
          {profile.games} parties · {profile.moves} coups joués · {Math.round(profile.avgCpLoss)} cp perdus par coup en moyenne.
        </p>
      </section>

      <section className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-4">
        <h3 className="font-semibold mb-1">Tes structures</h3>
        <p className="text-xs text-neutral-500 mb-3">Les structures de pions qui ont tenu au moins 4 demi-coups, et ce que tu y fais.</p>
        {profile.structures.length === 0 ? (
          <p className="text-sm text-neutral-500">Aucune structure type reconnue pour l'instant.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs text-neutral-500">
              <tr>
                <th className="text-left font-normal pb-1">Structure</th>
                <th className="text-right font-normal">Parties</th>
                <th className="text-left font-normal pl-4 w-1/4">Score</th>
                <th className="text-right font-normal">cp/coup</th>
              </tr>
            </thead>
            <tbody>
              {profile.structures.map(s => (
                <tr key={`${s.id}:${s.role}`} className="border-t border-[var(--color-border)]">
                  <td className="py-1.5 pr-2">
                    <button onClick={() => onOpenStructure(s.id)} className="text-left hover:text-white text-neutral-200">
                      {s.name}
                    </button>
                    <div className="text-[11px] text-neutral-500">{s.roleLabel}</div>
                  </td>
                  <td className="text-right text-neutral-300">{s.games}</td>
                  <td className="pl-4">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-neutral-800 rounded overflow-hidden">
                        <div className="h-full rounded" style={{ width: `${s.score * 100}%`, backgroundColor: s.score >= 0.55 ? '#5fa052' : s.score >= 0.45 ? '#e6c34d' : '#d04a4a' }} />
                      </div>
                      <span className="text-xs text-neutral-400 w-9 text-right">{Math.round(s.score * 100)}%</span>
                    </div>
                  </td>
                  <td className="text-right text-neutral-300">{Math.round(s.avgCpLoss)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {profile.centers.length > 0 && (
        <section className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-4">
          <div className="flex items-baseline justify-between gap-2 mb-1">
            <h3 className="font-semibold">Selon le type de centre</h3>
            <ConceptChip id="center-types" />
          </div>
          <p className="text-xs text-neutral-500 mb-3">Centipions perdus par coup selon la nature du centre au moment où tu joues. La ligne = ta moyenne.</p>
          <ul className="space-y-2">
            {profile.centers.map(c => {
              const max = Math.max(...profile.centers.map(x => x.avgCpLoss), profile.avgCpLoss, 1)
              const worse = c.avgCpLoss > profile.avgCpLoss * 1.15
              return (
                <li key={c.type}>
                  <div className="flex justify-between text-sm mb-0.5">
                    <span className="text-neutral-200">{c.label} <span className="text-[11px] text-neutral-500">· {c.moves} coups</span></span>
                    <span className={`font-mono text-xs ${worse ? 'text-red-300' : 'text-neutral-400'}`}>{Math.round(c.avgCpLoss)} cp/coup</span>
                  </div>
                  <div className="relative h-1.5 bg-neutral-800 rounded">
                    <div className="h-full rounded" style={{ width: `${(c.avgCpLoss / max) * 100}%`, backgroundColor: worse ? '#d04a4a' : '#5b88ba' }} />
                    <div className="absolute -top-0.5 h-2.5 w-px bg-white/60" style={{ left: `${(profile.avgCpLoss / max) * 100}%` }} />
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <section className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-4">
          <h3 className="font-semibold mb-1">Concessions structurelles</h3>
          <p className="text-xs text-neutral-500 mb-3">Ce que tes coups ont abîmé dans ta structure — comparé à tes adversaires.</p>
          {profile.habits.length === 0 ? (
            <p className="text-sm text-neutral-500">Rien à signaler.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs text-neutral-500">
                <tr><th className="text-left font-normal pb-1">Type</th><th className="text-right font-normal">Toi</th><th className="text-right font-normal">dont coûteux</th><th className="text-right font-normal">Adv.</th></tr>
              </thead>
              <tbody>
                {profile.habits.map(h => (
                  <tr key={h.kind} className="border-t border-[var(--color-border)]">
                    <td className="py-1.5">{h.label} {h.conceptId && <ConceptChip id={h.conceptId} iconOnly />}</td>
                    <td className={`text-right ${h.count > h.oppCount ? 'text-red-300' : 'text-neutral-300'}`}>{h.count}</td>
                    <td className="text-right text-neutral-400">{h.costly}</td>
                    <td className="text-right text-neutral-500">{h.oppCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-4">
          <h3 className="font-semibold mb-1">Plans manqués</h3>
          <p className="text-xs text-neutral-500 mb-3">Positions où le moteur lançait un plan reconnaissable et où ton coup a coûté ≥ 60 cp.</p>
          {profile.missed.length === 0 ? (
            <p className="text-sm text-neutral-500">Aucun plan manqué détecté.</p>
          ) : (
            <ul className="space-y-2.5">
              {profile.missed.map(m => (
                <li key={m.kind}>
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="text-neutral-200">{m.label} {m.conceptId && <ConceptChip id={m.conceptId} iconOnly />}</span>
                    <span className="text-xs text-neutral-400 shrink-0">{m.count}× · {m.totalCp} cp</span>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {m.examples.map((ex, i) => (
                      <button
                        key={i}
                        onClick={() => onOpenGame(ex.url, ex.ply)}
                        title={ex.title}
                        className="text-[11px] px-1.5 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300"
                      >{gameLabel(ex.url)} · coup {Math.ceil((ex.ply + 1) / 2)}</button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
