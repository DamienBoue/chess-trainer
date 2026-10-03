// Single source of truth for the app navigation, shared by the desktop
// header, the mobile sheet and the command palette. Five entries, each
// answering one question (Lichess has 6, chess.com 7, En Croissant 5):
//   Aujourd'hui  — what do I do now?
//   Parties      — analyse a game
//   S'entraîner  — practise (drills from my games, strategy, theory)
//   Progresser   — where do I stand, what to fix
//   Ouvertures   — my repertoire and my preparation
// An entry that needs data explains why (with progress) instead of
// silently greying out.

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
  label: (c: NavCounts) => string
  description: string
  target: NavTarget
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
  sections: NavSection[]
}

export type NavEntry = { kind: 'item'; item: NavItemDef } | { kind: 'group'; group: NavGroupDef }

const needGames = (n: number) => (c: NavCounts) =>
  (c.analyses >= n ? null : `Analyse au moins ${n} partie${n > 1 ? 's' : ''} (${c.analyses}/${n})`)
const needExercises = (n: number) => (c: NavCounts) =>
  (c.exercises >= n ? null : `Il faut ${n} exercice${n > 1 ? 's' : ''} tirés de tes erreurs (${c.exercises}/${n})`)

export const NAV: NavEntry[] = [
  { kind: 'item', item: { key: 'home', label: () => 'Aujourd\'hui', description: 'Ta séance du jour.', target: { view: 'home' }, alsoActiveOn: ['daily'] } },
  { kind: 'item', item: { key: 'games', label: () => 'Parties', description: 'Tes parties chess.com et leur analyse.', target: { view: 'games' }, alsoActiveOn: ['analysis'] } },
  {
    kind: 'group',
    group: {
      key: 'train',
      label: 'S\'entraîner',
      sections: [
        {
          label: 'Réviser mes erreurs',
          items: [
            { key: 'exercises', label: c => `Exercices${c.due > 0 ? ` (${c.due} à revoir)` : ''}`, description: 'Tes propres erreurs en répétition espacée.', target: { view: 'exercises' }, unavailable: needExercises(1) },
            { key: 'rush', label: () => 'Puzzle Rush', description: 'Contre la montre sur tes exercices.', target: { view: 'rush' }, unavailable: needExercises(5) },
            { key: 'blunder', label: () => 'Réflexe anti-gaffe', description: 'Repère la menace en 5 secondes.', target: { view: 'blunder' }, unavailable: needExercises(3) },
            { key: 'calc', label: () => 'Calcul de séquence', description: 'Mats en N et tactiques forcées, sans bouger les pièces.', target: { view: 'calc' }, unavailable: needExercises(3) },
          ],
        },
        {
          label: 'Stratégie',
          items: [
            { key: 'strategy-trainer', label: () => 'Entraîneur stratégique', description: 'Quel plan ? Quelle case forte ? Quelle structure ?', target: { view: 'strategy', strategyTab: 'trainer' } },
            { key: 'strategy-atlas', label: () => 'Structures de pions', description: 'Les grandes structures et leurs plans types.', target: { view: 'strategy', strategyTab: 'atlas' } },
          ],
        },
        {
          label: 'Jouer et théorie',
          items: [
            { key: 'play', label: () => 'Jouer contre Stockfish', description: 'Une partie d\'entraînement contre le moteur.', target: { view: 'play' } },
            { key: 'concepts', label: () => 'Concepts', description: 'Fiches de théorie : tactique, stratégie, finales.', target: { view: 'concepts' } },
            { key: 'library', label: () => 'Bibliothèque', description: 'Tes livres importés et leurs positions clés.', target: { view: 'library' }, alsoActiveOn: ['book'] },
          ],
        },
      ],
    },
  },
  {
    kind: 'group',
    group: {
      key: 'progress',
      label: 'Progresser',
      sections: [
        {
          items: [
            { key: 'stats', label: c => `Statistiques${c.analyses ? ` (${c.analyses})` : ''}`, description: 'Précision, phases, motifs tactiques, ouvertures.', target: { view: 'stats' }, unavailable: needGames(1) },
            { key: 'strategy-profile', label: () => 'Profil stratégique', description: 'Tes structures, tes types de centre, tes plans manqués.', target: { view: 'strategy', strategyTab: 'profile' }, unavailable: needGames(1) },
            { key: 'roadmap', label: () => 'Mon niveau', description: 'Ta tranche Elo et les modules à valider pour la suivante.', target: { view: 'roadmap' } },
            { key: 'compare', label: () => 'Comparer avec un ami', description: 'Forces et faiblesses croisées avec un autre joueur.', target: { view: 'compare' } },
          ],
        },
      ],
    },
  },
  {
    kind: 'group',
    group: {
      key: 'openings',
      label: 'Ouvertures',
      sections: [
        {
          items: [
            { key: 'repertoire', label: () => 'Mon répertoire', description: 'Tes lignes, leurs trous et leurs critiques.', target: { view: 'repertoire' }, unavailable: needGames(3) },
            { key: 'openingLab', label: () => 'Labo d\'ouvertures', description: 'Ta ligne la plus jouée comparée à celle des maîtres.', target: { view: 'openingLab' }, unavailable: needGames(3) },
            { key: 'reverseDrill', label: () => 'Ouvertures en miroir', description: 'Rejoue tes ouvertures avec l\'autre couleur.', target: { view: 'reverseDrill' }, unavailable: needGames(3) },
          ],
        },
        {
          label: 'Préparation',
          items: [
            { key: 'scouting', label: () => 'Préparer un adversaire', description: 'Son répertoire et ses habitudes avant de l\'affronter.', target: { view: 'scouting' } },
            { key: 'players', label: () => 'Joueurs (PGN)', description: 'Étudie des joueurs hors chess.com à partir de PGN.', target: { view: 'players' } },
          ],
        },
      ],
    },
  },
]

export function groupItems(group: NavGroupDef): NavItemDef[] {
  return group.sections.flatMap(s => s.items)
}

/** Every navigable entry, with the label of its group (for the palette). */
export function allNavItems(): { item: NavItemDef; group?: string }[] {
  return NAV.flatMap(e => e.kind === 'item'
    ? [{ item: e.item }]
    : groupItems(e.group).map(item => ({ item, group: e.group.label })))
}

export function isItemActive(item: NavItemDef, view: string, strategyTab?: StrategyTab): boolean {
  if (item.target.view === 'strategy') return view === 'strategy' && item.target.strategyTab === strategyTab
  return item.target.view === view || (item.alsoActiveOn ?? []).includes(view)
}

export function isGroupActive(group: NavGroupDef, view: string, strategyTab?: StrategyTab): boolean {
  return groupItems(group).some(i => isItemActive(i, view, strategyTab))
}

/** Views whose content depends on the global time-control / colour filter. */
export const FILTERED_VIEWS = new Set([
  'stats', 'repertoire', 'openingLab', 'exercises', 'rush', 'daily', 'roadmap', 'blunder', 'calc', 'reverseDrill', 'strategy',
])
