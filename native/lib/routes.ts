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
}

export function hrefFor(target: NavTarget): Href | null {
  if (target.view === 'strategy') return HREFS[`strategy:${target.strategyTab}`] as Href ?? null
  return (HREFS[target.view] as Href | undefined) ?? null
}
