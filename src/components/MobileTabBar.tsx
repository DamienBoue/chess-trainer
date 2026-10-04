// Bottom tab bar on phones: the five parts of the app always in reach of
// the thumb (Material navigation bar / HIG tab bar). A part with several
// tools opens its hub page; tapping the current part again goes back to
// its top, as in the chess.com and Lichess apps.

import { NAV, type NavCounts, type NavTarget, isGroupActive, isItemActive } from './navModel'
import type { StrategyTab } from './StrategyView'

interface Props {
  view: string
  strategyTab: StrategyTab
  counts: NavCounts
  onNavigate: (t: NavTarget) => void
}

const ICONS: Record<string, React.ReactNode> = {
  home: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4M9 15l2 2 4-4" /></>,
  games: <><rect x="3" y="3" width="18" height="18" rx="1" /><path d="M3 12h18M12 3v18M3 3h9v9H3zM12 12h9v9h-9z" /></>,
  train: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" /></>,
  theory: <><path d="M2 5h7a3 3 0 0 1 3 3v12a2 2 0 0 0-2-2H2zM22 5h-7a3 3 0 0 0-3 3v12a2 2 0 0 1 2-2h8z" /></>,
  progress: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>,
}

export default function MobileTabBar({ view, strategyTab, counts, onNavigate }: Props) {
  return (
    <nav
      aria-label="Navigation principale"
      className="sm:hidden fixed bottom-0 inset-x-0 z-30 bg-[var(--color-panel)] border-t border-[var(--color-border)] pb-[env(safe-area-inset-bottom)]"
    >
      <div className="grid grid-cols-5">
        {NAV.map(entry => {
          const key = entry.kind === 'item' ? entry.item.key : entry.group.key
          const label = entry.kind === 'item' ? entry.item.label : entry.group.label
          const target: NavTarget = entry.kind === 'item' ? entry.item.target : { view: entry.group.hub }
          const active = entry.kind === 'item'
            ? isItemActive(entry.item, view, strategyTab)
            : isGroupActive(entry.group, view, strategyTab)
          const badge = key === 'train' && counts.due > 0 ? counts.due : 0
          return (
            <button
              key={key}
              onClick={() => onNavigate(target)}
              aria-current={active ? 'page' : undefined}
              aria-label={badge ? `${label} (${badge} à revoir)` : undefined}
              className={`relative flex flex-col items-center gap-0.5 pt-2 pb-1.5 text-[11px] ${active ? 'text-[var(--color-accent-hover)]' : 'text-neutral-400'}`}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {ICONS[key]}
              </svg>
              <span className="truncate max-w-full px-0.5">{label}</span>
              {badge > 0 && (
                <span aria-hidden="true" className="absolute top-1 right-[calc(50%-1.1rem)] min-w-[1.1rem] h-[1.1rem] px-1 rounded-full bg-[var(--color-accent)] text-white text-[10px] leading-[1.1rem] text-center">
                  {badge}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
