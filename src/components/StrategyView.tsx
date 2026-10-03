// "Stratégie" hub: the player's strategic profile, the positional trainer
// and the atlas of pawn structures.

import { useMemo, useState } from 'react'
import type { GameAnalysis } from '../types'
import { useStrategyReviews } from './useStrategyReviews'
import StrategyProfilePanel from './StrategyProfilePanel'
import StrategyTrainer from './StrategyTrainer'
import StructureAtlas from './StructureAtlas'
import { buildStrategyProfile } from '../strategy/profile'

export type StrategyTab = 'profile' | 'trainer' | 'atlas'

interface Props {
  analyses: GameAnalysis[]
  onOpenGame: (url: string, ply?: number) => void
  /** Controlled tab (driven by the app navigation); uncontrolled when omitted. */
  tab?: StrategyTab
  onTabChange?: (t: StrategyTab) => void
}

const TABS: { id: StrategyTab; label: string; hint: string }[] = [
  { id: 'profile', label: 'Mon profil', hint: 'Tes structures, tes types de centre, tes concessions récurrentes' },
  { id: 'trainer', label: 'S\'entraîner', hint: 'Exercices de lecture de position tirés de tes parties' },
  { id: 'atlas', label: 'Structures', hint: 'Les grandes structures de pions et leurs plans' },
]

export default function StrategyView({ analyses, onOpenGame, tab: controlledTab, onTabChange }: Props) {
  const [ownTab, setOwnTab] = useState<StrategyTab>(analyses.length > 0 ? 'profile' : 'atlas')
  const tab = controlledTab ?? ownTab
  const setTab = (t: StrategyTab) => { setOwnTab(t); onTabChange?.(t) }
  const [atlasId, setAtlasId] = useState<string | undefined>()
  const reviews = useStrategyReviews(analyses)
  const structureStats = useMemo(() => {
    if (!reviews.ready || analyses.length === 0) return []
    return buildStrategyProfile(analyses, a => reviews.reviews.get(a.url)!).structures
  }, [analyses, reviews])

  return (
    <div className="p-4 lg:p-6 max-w-6xl mx-auto">
      <header className="mb-4">
        <h2 className="text-2xl font-bold">Stratégie</h2>
        <p className="text-sm text-neutral-400">Structures de pions, cases fortes et faibles, plans : comprendre la position, pas seulement le coup.</p>
      </header>
      <div role="tablist" aria-label="Stratégie" className="flex gap-1 border-b border-[var(--color-border)] mb-4">
        {TABS.map(t => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            title={t.hint}
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 text-sm -mb-px border-b-2 ${tab === t.id ? 'border-[var(--color-accent)] text-white' : 'border-transparent text-neutral-400 hover:text-neutral-200'}`}
          >{t.label}</button>
        ))}
      </div>

      {tab === 'profile' && (analyses.length === 0 ? (
        <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-4 text-sm text-neutral-300">
          Analyse quelques parties (onglet Parties) pour obtenir ton profil stratégique. En attendant, découvre les structures dans l'onglet <button onClick={() => setTab('atlas')} className="underline">Structures</button>.
        </div>
      ) : (
        <StrategyProfilePanel
          analyses={analyses}
          reviews={reviews}
          onOpenGame={onOpenGame}
          onOpenStructure={id => { setAtlasId(id); setTab('atlas') }}
        />
      ))}
      {tab === 'trainer' && <StrategyTrainer analyses={analyses} reviews={reviews} onOpenGame={onOpenGame} />}
      {tab === 'atlas' && <StructureAtlas key={atlasId} stats={structureStats} initialId={atlasId} />}
    </div>
  )
}
