// "Lecture stratégique" — the positional reading of the displayed position:
// structure & centre, assets and weaknesses, plans for each side (with
// the engine's choice cross-checked against them), and board overlays.

import { useEffect, useMemo, useState } from 'react'
import { Chess } from 'chess.js'
import { type Side, SIDE_LABEL, opp, sqIndex } from '../strategy/board'
import type { Insight } from '../strategy/insights'
import type { Plan } from '../strategy/plans'
import { type StrategicReport, analyzePosition, planMatchesMove } from '../strategy/report'
import { loadStrategyOverlays, saveStrategyOverlays, type StrategyOverlays } from '../storage/strategyPrefs'
import ConceptChip from './ConceptChip'
import LlmAskBox from './LlmAskBox'
import { explainPosition } from '../coach/coach'
import { type BoardOverlay, EMPTY_OVERLAY, OVERLAY_COLORS, buildStrategyOverlay } from './strategyBoard'

interface Props {
  fen: string
  userColor: 'white' | 'black'
  /** Engine's best move in this position (SAN), when known. */
  engineBestSan?: string
  /** Move actually played from this position (SAN), when known. */
  playedSan?: string
  onOverlay: (o: BoardOverlay) => void
}

const PHASE_LABEL = { opening: 'Ouverture', middlegame: 'Milieu de jeu', endgame: 'Finale' } as const

interface MoveRef { san: string; from: number; to: number }

function parseMove(fen: string, san?: string): MoveRef | null {
  if (!san) return null
  try {
    const m = new Chess(fen).move(san)
    return { san: m.san, from: sqIndex(m.from), to: sqIndex(m.to) }
  } catch {
    return null
  }
}

