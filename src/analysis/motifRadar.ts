// Personal motif radar.
//
// For every motif (fork, pin, mate, …) we count two things across the
// user's exercise pool:
//   * found   = times the user successfully recognised this motif
//               (an exercise from the 'punishment' or 'defense' category)
//   * missed  = times they let it slip past
//               (a 'missed' exercise — they blundered when the engine
//                wanted a move featuring this motif)
//
// The miss rate = missed / (missed + found). A high miss rate on a motif
// is a clear "go drill this" signal.

import type { Exercise } from './exercises'
import type { MotifTag } from './motifs'
import { MOTIF_LABELS } from './motifs'

export interface MotifStat {
  motif: MotifTag
  label: string
  found: number
  missed: number
  total: number
  missRate: number          // 0..1
}

export function computeMotifRadar(exercises: Exercise[]): MotifStat[] {
  const found = new Map<MotifTag, number>()
  const missed = new Map<MotifTag, number>()
  for (const e of exercises) {
    const bucket = e.category === 'missed' ? missed : found
    for (const m of e.motifs) {
      bucket.set(m, (bucket.get(m) ?? 0) + 1)
    }
  }
  const motifs = new Set<MotifTag>([...found.keys(), ...missed.keys()])
  const out: MotifStat[] = []
  for (const m of motifs) {
    const f = found.get(m) ?? 0
    const mi = missed.get(m) ?? 0
    const total = f + mi
    out.push({
      motif: m,
      label: MOTIF_LABELS[m],
      found: f,
      missed: mi,
      total,
      missRate: total > 0 ? mi / total : 0,
    })
  }
  // Most actionable first: highest miss rate with meaningful sample size.
  return out.sort((a, b) => {
    if (b.total !== a.total && (b.total < 3 || a.total < 3)) {
      return b.total - a.total      // push tiny samples last
    }
    return b.missRate - a.missRate
  })
}
