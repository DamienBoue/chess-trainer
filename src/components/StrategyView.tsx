// Strategy: the player's strategic profile, the positional trainer and the
// atlas of pawn structures. In the app navigation these are three entries in
// three different parts (Progrès → Profil stratégique, Entraînement →
// Entraîneur stratégique, Théorie → Structures de pions), each reached from
// its own entry: there is no tab strip here, and the page title follows the
// current `tab`, which the app drives. The few in-content links that cross
// over (a structure of the profile → the atlas) go through `onTabChange` like
// a menu entry would, and offer the way back.

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

/** Each tab is a page of its own: its title is the label of its menu entry. */
const PAGES: Record<StrategyTab, { title: string; description: string }> = {
  profile: {
    title: 'Profil stratégique',
    description: 'Tes structures, tes types de centre, tes concessions récurrentes et tes plans manqués.',
  },
  trainer: {
    title: 'Entraîneur stratégique',
    description: 'Quel plan ? Quelle case forte ? Quelle structure ? Des exercices de lecture de position tirés de tes parties.',
  },
  atlas: {
    title: 'Structures de pions',
    description: 'Les grandes structures de pions, leurs plans types et leurs cases clés : comprendre la position, pas seulement le coup.',
  },
}

export default function StrategyView({ analyses, onOpenGame, tab: controlledTab, onTabChange }: Props) {
  const [ownTab, setOwnTab] = useState<StrategyTab>(analyses.length > 0 ? 'profile' : 'atlas')
  const tab = controlledTab ?? ownTab
  const setTab = (t: StrategyTab) => { setOwnTab(t); onTabChange?.(t) }
  // A structure picked in the profile: the atlas opens on it and offers the
  // way back. Dropped as soon as the atlas is left, so reaching the atlas
  // from its own menu entry always opens it fresh.
  const [fromProfile, setFromProfile] = useState<string | undefined>()
  const [prevTab, setPrevTab] = useState(tab)
  if (prevTab !== tab) {
    setPrevTab(tab)
    if (tab !== 'atlas') setFromProfile(undefined)
  }
  const reviews = useStrategyReviews(analyses)
  const structureStats = useMemo(() => {
    if (!reviews.ready || analyses.length === 0) return []
    return buildStrategyProfile(analyses, a => reviews.reviews.get(a.url)!).structures
  }, [analyses, reviews])

  const page = PAGES[tab]

  return (
    <div className="p-4 lg:p-6 max-w-6xl mx-auto">
      <header className="mb-4">
        <h2 className="text-2xl font-semibold">{page.title}</h2>
        <p className="text-sm text-neutral-400">{page.description}</p>
      </header>

      {tab === 'profile' && (analyses.length === 0 ? (
        <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-4 text-sm text-neutral-300">
          Analyse quelques parties (dans Parties) pour obtenir ton profil stratégique. En attendant, découvre les <button onClick={() => setTab('atlas')} className="underline">structures de pions</button>.
        </div>
      ) : (
        <StrategyProfilePanel
          analyses={analyses}
          reviews={reviews}
          onOpenGame={onOpenGame}
          onOpenStructure={id => { setFromProfile(id); setTab('atlas') }}
        />
      ))}
      {tab === 'trainer' && <StrategyTrainer analyses={analyses} reviews={reviews} onOpenGame={onOpenGame} />}
      {tab === 'atlas' && (
        <>
          {fromProfile && (
            <button onClick={() => setTab('profile')} className="mb-3 text-sm text-neutral-400 hover:text-white">
              ← Retour au profil stratégique
            </button>
          )}
          <StructureAtlas key={fromProfile} stats={structureStats} initialId={fromProfile} />
        </>
      )}
    </div>
  )
}