export default function StrategyPanel({ fen, userColor, engineBestSan, playedSan, onOverlay }: Props) {
  const userSide: Side = userColor === 'white' ? 'w' : 'b'
  const report = useMemo<StrategicReport | null>(() => {
    try { return analyzePosition(fen) } catch { return null }
  }, [fen])
  const [perspective, setPerspective] = useState<Side>(userSide)
  const [overlays, setOverlays] = useState<StrategyOverlays>(() => loadStrategyOverlays())
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
  const [focus, setFocus] = useState<number[] | null>(null)
  const [showAllPlans, setShowAllPlans] = useState(false)

  const engineMove = useMemo(() => parseMove(fen, engineBestSan), [fen, engineBestSan])
  const playedMove = useMemo(() => parseMove(fen, playedSan), [fen, playedSan])

  const myPlans = useMemo(() => report?.plans[perspective] ?? [], [report, perspective])
  const theirPlans = useMemo(() => report?.plans[opp(perspective)] ?? [], [report, perspective])
  const activePlan = useMemo<Plan | null>(() => {
    const all = [...myPlans, ...theirPlans]
    return all.find(p => `${p.side}:${p.id}` === selectedPlanId) ?? myPlans[0] ?? null
  }, [myPlans, theirPlans, selectedPlanId])

  useEffect(() => {
    onOverlay(report ? buildStrategyOverlay(report, perspective, overlays, activePlan, focus) : EMPTY_OVERLAY)
  }, [report, perspective, overlays, activePlan, focus, onOverlay])
  useEffect(() => () => onOverlay(EMPTY_OVERLAY), [onOverlay])

  if (!report) return null

  function toggle(key: keyof StrategyOverlays) {
    const next = { ...overlays, [key]: !overlays[key] }
    setOverlays(next)
    saveStrategyOverlays(next)
  }

  const isUser = perspective === userSide
  const insights = report.insights.filter(i => i.side === perspective || (i.polarity === 'info' && perspective === userSide))
  const plus = insights.filter(i => i.polarity === 'plus')
  const minus = insights.filter(i => i.polarity === 'minus')
  const info = insights.filter(i => i.polarity === 'info')
  const engineSide = report.board.turn
  const enginePlan = engineMove ? report.plans[engineSide].find(p => planMatchesMove(p, engineMove.from, engineMove.to)) : undefined
  const playedPlan = playedMove ? report.plans[engineSide].find(p => planMatchesMove(p, playedMove.from, playedMove.to)) : undefined
  const visiblePlans = showAllPlans ? myPlans : myPlans.slice(0, 4)

  return (
    <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-4">
      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
        <h3 className="font-semibold">Lecture stratégique</h3>
        <div className="inline-flex rounded-md border border-[var(--color-border)] bg-neutral-900 p-0.5 text-xs" role="group" aria-label="Point de vue">
          {[userSide, opp(userSide)].map(s => (
            <button
              key={s}
              onClick={() => { setPerspective(s); setSelectedPlanId(null) }}
              aria-pressed={perspective === s}
              className={`px-2 py-1 rounded ${perspective === s ? 'bg-[var(--color-accent)] text-white' : 'text-neutral-300 hover:bg-neutral-800'}`}
            >{s === userSide ? `Toi (${SIDE_LABEL[s]})` : `Adversaire (${SIDE_LABEL[s]})`}</button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 text-xs mb-2">
        <Tag>{PHASE_LABEL[report.phase]}</Tag>
        <Tag title={report.center.advice}>{report.center.label} <ConceptChip id="center-types" iconOnly /></Tag>
        {report.structures.map(m => (
          <Tag key={m.pattern.id} strong>{m.pattern.name} {m.pattern.conceptId && <ConceptChip id={m.pattern.conceptId} iconOnly />}</Tag>
        ))}
      </div>
      <p className="text-xs text-neutral-400 leading-relaxed mb-3">{report.center.advice}</p>

      <div className="flex flex-wrap gap-1.5 mb-3 text-[11px]" aria-label="Surcouches de l'échiquier">
        <OverlayToggle on={overlays.strong} color={OVERLAY_COLORS.strong} onClick={() => toggle('strong')}>Cases fortes</OverlayToggle>
        <OverlayToggle on={overlays.weak} color={OVERLAY_COLORS.weak} onClick={() => toggle('weak')}>Cases faibles</OverlayToggle>
        <OverlayToggle on={overlays.pawns} color={OVERLAY_COLORS.passed} onClick={() => toggle('pawns')}>Pions passés / faibles</OverlayToggle>
        <OverlayToggle on={overlays.plans} color={OVERLAY_COLORS.plan} onClick={() => toggle('plans')}>Flèches du plan</OverlayToggle>
      </div>

      <div className="grid sm:grid-cols-2 gap-3 mb-3">
        <InsightList title={isUser ? 'Tes atouts' : 'Ses atouts'} tone="plus" items={plus} onFocus={setFocus} />
        <InsightList title={isUser ? 'Tes faiblesses' : 'Ses faiblesses'} tone="minus" items={minus} onFocus={setFocus} />
      </div>
      {info.length > 0 && <InsightList title="À noter" tone="info" items={info} onFocus={setFocus} />}

      {(engineMove || playedMove) && (
        <div className="text-xs rounded bg-neutral-900 border border-[var(--color-border)] p-2 mb-3 space-y-1">
          {engineMove && (
            <div>
              <span className="text-neutral-500">Le moteur joue ici </span>
              <span className="font-mono text-neutral-100">{engineMove.san}</span>
              {enginePlan
                ? <span className="text-emerald-300"> — dans l'esprit du plan « {enginePlan.title} »</span>
                : <span className="text-neutral-500"> — un coup concret (tactique, prophylaxie…) hors des plans détectés</span>}
            </div>
          )}
          {playedMove && playedMove.san !== engineMove?.san && (
            <div>
              <span className="text-neutral-500">Coup joué : </span>
              <span className="font-mono text-neutral-100">{playedMove.san}</span>
              {playedPlan
                ? <span className="text-sky-300"> — suit le plan « {playedPlan.title} »</span>
                : <span className="text-neutral-500"> — ne suit aucun des plans détectés</span>}
            </div>
          )}
        </div>
      )}

      <h4 className="text-xs uppercase tracking-wider text-neutral-500 mb-1.5">
        {isUser ? 'Plans pour toi' : 'Plans pour l\'adversaire'}
        {report.board.turn === perspective ? ' · au trait' : ''}
      </h4>
      {myPlans.length === 0 ? (
        <p className="text-sm text-neutral-500 mb-3">Aucun plan saillant : améliore tes pièces et reste attentif aux coups adverses.</p>
      ) : (
        <div className="space-y-2 mb-2">
          {visiblePlans.map(p => (
            <PlanCard
              key={p.id}
              plan={p}
              active={activePlan?.id === p.id && activePlan.side === p.side}
              engine={!!engineMove && engineSide === p.side && planMatchesMove(p, engineMove.from, engineMove.to)}
              played={!!playedMove && engineSide === p.side && planMatchesMove(p, playedMove.from, playedMove.to)}
              onSelect={() => setSelectedPlanId(`${p.side}:${p.id}`)}
            />
          ))}
          {myPlans.length > 4 && (
            <button onClick={() => setShowAllPlans(v => !v)} className="text-xs text-neutral-400 hover:text-white underline">
              {showAllPlans ? 'Moins de plans' : `Voir les ${myPlans.length - 4} autres plans`}
            </button>
          )}
        </div>
      )}

      {theirPlans.length > 0 && (
        <div className="mt-3 pt-3 border-t border-[var(--color-border)]">
          <h4 className="text-xs uppercase tracking-wider text-neutral-500 mb-1.5">
            {isUser ? 'Ce que cherche l\'adversaire' : 'Ce que tu cherches'}
          </h4>
          <ul className="space-y-1">
            {theirPlans.slice(0, 3).map(p => {
              const key = `${p.side}:${p.id}`
              const active = activePlan?.id === p.id && activePlan.side === p.side
              return (
                <li key={key}>
                  <button
                    onClick={() => setSelectedPlanId(active ? null : key)}
                    className={`text-left text-sm w-full rounded px-1.5 py-1 ${active ? 'bg-red-500/10 text-red-200' : 'text-neutral-300 hover:bg-neutral-800'}`}
                  >
                    <span className="text-red-400 mr-1">⚑</span>{p.title}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <div className="mt-3 pt-3 border-t border-[var(--color-border)]">
        <LlmAskBox
          ctaLabel="✨ Explique-moi le plan (IA)"
          hint="L'IA part de cette lecture, la corrige si besoin, et la confronte au coup du moteur."
          resetKey={fen}
          run={signal => explainPosition(fen, userColor, engineBestSan, { signal })}
        />
      </div>

      <p className="text-[11px] text-neutral-500 mt-3">
        Repères positionnels calculés par heuristiques (structure, cases, pièces, roi) : des idées à confronter au moteur, pas des verdicts.
        {!isUser && ' Textes rédigés du point de vue de l\'adversaire.'}
      </p>
    </div>
  )
}

function Tag({ children, title, strong = false }: { children: React.ReactNode; title?: string; strong?: boolean }) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border ${strong ? 'border-[var(--color-accent)] text-neutral-100 bg-[var(--color-accent)]/15' : 'border-[var(--color-border)] text-neutral-300 bg-neutral-900'}`}
    >{children}</span>
  )
}

function OverlayToggle({ on, color, onClick, children }: { on: boolean; color: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded border ${on ? 'border-neutral-500 text-neutral-100 bg-neutral-800' : 'border-[var(--color-border)] text-neutral-500 hover:text-neutral-300'}`}
    >
      <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: on ? color : 'transparent', border: `1px solid ${color}` }} />
      {children}
    </button>
  )
}

function InsightList({ title, tone, items, onFocus }: {
  title: string
  tone: 'plus' | 'minus' | 'info'
  items: Insight[]
  onFocus: (sqs: number[] | null) => void
}) {
  const [open, setOpen] = useState<string | null>(null)
  const [all, setAll] = useState(false)
  const icon = tone === 'plus' ? '＋' : tone === 'minus' ? '−' : '•'
  const color = tone === 'plus' ? 'text-emerald-400' : tone === 'minus' ? 'text-red-400' : 'text-neutral-400'
  const shown = all ? items : items.slice(0, 4)
  return (
    <div>
      <h4 className="text-xs uppercase tracking-wider text-neutral-500 mb-1">{title}</h4>
      {items.length === 0 ? (
        <p className="text-xs text-neutral-600">Rien de marquant.</p>
      ) : (
        <ul className="space-y-1">
          {shown.map(i => (
            <li
              key={i.id}
              onMouseEnter={() => onFocus(i.squares.length ? i.squares : null)}
              onMouseLeave={() => onFocus(null)}
            >
              <div className="flex items-start gap-1.5">
                <span className={`${color} font-bold leading-5`}>{icon}</span>
                <button
                  onClick={() => setOpen(open === i.id ? null : i.id)}
                  className="text-left text-sm text-neutral-200 hover:text-white leading-5"
                  aria-expanded={open === i.id}
                >{i.title}</button>
                {i.conceptId && <ConceptChip id={i.conceptId} iconOnly />}
              </div>
              {open === i.id && <p className="text-xs text-neutral-400 ml-5 mt-0.5 leading-relaxed">{i.detail}</p>}
            </li>
          ))}
        </ul>
      )}
      {items.length > 4 && (
        <button onClick={() => setAll(v => !v)} className="text-[11px] text-neutral-500 hover:text-white underline mt-1">
          {all ? 'Moins' : `+ ${items.length - 4}`}
        </button>
      )}
    </div>
  )
}

function PlanCard({ plan, active, engine, played, onSelect }: {
  plan: Plan
  active: boolean
  engine: boolean
  played: boolean
  onSelect: () => void
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect() } }}
      aria-pressed={active}
      className={`rounded border p-2.5 cursor-pointer transition-colors ${active ? 'border-sky-500/60 bg-sky-500/10' : 'border-[var(--color-border)] hover:bg-neutral-800/60'}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm font-medium text-neutral-100">{plan.title}</div>
        <div className="flex gap-1 shrink-0">
          {engine && <span className="text-[11px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300" title="Le meilleur coup du moteur démarre ce plan">✓ moteur</span>}
          {played && <span className="text-[11px] px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300" title="Le coup joué dans la partie démarre ce plan">joué</span>}
          {plan.timing && (
            <span className={`text-[11px] px-1.5 py-0.5 rounded ${plan.timing.verdict === 'now' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300'}`}>
              {plan.timing.verdict === 'now' ? 'le moment' : 'à préparer'}
            </span>
          )}
        </div>
      </div>
      <p className="text-xs text-neutral-400 mt-1 leading-relaxed">{plan.why}</p>
      {active && (
        <ul className="mt-2 space-y-1 text-xs text-neutral-300 list-disc pl-4 leading-relaxed">
          {plan.steps.map((s, i) => <li key={i}>{s}</li>)}
        </ul>
      )}
      {active && plan.conceptId && <div className="mt-2" onClick={e => e.stopPropagation()}><ConceptChip id={plan.conceptId} /></div>}
    </div>
  )
}
