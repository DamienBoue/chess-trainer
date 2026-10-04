// "Bilan stratégique" of a whole game: dominant structure, structure and
// centre timelines, lessons, and the strategic moments (structural
// concessions, missed plans) — each one jumps the board to the right ply.

import { useMemo, useState } from 'react'
import type { GameAnalysis } from '../types'
import type { GameEvent, GameStrategyReview } from '../strategy/game'
import { reviewOf } from './useStrategyReviews'
import { CENTER_LABELS, type CenterType } from '../strategy/center'
import type { Side } from '../strategy/board'
import ConceptChip from './ConceptChip'

interface Props {
  analysis: GameAnalysis
  currentPly: number
  onJump: (ply: number) => void
}

const CENTER_COLORS: Record<CenterType, string> = {
  closed: '#8b5e3c',
  fixed: '#7a7a7a',
  tension: '#d08a2c',
  mobile: '#3f7fd0',
  'semi-open': '#5f8f6a',
  open: '#b8c46a',
  forming: '#4a4a4a',
}

const STRUCTURE_COLORS = ['#c47aee', '#5b88ba', '#e08e3c', '#5fa052', '#d0607a', '#4fb3b3']

type Filter = 'mine' | 'theirs' | 'all'

export default function GameStrategyCard({ analysis, currentPly, onJump }: Props) {
  const review = useMemo<GameStrategyReview | null>(() => {
    try { return reviewOf(analysis) } catch (e) { console.error('[strategy] review failed', e); return null }
  }, [analysis])
  const [filter, setFilter] = useState<Filter>('mine')
  const [showAll, setShowAll] = useState(false)
  if (!review || analysis.moves.length === 0) return null

  const userSide: Side = analysis.userColor === 'white' ? 'w' : 'b'
  const n = analysis.moves.length
  const pct = (ply: number) => `${((ply - 1) / n) * 100}%`
  const width = (from: number, to: number) => `${((to - from + 1) / n) * 100}%`
  const events = review.events.filter(e =>
    filter === 'all' ? true : filter === 'mine' ? e.side === userSide : e.side !== userSide)
  const shown = showAll ? events : events.slice(0, 8)
  const colorOf = new Map<string, string>()
  for (const s of review.structures) {
    if (!colorOf.has(s.id)) colorOf.set(s.id, STRUCTURE_COLORS[colorOf.size % STRUCTURE_COLORS.length])
  }

  return (
    <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-4">
      <h3 className="font-semibold mb-2">Bilan stratégique</h3>

      {review.mainStructure ? (
        <p className="text-sm text-neutral-300 mb-3">
          Structure dominante : <span className="font-medium text-neutral-100">{review.mainStructure.name}</span>
          {review.mainStructure.conceptId && <> <ConceptChip id={review.mainStructure.conceptId} iconOnly /></>}
          <span className="text-neutral-500"> · {review.mainStructure.plies} demi-coups</span>
        </p>
      ) : (
        <p className="text-sm text-neutral-400 mb-3">Pas de structure type durable dans cette partie.</p>
      )}

      <div className="mb-3" aria-label="Chronologie de la partie">
        <div className="relative h-5 rounded bg-neutral-900 border border-[var(--color-border)] overflow-hidden">
          {review.structures.map((s, i) => (
            <button
              key={`${s.id}-${s.fromPly}-${i}`}
              onClick={() => onJump(s.fromPly)}
              title={`${s.name} — demi-coups ${s.fromPly} à ${s.toPly}`}
              className="absolute top-0 h-full text-[10px] text-white/90 truncate px-1 text-left hover:brightness-125"
              style={{ left: pct(s.fromPly), width: width(s.fromPly, s.toPly), backgroundColor: colorOf.get(s.id) + 'cc' }}
            >{s.name}</button>
          ))}
          {currentPly > 0 && (
            <div className="absolute top-0 h-full w-0.5 bg-white pointer-events-none" style={{ left: pct(currentPly) }} />
          )}
        </div>
        <div className="relative h-2 mt-1 rounded overflow-hidden">
          {review.centers.map((c, i) => (
            <button
              key={i}
              onClick={() => onJump(c.fromPly)}
              title={`${CENTER_LABELS[c.type]} — demi-coups ${c.fromPly} à ${c.toPly}`}
              className="absolute top-0 h-full"
              style={{ left: pct(c.fromPly), width: width(c.fromPly, c.toPly), backgroundColor: CENTER_COLORS[c.type] }}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[11px] text-neutral-500">
          {[...new Set(review.centers.map(c => c.type))].map(t => (
            <span key={t} className="inline-flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-sm" style={{ backgroundColor: CENTER_COLORS[t] }} />{CENTER_LABELS[t]}
            </span>
          ))}
        </div>
      </div>

      <h4 className="text-xs uppercase tracking-wider text-neutral-500 mb-1">Leçons à retenir</h4>
      <ol className="list-decimal pl-5 space-y-1 text-sm text-neutral-300 mb-3">
        {review.lessons.map((l, i) => <li key={i}>{l}</li>)}
      </ol>

      <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
        <h4 className="text-xs uppercase tracking-wider text-neutral-500">Moments stratégiques</h4>
        <div className="inline-flex rounded-md border border-[var(--color-border)] bg-neutral-900 p-0.5 text-[11px]">
          {(['mine', 'theirs', 'all'] as Filter[]).map(f => (
            <button
              key={f}
              onClick={() => { setFilter(f); setShowAll(false) }}
              aria-pressed={filter === f}
              className={`px-2 py-0.5 rounded ${filter === f ? 'bg-[var(--color-accent)] text-white' : 'text-neutral-300 hover:bg-neutral-800'}`}
            >{f === 'mine' ? 'Toi' : f === 'theirs' ? 'Adversaire' : 'Tout'}</button>
          ))}
        </div>
      </div>
      {events.length === 0 ? (
        <p className="text-sm text-neutral-500">Aucun moment stratégique marquant de ce côté.</p>
      ) : (
        <ul className="space-y-1">
          {shown.map((e, i) => <EventRow key={`${e.ply}-${e.kind}-${i}`} e={e} analysis={analysis} active={currentPly === e.focusPly} onJump={onJump} />)}
        </ul>
      )}
      {events.length > 8 && (
        <button onClick={() => setShowAll(v => !v)} className="text-xs text-neutral-400 hover:text-white underline mt-1">
          {showAll ? 'Moins' : `Voir les ${events.length - 8} autres`}
        </button>
      )}
    </div>
  )
}

function EventRow({ e, analysis, active, onJump }: { e: GameEvent; analysis: GameAnalysis; active: boolean; onJump: (ply: number) => void }) {
  const [open, setOpen] = useState(false)
  const m = analysis.moves[e.ply - 1]
  const label = `${Math.ceil(e.ply / 2)}${e.ply % 2 === 1 ? '.' : '...'} ${m?.san ?? ''}`
  const color = e.polarity === 'plus' ? 'text-emerald-400' : e.polarity === 'minus' ? 'text-red-400' : 'text-neutral-400'
  const icon = e.kind === 'missed-plan' ? '⚑' : e.polarity === 'plus' ? '＋' : e.polarity === 'minus' ? '−' : '•'
  return (
    <li className={`rounded px-1.5 py-1 ${active ? 'bg-neutral-800' : ''}`}>
      <div className="flex items-center gap-2 text-sm">
        <button onClick={() => onJump(e.focusPly)} className="font-mono text-xs text-neutral-400 hover:text-white w-20 shrink-0 text-left" title="Voir la position">{label}</button>
        <span className={`${color} font-bold`}>{icon}</span>
        <button onClick={() => { setOpen(o => !o); onJump(e.focusPly) }} className="text-left text-neutral-200 hover:text-white flex-1" aria-expanded={open}>{e.title}</button>
        {e.cpLoss >= 50 && <span className="text-[11px] text-red-300/80 shrink-0">−{e.cpLoss} cp</span>}
        {e.conceptId && <ConceptChip id={e.conceptId} iconOnly />}
      </div>
      {open && <p className="text-xs text-neutral-400 ml-[5.5rem] mt-0.5 leading-relaxed">{e.detail}</p>}
    </li>
  )
}

/** Strategic consequences of one move (shown in the move-by-move tab). */
export function MoveStrategyNotes({ analysis, ply, omitMissedPlan = false }: {
  analysis: GameAnalysis
  ply: number
  /** The caller already explains the missed plan (mistake review). */
  omitMissedPlan?: boolean
}) {
  const events = useMemo(() => {
    try {
      return reviewOf(analysis).events.filter(e => e.ply === ply && !(omitMissedPlan && e.kind === 'missed-plan'))
    } catch { return [] }
  }, [analysis, ply, omitMissedPlan])
  if (events.length === 0) return null
  return (
    <div className="mt-3 pt-3 border-t border-[var(--color-border)]">
      <h4 className="text-xs uppercase tracking-wider text-neutral-500 mb-1.5">Impact stratégique</h4>
      <ul className="space-y-1.5">
        {events.map((e, i) => (
          <li key={i} className="text-sm">
            <div className="flex items-start gap-1.5">
              <span className={`${e.polarity === 'plus' ? 'text-emerald-400' : e.polarity === 'minus' ? 'text-red-400' : 'text-neutral-400'} font-bold leading-5`}>
                {e.kind === 'missed-plan' ? '⚑' : e.polarity === 'plus' ? '＋' : e.polarity === 'minus' ? '−' : '•'}
              </span>
              <span className="text-neutral-200 leading-5">{e.title}</span>
              {e.conceptId && <ConceptChip id={e.conceptId} iconOnly />}
            </div>
            <p className="text-xs text-neutral-400 ml-5 mt-0.5 leading-relaxed">{e.detail}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}
