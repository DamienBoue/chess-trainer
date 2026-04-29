interface Props {
  evalCp: number  // from white's perspective; mate uses ±(100000 - n)
}

export default function EvalBar({ evalCp }: Props) {
  // Convert centipawns to a 0..1 white-share via a sigmoid-like squashing.
  const isMate = Math.abs(evalCp) > 50000
  let whiteShare: number
  if (isMate) {
    whiteShare = evalCp > 0 ? 1 : 0
  } else {
    // Logistic: 0 cp = 0.5, ±400 cp ≈ 0.85, ±1000 cp ≈ 0.97
    whiteShare = 1 / (1 + Math.exp(-evalCp / 250))
  }
  whiteShare = Math.max(0.02, Math.min(0.98, whiteShare))
  const blackShare = 1 - whiteShare

  let label: string
  if (isMate) {
    const mateIn = 100000 - Math.abs(evalCp)
    label = `M${mateIn}${evalCp < 0 ? '' : ''}`
  } else {
    const pawns = evalCp / 100
    label = (pawns >= 0 ? '+' : '') + pawns.toFixed(1)
  }

  return (
    <div className="flex flex-col w-6 h-[min(70vw,560px)] bg-neutral-900 border border-[var(--color-border)] rounded overflow-hidden">
      <div
        className="bg-neutral-800 transition-[height] duration-200"
        style={{ height: `${blackShare * 100}%` }}
      />
      <div
        className="bg-neutral-100 transition-[height] duration-200 relative"
        style={{ height: `${whiteShare * 100}%` }}
      >
      </div>
      <div className="absolute" />
      <div
        className="text-[10px] font-mono self-center mt-auto mb-1 text-neutral-700"
        style={{ writingMode: 'vertical-rl' }}
      >
        {label}
      </div>
    </div>
  )
}
