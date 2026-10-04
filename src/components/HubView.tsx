// Hub page of a part of the app (Entraînement, Théorie, Progrès): its tools
// as cards, with their live status, what they need when unavailable, and
// the one to do now on top. On phones the tab bar leads here, and every
// tool's header leads back up here.

import { type NavCounts, type NavGroupDef, type NavItemDef, type NavTarget, groupItems } from './navModel'

interface Props {
  group: NavGroupDef
  counts: NavCounts
  onNavigate: (t: NavTarget) => void
}

export default function HubView({ group, counts, onNavigate }: Props) {
  const rec = group.recommend?.(counts) ?? null
  const recItem = rec ? groupItems(group).find(i => i.key === rec.key) : undefined

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
      <header>
        {/* Phones already show the part's name in the top bar. */}
        <h1 className="hidden sm:block text-2xl font-semibold">{group.label}</h1>
        <p className="text-sm text-neutral-400 sm:mt-1">{group.intro}</p>
      </header>

      {rec && recItem && (
        <button
          onClick={() => onNavigate(recItem.target)}
          className="w-full text-left rounded-lg border border-[var(--color-accent)]/60 bg-[var(--color-accent)]/10 hover:bg-[var(--color-accent)]/20 p-4 flex items-center gap-3"
        >
          <span className="text-3xl shrink-0" aria-hidden="true">{recItem.icon}</span>
          <span className="flex-1 min-w-0">
            <span className="block text-[11px] uppercase tracking-wider text-[var(--color-accent-hover)]">À faire maintenant</span>
            <span className="block font-semibold text-neutral-100">{recItem.label}</span>
            <span className="block text-sm text-neutral-300">{rec.why}</span>
          </span>
          <span className="shrink-0 text-lg text-[var(--color-accent-hover)]" aria-hidden="true">→</span>
        </button>
      )}

      {group.sections.map((section, si) => (
        <section key={si} aria-label={section.label ?? group.label}>
          {section.label && <h2 className="text-xs uppercase tracking-wider text-neutral-500 mb-2">{section.label}</h2>}
          <div className="grid gap-2 sm:grid-cols-2">
            {section.items.map(item => <HubCard key={item.key} item={item} counts={counts} onNavigate={onNavigate} />)}
          </div>
        </section>
      ))}
    </div>
  )
}

function HubCard({ item, counts, onNavigate }: { item: NavItemDef; counts: NavCounts; onNavigate: (t: NavTarget) => void }) {
  const reason = item.unavailable?.(counts) ?? null
  const status = reason === null ? item.status?.(counts) ?? null : null
  return (
    <button
      onClick={() => onNavigate(item.target)}
      disabled={reason !== null}
      className="w-full min-h-16 text-left rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] hover:bg-neutral-800 disabled:hover:bg-[var(--color-panel)] p-3 flex items-center gap-3"
    >
      <span className={`text-2xl w-8 text-center shrink-0 ${reason ? 'opacity-40' : ''}`} aria-hidden="true">{item.icon}</span>
      <span className="flex-1 min-w-0">
        <span className={`block font-medium ${reason ? 'text-neutral-500' : 'text-neutral-100'}`}>{item.label}</span>
        <span className={`block text-xs mt-0.5 ${reason ? 'text-amber-300/80' : 'text-neutral-400'}`}>{reason ?? item.description}</span>
      </span>
      {status
        ? <span className="shrink-0 text-xs px-2 py-0.5 rounded-full bg-[var(--color-accent)] text-white">{status}</span>
        : reason === null && <span className="shrink-0 text-xl text-neutral-500" aria-hidden="true">›</span>}
    </button>
  )
}
