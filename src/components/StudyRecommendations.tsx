import { useMemo } from 'react'
import type { GameAnalysis } from '../types'
import { buildRecommendations } from '../analysis/recommendations'

interface Props { analyses: GameAnalysis[] }

export default function StudyRecommendations({ analyses }: Props) {
  const recs = useMemo(() => buildRecommendations(analyses), [analyses])
  if (recs.length === 0) return null
  return (
    <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-4">
      <h3 className="font-semibold mb-3">À étudier en priorité</h3>
      <ul className="space-y-3">
        {recs.slice(0, 5).map((r, i) => (
          <li key={i} className="text-sm">
            <div className="flex items-baseline gap-2">
              <span className="font-medium">{r.title}</span>
              <span className="text-xs text-neutral-500">priorité {Math.round(r.priority)}</span>
            </div>
            <p className="text-neutral-400 text-xs mt-0.5">{r.detail}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}
