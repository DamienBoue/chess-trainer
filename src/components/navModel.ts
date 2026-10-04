// Single source of truth for the app navigation, shared by the mobile tab
// bar, the desktop header, the hub pages, the "up" links and the command
// palette. Five parts, as in the chess.com and Lichess mobile apps (each a
// tab on phones; a part with several tools opens a hub page listing them):
//   Aujourd'hui  — what do I do now?
//   Parties      — analyse my games
//   Entraînement — practise: drills from my games, strategy quizzes, play
//   Théorie      — study: openings, structures, concepts, books
//   Progrès      — where do I stand, what to fix
// An entry that needs data explains why (with progress) instead of
// silently greying out. A page's title is its entry's label, everywhere.

import type { StrategyTab } from './StrategyView'

export interface NavCounts {
  analyses: number
  exercises: number
  due: number
}

export interface NavTarget {
  view: string
  strategyTab?: StrategyTab
}

export interface NavItemDef {
  key: string
  label: string
  description: string
  /** Hub card icon. */
  icon: string
  target: NavTarget
  /** Short live status ("14 à revoir"), or null. */
  status?: (c: NavCounts) => string | null
  /** Why the entry is unavailable, or null when it is. */
  unavailable?: (c: NavCounts) => string | null
  /** Views (besides target.view) that light this entry up. */
  alsoActiveOn?: string[]
}

export interface NavSection {
  label?: string
  items: NavItemDef[]
}

export interface NavGroupDef {
  key: string
  label: string
  /** The view of the group's hub page. */
  hub: string
  /** One line under the hub title. */
  intro: string
  sections: NavSection[]
  /** The entry to put forward at the top of the hub, if any. */
  recommend?: (c: NavCounts) => { key: string; why: string } | null
}

export type NavEntry = { kind: 'item'; item: NavItemDef } | { kind: 'group'; group: NavGroupDef }

const needGames = (n: number) => (c: NavCounts) =>
  (c.analyses >= n ? null : `Analyse au moins ${n} partie${n > 1 ? 's' : ''} (${c.analyses}/${n})`)
const needExercises = (n: number) => (c: NavCounts) =>
  (c.exercises >= n ? null : `Il faut ${n} exercice${n > 1 ? 's' : ''} tirés de tes erreurs (${c.exercises}/${n})`)

export const NAV: NavEntry[] = [
  { kind: 'item', item: { key: 'home', label: 'Aujourd\'hui', icon: '☀️', description: 'Ta séance du jour.', target: { view: 'home' } } },
  { kind: 'item', item: { key: 'games', label: 'Parties', icon: '♟️', description: 'Tes parties chess.com et leur analyse.', target: { view: 'games' }, alsoActiveOn: ['analysis'] } },
  {
    kind: 'group',
    group: {
      key: 'train',
      label: 'Entraînement',
      hub: 'trainHub',
      intro: 'La pratique, tirée de tes propres parties.',
      recommend: c => {
        if (c.due > 0) return { key: 'exercises', why: `${c.due} exercice${c.due > 1 ? 's' : ''} à revoir aujourd'hui` }
        if (c.exercises >= 5) return { key: 'rush', why: 'Rien à revoir : garde le rythme contre la montre' }
        return null
      },
      sections: [
        {
          label: 'Tes erreurs',
          items: [
            {
              key: 'exercises', label: 'Exercices', icon: '🎯', description: 'Tes propres erreurs en répétition espacée.', target: { view: 'exercises' },
              status: c => (c.due > 0 ? `${c.due} à revoir` : null), unavailable: needExercises(1),
            },
            { key: 'daily', label: 'Puzzle du jour', icon: '📅', description: 'Une position par jour, pour la série.', target: { view: 'daily' }, unavailable: needExercises(1) },
            { key: 'rush', label: 'Puzzle Rush', icon: '⏱️', description: 'Contre la montre sur tes exercices.', target: { view: 'rush' }, unavailable: needExercises(5) },
            { key: 'blunder', label: 'Réflexe anti-gaffe', icon: '🛡️', description: 'Repère la menace en 5 secondes.', target: { view: 'blunder' }, unavailable: needExercises(3) },
            { key: 'calc', label: 'Calcul de séquence', icon: '🧮', description: 'Mats en N et tactiques forcées, sans bouger les pièces.', target: { view: 'calc' }, unavailable: needExercises(3) },
          ],
        },
        {
          label: 'Stratégie et jeu',
          items: [
            { key: 'strategy-trainer', label: 'Entraîneur stratégique', icon: '🧭', description: 'Quel plan ? Quelle case forte ? Quelle structure ?', target: { view: 'strategy', strategyTab: 'trainer' } },
            { key: 'play', label: 'Jouer contre Stockfish', icon: '🤖', description: 'Une partie d\'entraînement contre le moteur, à ton niveau.', target: { view: 'play' } },
          ],
        },
      ],
    },
  },
  {
    kind: 'group',
    group: {
      key: 'theory',
      label: 'Théorie',
      hub: 'theoryHub',
      intro: 'Comprendre avant de répéter : ouvertures, structures, concepts.',
      sections: [
        {
          label: 'Ouvertures',
          items: [
            { key: 'repertoire', label: 'Mon répertoire', icon: '📖', description: 'Tes lignes, leurs trous et leurs critiques.', target: { view: 'repertoire' }, unavailable: needGames(3) },
            { key: 'openingLab', label: 'Labo d\'ouvertures', icon: '🔬', description: 'Ta ligne la plus jouée comparée à celle des maîtres.', target: { view: 'openingLab' }, unavailable: needGames(3) },
            { key: 'reverseDrill', label: 'Ouvertures en miroir', icon: '🪞', description: 'Rejoue tes ouvertures avec l\'autre couleur.', target: { view: 'reverseDrill' }, unavailable: needGames(3) },
          ],
        },
        {
          label: 'Comprendre le jeu',
          items: [
            { key: 'strategy-atlas', label: 'Structures de pions', icon: '🧱', description: 'Les grandes structures et leurs plans types.', target: { view: 'strategy', strategyTab: 'atlas' } },
            { key: 'concepts', label: 'Concepts', icon: '💡', description: 'Fiches de théorie : tactique, stratégie, finales.', target: { view: 'concepts' } },
            { key: 'library', label: 'Bibliothèque', icon: '📚', description: 'Tes livres importés et leurs positions clés.', target: { view: 'library' }, alsoActiveOn: ['book'] },
          ],
        },
        {
          label: 'Préparer une partie',
          items: [
            { key: 'scouting', label: 'Préparer un adversaire', icon: '🔍', description: 'Son répertoire et ses habitudes avant de l\'affronter.', target: { view: 'scouting' } },
            { key: 'players', label: 'Joueurs (PGN)', icon: '🗂️', description: 'Étudie des joueurs hors chess.com à partir de PGN.', target: { view: 'players' } },
          ],
        },
      ],
    },
  },
  {
    kind: 'group',
    group: {
      key: 'progress',
      label: 'Progrès',
      hub: 'progressHub',
      intro: 'Où tu en es, et quoi travailler en priorité.',
      sections: [
        {
          items: [
            { key: 'roadmap', label: 'Mon niveau', icon: '🏔️', description: 'Ta tranche Elo et les modules à valider pour la suivante.', target: { view: 'roadmap' } },
            {
              key: 'stats', label: 'Statistiques', icon: '📊', description: 'Précision, phases, motifs tactiques, ouvertures.', target: { view: 'stats' },
              status: c => (c.analyses > 0 ? `${c.analyses} partie${c.analyses > 1 ? 's' : ''}` : null), unavailable: needGames(1),
            },
            { key: 'strategy-profile', label: 'Profil stratégique', icon: '🧩', description: 'Tes structures, tes types de centre, tes plans manqués.', target: { view: 'strategy', strategyTab: 'profile' }, unavailable: needGames(1) },
          ],
        },
        {
          label: 'Se comparer',
          items: [
            { key: 'compare', label: 'Comparer avec un ami', icon: '👥', description: 'Forces et faiblesses croisées avec un autre joueur.', target: { view: 'compare' } },
          ],
        },
      ],
    },
  },
]

