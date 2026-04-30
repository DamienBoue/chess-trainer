import type { Color, GameAnalysis } from '../types'

export type TimeClassFilter = 'all' | string
export type ColorFilter = 'all' | Color

const LABELS: Record<string, string> = {
  rapid: 'Rapide',
  blitz: 'Blitz',
  bullet: 'Bullet',
  daily: 'Correspondance',
  pgn: 'PGN',
}

export function labelForTimeClass(tc: string): string {
  return LABELS[tc] ?? tc
}

// Display order (rarer time classes appear after the common three)
const ORDER = ['rapid', 'blitz', 'bullet', 'daily']

export function availableTimeClasses(analyses: GameAnalysis[]): string[] {
  const set = new Set<string>()
  for (const a of analyses) if (a.timeClass) set.add(a.timeClass)
  return Array.from(set).sort((a, b) => {
    const ia = ORDER.indexOf(a); const ib = ORDER.indexOf(b)
    if (ia !== -1 && ib !== -1) return ia - ib
    if (ia !== -1) return -1
    if (ib !== -1) return 1
    return a.localeCompare(b)
  })
}

export function applyTimeClassFilter(
  analyses: GameAnalysis[],
  filter: TimeClassFilter,
): GameAnalysis[] {
  if (filter === 'all') return analyses
  return analyses.filter(a => a.timeClass === filter)
}

export function applyColorFilter(
  analyses: GameAnalysis[],
  filter: ColorFilter,
): GameAnalysis[] {
  if (filter === 'all') return analyses
  return analyses.filter(a => a.userColor === filter)
}

export function applyGlobalFilters(
  analyses: GameAnalysis[],
  tc: TimeClassFilter,
  color: ColorFilter,
): GameAnalysis[] {
  return applyColorFilter(applyTimeClassFilter(analyses, tc), color)
}

interface Props {
  value: TimeClassFilter
  onChange: (v: TimeClassFilter) => void
  analyses: GameAnalysis[]
}

export default function TimeClassTabs({ value, onChange, analyses }: Props) {
  const classes = availableTimeClasses(analyses)
  // Hide if 0 or 1 class — no point showing a filter with one option.
  if (classes.length <= 1) return null
  const counts: Record<string, number> = { all: analyses.length }
  for (const c of classes) counts[c] = analyses.filter(a => a.timeClass === c).length

  return (
    <div className="inline-flex rounded-md border border-[var(--color-border)] bg-[var(--color-panel)] p-0.5 text-sm">
      <Tab active={value === 'all'} onClick={() => onChange('all')} count={counts.all}>Tout</Tab>
      {classes.map(c => (
        <Tab key={c} active={value === c} onClick={() => onChange(c)} count={counts[c]}>
          {labelForTimeClass(c)}
        </Tab>
      ))}
    </div>
  )
}

function Tab({
  children, active, onClick, count, dot,
}: {
  children: React.ReactNode
  active: boolean
  onClick: () => void
  count: number
  dot?: string
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded transition-colors flex items-center gap-2 ${
        active ? 'bg-[var(--color-accent)] text-white' : 'text-neutral-300 hover:bg-neutral-800'
      }`}
    >
      {dot && <span className={`w-2 h-2 rounded-full ${dot} border border-neutral-600`} />}
      <span>{children}</span>
      <span className="text-xs opacity-70">({count})</span>
    </button>
  )
}

interface GlobalFiltersProps {
  tcValue: TimeClassFilter
  onTcChange: (v: TimeClassFilter) => void
  colorValue: ColorFilter
  onColorChange: (v: ColorFilter) => void
  analyses: GameAnalysis[]
}

export function GlobalFilters({
  tcValue, onTcChange, colorValue, onColorChange, analyses,
}: GlobalFiltersProps) {
  const classes = availableTimeClasses(analyses)
  const tcCounts: Record<string, number> = { all: analyses.length }
  for (const c of classes) tcCounts[c] = analyses.filter(a => a.timeClass === c).length

  // Color counts respect the current time-class selection so they reflect what
  // the user actually gets after applying both filters.
  const tcFiltered = applyTimeClassFilter(analyses, tcValue)
  const colorCounts = {
    all: tcFiltered.length,
    white: tcFiltered.filter(a => a.userColor === 'white').length,
    black: tcFiltered.filter(a => a.userColor === 'black').length,
  }

  const showTc = classes.length > 1

  return (
    <div className="flex flex-wrap items-center gap-2">
      {showTc && (
        <>
          <span className="text-xs text-neutral-500 uppercase tracking-wider">Cadence</span>
          <div className="inline-flex rounded-md border border-[var(--color-border)] bg-[var(--color-panel)] p-0.5 text-sm">
            <Tab active={tcValue === 'all'} onClick={() => onTcChange('all')} count={tcCounts.all}>Tout</Tab>
            {classes.map(c => (
              <Tab key={c} active={tcValue === c} onClick={() => onTcChange(c)} count={tcCounts[c]}>
                {labelForTimeClass(c)}
              </Tab>
            ))}
          </div>
        </>
      )}
      <span className="text-xs text-neutral-500 uppercase tracking-wider">Couleur</span>
      <div className="inline-flex rounded-md border border-[var(--color-border)] bg-[var(--color-panel)] p-0.5 text-sm">
        <Tab active={colorValue === 'all'} onClick={() => onColorChange('all')} count={colorCounts.all}>Tout</Tab>
        <Tab active={colorValue === 'white'} onClick={() => onColorChange('white')} count={colorCounts.white} dot="bg-neutral-100">Blancs</Tab>
        <Tab active={colorValue === 'black'} onClick={() => onColorChange('black')} count={colorCounts.black} dot="bg-neutral-700">Noirs</Tab>
      </div>
    </div>
  )
}
