// Where each view of the shared navigation model lives in the app, for the
// screens already ported. A tool not listed here shows "Bientôt sur mobile".
// (strategy pages: 'strategy:<tab>')
import type { Href } from 'expo-router'
import type { NavTarget } from '@shared/components/navModel'

const HREFS: Record<string, string> = {
  home: '/',
  games: '/parties',
  trainHub: '/entrainement',
  theoryHub: '/theorie',
  progressHub: '/progres',
  concepts: '/concepts',
  library: '/bibliotheque',
  scouting: '/preparer',
  players: '/joueurs',
  repertoire: '/repertoire',
  openingLab: '/labo-ouvertures',
  reverseDrill: '/miroir',
  rush: '/rush',
  blunder: '/reflexe',
  calc: '/calcul',
  play: '/jouer',
  compare: '/comparer',
  settings: '/preferences',
  exercises: '/exercices',
  daily: '/quotidien',
  stats: '/statistiques',
  roadmap: '/niveau',
  'strategy:atlas': '/structures',
  'strategy:trainer': '/strategie-entrainement',
  'strategy:profile': '/strategie-profil',
}

export function hrefFor(target: NavTarget): Href | null {
  if (target.view === 'strategy') return HREFS[`strategy:${target.strategyTab}`] as Href ?? null
  return (HREFS[target.view] as Href | undefined) ?? null
}
