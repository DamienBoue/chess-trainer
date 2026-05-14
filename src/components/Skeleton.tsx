// Generic content-shape placeholders to use while async views load.
// All variants share the same shimmering animated background.

interface SkeletonProps {
  className?: string
}

export function SkeletonBox({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`bg-neutral-800/60 rounded animate-[shimmer_1.4s_infinite] ${className}`}
      style={{
        backgroundImage:
          'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0) 100%)',
        backgroundSize: '200% 100%',
      }}
    />
  )
}

export function SkeletonLine({ className = '' }: { className?: string }) {
  return <SkeletonBox className={`h-3 ${className}`} />
}

/** A common pattern: title + 2 lines + meta. */
export function SkeletonListItem() {
  return (
    <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded p-3 flex items-center gap-3">
      <SkeletonBox className="w-10 h-10 rounded" />
      <div className="flex-1 space-y-2">
        <SkeletonBox className="h-3 w-1/3" />
        <SkeletonBox className="h-2 w-1/2" />
      </div>
    </div>
  )
}

/** Skeleton for a board area — a square placeholder. */
export function SkeletonBoard({ maxWidth = 560 }: { maxWidth?: number }) {
  return (
    <div className="aspect-square mx-auto w-full" style={{ maxWidth }}>
      <SkeletonBox className="w-full h-full rounded" />
    </div>
  )
}
