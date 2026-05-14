// Lightweight breadcrumb trail used for nested views (Library → Book,
// Analysis from a game…). Stays out of the way: only renders when the
// crumbs array has ≥2 items.

interface Crumb {
  label: string
  onClick?: () => void
}

export default function Breadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  if (crumbs.length < 2) return null
  return (
    <nav aria-label="Fil d'Ariane" className="px-6 py-2 text-xs text-neutral-400 flex items-center gap-1 flex-wrap border-b border-[var(--color-border)] bg-[var(--color-panel)]/30">
      {crumbs.map((c, i) => {
        const last = i === crumbs.length - 1
        return (
          <span key={i} className="flex items-center gap-1">
            {c.onClick && !last ? (
              <button
                onClick={c.onClick}
                className="hover:text-white underline-offset-2 hover:underline"
              >{c.label}</button>
            ) : (
              <span className={last ? 'text-neutral-200' : ''}>{c.label}</span>
            )}
            {!last && <span className="text-neutral-600 mx-1">›</span>}
          </span>
        )
      })}
    </nav>
  )
}
