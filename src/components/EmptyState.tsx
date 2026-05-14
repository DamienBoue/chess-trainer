// Shared empty-state block used across views that need data to function.
//
// Pattern: icon + title + description + (optional) bullet list of what
// to do next + (optional) CTA button. Keeps the dead-end "Aucune
// donnée" screens unified and actionable.

import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  steps?: string[]
  cta?: { label: string; onClick: () => void }
  secondaryCta?: { label: string; onClick: () => void }
  children?: ReactNode
}

export default function EmptyState({
  icon, title, description, steps, cta, secondaryCta, children,
}: EmptyStateProps) {
  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-6">
        <div className="flex items-start gap-4">
          {icon && <div className="text-3xl shrink-0">{icon}</div>}
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold mb-1 text-neutral-100">{title}</h2>
            {description && (
              <p className="text-sm text-neutral-400 leading-relaxed">{description}</p>
            )}
            {steps && steps.length > 0 && (
              <ol className="mt-3 list-decimal pl-5 text-sm text-neutral-300 space-y-1">
                {steps.map((s, i) => <li key={i}>{s}</li>)}
              </ol>
            )}
            {children && <div className="mt-3 text-sm text-neutral-300">{children}</div>}
            {(cta || secondaryCta) && (
              <div className="mt-4 flex gap-2 flex-wrap">
                {cta && (
                  <button
                    onClick={cta.onClick}
                    className="px-4 py-2 text-sm rounded bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white font-medium"
                  >
                    {cta.label}
                  </button>
                )}
                {secondaryCta && (
                  <button
                    onClick={secondaryCta.onClick}
                    className="px-4 py-2 text-sm rounded bg-neutral-800 hover:bg-neutral-700"
                  >
                    {secondaryCta.label}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