export function groupItems(group: NavGroupDef): NavItemDef[] {
  return group.sections.flatMap(s => s.items)
}

const GROUPS = NAV.flatMap(e => (e.kind === 'group' ? [e.group] : []))

/** Every navigable entry, with the label of its group (for the palette). */
export function allNavItems(): { item: NavItemDef; group?: string }[] {
  return NAV.flatMap(e => e.kind === 'item'
    ? [{ item: e.item }]
    : groupItems(e.group).map(item => ({ item, group: e.group.label })))
}

export function hubGroup(view: string): NavGroupDef | undefined {
  return GROUPS.find(g => g.hub === view)
}

export function isItemActive(item: NavItemDef, view: string, strategyTab?: StrategyTab): boolean {
  if (item.target.view === 'strategy') return view === 'strategy' && item.target.strategyTab === strategyTab
  return item.target.view === view || (item.alsoActiveOn ?? []).includes(view)
}

export function isGroupActive(group: NavGroupDef, view: string, strategyTab?: StrategyTab): boolean {
  return group.hub === view || groupItems(group).some(i => isItemActive(i, view, strategyTab))
}

/** A screen of the app, as the header and the "up" link name it. */
export interface Screen {
  title: string
  target: NavTarget
}

/** The screen one level up (hub of the tool, list of the game…), or null
 *  on the top-level screens (the five parts and the settings). */
export function parentOf(view: string, strategyTab?: StrategyTab): Screen | null {
  if (view === 'analysis') return { title: 'Parties', target: { view: 'games' } }
  if (view === 'book') return { title: 'Bibliothèque', target: { view: 'library' } }
  for (const g of GROUPS) {
    if (groupItems(g).some(i => i.target.view === view && (view !== 'strategy' || i.target.strategyTab === strategyTab))) {
      return { title: g.label, target: { view: g.hub } }
    }
  }
  return null
}

/** The title of a screen: its entry's label. */
export function titleOf(view: string, strategyTab?: StrategyTab): string | null {
  const g = hubGroup(view)
  if (g) return g.label
  if (view === 'settings') return 'Préférences'
  for (const { item } of allNavItems()) {
    if (item.target.view === view && (view !== 'strategy' || item.target.strategyTab === strategyTab)) return item.label
  }
  return null
}

/** Views whose content depends on the global time-control / colour filter. */
export const FILTERED_VIEWS = new Set([
  'stats', 'repertoire', 'openingLab', 'exercises', 'rush', 'daily', 'roadmap', 'blunder', 'calc', 'reverseDrill', 'strategy',
])
