// Generic "checkable task" row used by Plan + Roadmap. Renders a
// circle toggle, a body slot, and an optional action button. Keep this
// dumb — the parent owns the data and the click semantics.

import type { ReactNode } from 'react'

interface Props {
  done: boolean
  onToggle: () => void
  /** Disable toggling (e.g. plan's "daily" row that's controlled elsewhere). */
  toggleLocked?: boolean
  /** Right-side action; usually a "Go" button. */
  action?: ReactNode
  children: ReactNode
  /** Border tone when active. */
  className?: string
}

export default function ChecklistRow({
  done, onToggle, toggleLocked, action, children, className,
}: Props) {
  return (
    <div
      className={`bg-[var(--color-panel)] border rounded-md p-3 flex items-start gap-3 transition-all ${
        done ? 'border-green-500/30 opacity-60' : 'border-[var(--color-border)] hover:border-neutral-600'
      } ${className ?? ''}`}
    >
      <button
        onClick={onToggle}
        disabled={toggleLocked}
        className={`w-6 h-6 shrink-0 mt-0.5 rounded-full border-2 flex items-center justify-center transition-colors ${
          done
            ? 'bg-green-500/30 border-green-500/60 text-green-300'
            : 'border-neutral-600 hover:border-neutral-400'
        } ${toggleLocked ? 'cursor-default' : ''}`}
        aria-label={done ? 'Marquer non fait' : 'Marquer fait'}
        title={toggleLocked
          ? 'Cette case se coche automatiquement'
          : done ? 'Marquer non fait' : 'Marquer fait'}
      >
        {done ? '✓' : ''}
      </button>
      <div className="flex-1 min-w-0">{children}</div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
