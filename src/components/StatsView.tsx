import { Fragment, useMemo, useState } from 'react'
import type { GameAnalysis } from '../types'
import { aggregate, deriveInsights, PHASE_LABELS, type AggregateStats, type Phase } from '../analysis/aggregate'
import { CLASSIFICATION_COLORS, CLASSIFICATION_LABELS } from '../analysis/classify'
import { extractExercises } from '../analysis/exercises'
import { computeMotifRadar, type MotifStat } from '../analysis/motifRadar'
import { findRecurringMistakes, type RecurringMistake } from '../analysis/recurringMistakes'
import type { MotifTag } from '../analysis/motifs'
import ProgressCharts from './ProgressCharts'
import BlunderHeatmap from './BlunderHeatmap'
import StudyRecommendations from './StudyRecommendations'
import TrainingBoard from './TrainingBoard'
import EmptyState from './EmptyState'
import Tooltip from './Tooltip'
import PositionExplorer from './PositionExplorer'
import { daysAgo } from '../utils/format'
import { buildTimeline } from '../analysis/timeline'
import { computeTrend, trendDirection, type Trend, type TrendDelta } from '../analysis/trend'
import { buildStrengths } from '../analysis/strengths'

interface Props {
  analyses: GameAnalysis[]
  onDrillMotif?: (motif: MotifTag) => void
  onGoToGames?: () => void
}

export default function StatsView({ analyses, onDrillMotif, onGoToGames }: Props) {
  const stats = useMemo(() => aggregate(analyses), [analyses])
  const insights = useMemo(() => deriveInsights(stats), [stats])
  const exercises = useMemo(() => extractExercises(analyses), [analyses])
  const motifRadar = useMemo(() => computeMotifRadar(exercises), [exercises])
  const strengths = useMemo(() => buildStrengths({ stats, exercises }), [stats, exercises])
  const recurring = useMemo(() => findRecurringMistakes(analyses), [analyses])
  const trend = useMemo(() => computeTrend(buildTimeline(analyses)), [analyses])

  // Detect whether we got mixed colors or a single color so the report copy
  // adapts (the global filter at the top of the page may have already reduced
  // the set).
  const userColors = useMemo(() => {
    const s = new Set<string>()
    for (const a of analyses) s.add(a.userColor)
    return s
  }, [analyses])
  const onlyColor: 'white' | 'black' | null =
    userColors.size === 1 ? (userColors.has('white') ? 'white' : 'black') : null

  if (analyses.length === 0) {
    return (
      <EmptyState
        icon="📊"
        title="Pas encore de stats"
        description="Les stats sont calculées depuis tes parties analysées par Stockfish. Lance au moins une analyse pour débloquer cette page."
        cta={onGoToGames ? { label: 'Voir mes parties', onClick: onGoToGames } : undefined}
      />
    )
  }

  const totalUserMistakes =
    stats.byClass.blunder + stats.byClass.mistake + stats.byClass.inaccuracy
  const classOrder: (keyof typeof stats.byClass)[] = ['best', 'great', 'good', 'inaccuracy', 'mistake', 'blunder', 'book']

  const titleSuffix = onlyColor === null
    ? 'parties'
    : onlyColor === 'white' ? 'parties avec les Blancs' : 'parties avec les Noirs'

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <h2 className="text-2xl font-semibold">Bilan ({stats.gamesAnalyzed} {titleSuffix})</h2>

      {stats.gamesAnalyzed === 0 && (
        <p className="text-neutral-400 text-sm">Aucune partie ne correspond aux filtres actuels.</p>
      )}

      <StatsTabs
        analyses={analyses}
        stats={stats}
        trend={trend}
        strengths={strengths}
        insights={insights}
        motifRadar={motifRadar}
        recurring={recurring}
        onDrillMotif={onDrillMotif}
        onlyColor={onlyColor}
        classOrder={classOrder}
        totalUserMistakes={totalUserMistakes}
      />
    </div>
  )
}

type StatsTab = 'overview' | 'weaknesses' | 'openings'

function StatsTabs(props: {
  analyses: GameAnalysis[]
  stats: AggregateStats
  trend: Trend | null
  strengths: ReturnType<typeof buildStrengths>
  insights: ReturnType<typeof deriveInsights>
  motifRadar: MotifStat[]
  recurring: ReturnType<typeof findRecurringMistakes>
  onDrillMotif?: (m: MotifTag) => void
  onlyColor: 'white' | 'black' | null
  classOrder: (keyof AggregateStats['byClass'])[]
  totalUserMistakes: number
}) {
  const [tab, setTab] = useState<StatsTab>('overview')
  const {
    analyses, stats, trend, strengths, insights, motifRadar, recurring,
    onDrillMotif, onlyColor, classOrder, totalUserMistakes,
  } = props

  return (
    <div>
      <div className="flex gap-1 border-b border-[var(--color-border)] mb-4 text-sm">
        <TabBtn active={tab === 'overview'} onClick={() => setTab('overview')}>Aperçu</TabBtn>
        <TabBtn active={tab === 'weaknesses'} onClick={() => setTab('weaknesses')}>Faiblesses</TabBtn>
        <TabBtn active={tab === 'openings'} onClick={() => setTab('openings')}>Ouvertures</TabBtn>
      </div>

      {tab === 'overview' && (
        <div className="space-y-5">
          {strengths.length > 0 && (
            <div className="bg-green-500/5 border border-green-500/30 rounded-md p-4">
              <h3 className="font-semibold mb-3 text-green-200">✓ Tes points forts</h3>
              <ul className="space-y-1.5 text-sm">
                {strengths.map((s, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="mt-1 w-2 h-2 rounded-full bg-green-400 shrink-0" />
                    <span className="text-neutral-200">{s.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {insights.length > 0 && (
            <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-4">
              <h3 className="font-semibold mb-3">Points clés</h3>
              <ul className="space-y-2 text-sm">
                {insights.map((i, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span
                      className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${
                        i.kind === 'strength' ? 'bg-green-500'
                        : i.kind === 'weakness' ? 'bg-red-500'
                        : 'bg-neutral-500'
                      }`}
                    />
                    <span>{i.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {trend && <TrendPanel trend={trend} />}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-4">
              <h3 className="font-semibold mb-1">Précision moyenne</h3>
              <p className="text-xs text-neutral-500 mb-3">
                Centipawns moyens perdus par coup vs Stockfish. 1 cp = 0.01 pion.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-3xl font-bold text-green-400">{stats.avgCpLossUser.toFixed(0)}<span className="text-sm font-normal text-neutral-500 ml-1">cp</span></div>
                  <div className="text-xs text-neutral-500">Toi</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-neutral-300">{stats.avgCpLossOpponent.toFixed(0)}<span className="text-sm font-normal text-neutral-500 ml-1">cp</span></div>
                  <div className="text-xs text-neutral-500">Adversaires</div>
                </div>
              </div>
              <p className="text-xs text-neutral-500 mt-3 leading-relaxed">
                <span className="text-green-400">~20-30</span> maître ·{' '}
                <span className="text-neutral-300">30-60</span> solide ·{' '}
                <span className="text-orange-400">60-100</span> club ·{' '}
                <span className="text-red-400">100+</span> à améliorer
              </p>
            </div>

            <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-4">
              <h3 className="font-semibold mb-3">
                {onlyColor === null ? 'Résultats par couleur' : 'Résultats'}
              </h3>
              <div className="space-y-2">
                {(onlyColor === null ? (['white', 'black'] as const) : [onlyColor]).map(color => {
                  const r = stats.resultsByColor[color]
                  const total = r.w + r.l + r.d
                  return (
                    <div key={color} className="text-sm">
                      <div className="flex justify-between mb-1">
                        <span>{color === 'white' ? 'Blancs' : 'Noirs'}</span>
                        <span className="text-neutral-500">{r.w}V / {r.l}D / {r.d}N</span>
                      </div>
                      {total > 0 && (
                        <div className="flex h-2 rounded overflow-hidden bg-neutral-900">
                          <div className="bg-green-500" style={{ width: `${(r.w / total) * 100}%` }} />
                          <div className="bg-neutral-500" style={{ width: `${(r.d / total) * 100}%` }} />
                          <div className="bg-red-500" style={{ width: `${(r.l / total) * 100}%` }} />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
          <PhaseBreakdownPanel stats={stats} totalUserMistakes={totalUserMistakes} />
        </div>
      )}

      {tab === 'weaknesses' && (
        <div className="space-y-5">
          {(recurring.exact.length > 0 || recurring.byOpening.length > 0) && (
            <RecurringMistakesPanel exact={recurring.exact} byOpening={recurring.byOpening} />
          )}
          {motifRadar.length > 0 && (
            <MotifRadarPanel radar={motifRadar} onDrill={onDrillMotif} />
          )}
          <BlunderHeatmap analyses={analyses} />
          <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-4">
            <h3 className="font-semibold mb-3">Distribution de tes coups</h3>
            <div className="space-y-2">
              {classOrder.map(c => {
                const n = stats.byClass[c]
                const pct = stats.totalMoves ? (n / stats.totalMoves) * 100 : 0
                return (
                  <div key={c} className="text-sm">
                    <div className="flex justify-between text-xs text-neutral-400 mb-1">
                      <span>{CLASSIFICATION_LABELS[c]}</span>
                      <span>{n} · {pct.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-neutral-900 rounded h-2 overflow-hidden">
                      <div
                        className="h-full"
                        style={{ width: `${pct}%`, backgroundColor: CLASSIFICATION_COLORS[c] }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {tab === 'openings' && (
        <div className="space-y-5">
          <StudyRecommendations analyses={analyses} />
          <ProgressCharts analyses={analyses} />
          <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-4">
            <h3 className="font-semibold mb-3">Ouvertures jouées</h3>
            {stats.openingGroups.length === 0 ? (
              <p className="text-sm text-neutral-500">Pas encore de données.</p>
            ) : (
              <OpeningTable groups={stats.openingGroups} />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function TabBtn({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-2 -mb-px border-b-2 transition-colors ${
        active
          ? 'border-[var(--color-accent)] text-white'
          : 'border-transparent text-neutral-400 hover:text-neutral-200'
      }`}
    >{children}</button>
  )
}

function OpeningTable({ groups }: { groups: AggregateStats['openingGroups'] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  function toggle(name: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  return (
    <table className="w-full text-sm">
      <thead className="text-neutral-500 text-xs border-b border-[var(--color-border)]">
        <tr>
          <th className="text-left font-normal py-2">Ouverture</th>
          <th className="text-center font-normal">Parties</th>
          <th className="text-center font-normal">% Victoire</th>
        </tr>
      </thead>
      <tbody>
        {groups.map(g => {
          const isExp = expanded.has(g.name)
          const hasMultipleVariations = g.variations.length > 1
          const winRate = g.played ? (g.wins / g.played) * 100 : 0
          return (
            <Fragment key={g.name}>
              <tr
                className={`border-b border-[var(--color-border)] ${hasMultipleVariations ? 'cursor-pointer hover:bg-neutral-800/50' : ''}`}
                onClick={() => hasMultipleVariations && toggle(g.name)}
              >
                <td className="py-2">
                  <span className="inline-block w-4 text-neutral-500">
                    {hasMultipleVariations ? (isExp ? '▾' : '▸') : ''}
                  </span>
                  <span className="font-medium">{g.name}</span>
                  {hasMultipleVariations && (
                    <span className="text-xs text-neutral-500 ml-2">
                      ({g.variations.length} variations)
                    </span>
                  )}
                </td>
                <td className="text-center">{g.played}</td>
                <td className="text-center">
                  <WinRate winRate={winRate} wins={g.wins} played={g.played} />
                </td>
              </tr>
              {isExp && g.variations.map(v => {
                const vRate = v.played ? (v.wins / v.played) * 100 : 0
                return (
                  <tr key={`${g.name}::${v.name}`} className="border-b border-[var(--color-border)] last:border-0 bg-neutral-900/40">
                    <td className="py-1.5 pl-8 text-neutral-300 text-xs">
                      {v.name}
                      {v.ecoCode && <span className="font-mono text-[10px] text-neutral-500 ml-2">{v.ecoCode}</span>}
                    </td>
                    <td className="text-center text-xs">{v.played}</td>
                    <td className="text-center">
                      <WinRate winRate={vRate} wins={v.wins} played={v.played} small />
                    </td>
                  </tr>
                )
              })}
            </Fragment>
          )
        })}
      </tbody>
    </table>
  )
}

function WinRate({ winRate, wins, played, small }: { winRate: number; wins: number; played: number; small?: boolean }) {
  const color = winRate >= 50 ? 'text-green-400' : winRate >= 33 ? 'text-neutral-300' : 'text-red-400'
  return (
    <>
      <span className={`${color} ${small ? 'text-xs' : ''}`}>{winRate.toFixed(0)}%</span>
      <span className={`text-neutral-500 ml-1 ${small ? 'text-[10px]' : 'text-xs'}`}>({wins}/{played})</span>
    </>
  )
}

function MotifRadarPanel({
  radar, onDrill,
}: {
  radar: MotifStat[]
  onDrill?: (motif: MotifTag) => void
}) {
  // Confidence filter: stat needs ≥3 datapoints to be actionable. Show
  // the rest as muted afterthoughts.
  const reliable = radar.filter(r => r.total >= 3)
  const fragile = radar.filter(r => r.total < 3)

  return (
    <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-4">
      <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
        <h3 className="font-semibold">Radar des motifs tactiques</h3>
        <span className="text-xs text-neutral-500">% raté = motifs manqués / total rencontres</span>
      </div>
      {reliable.length === 0 ? (
        <p className="text-sm text-neutral-500">
          Pas encore assez de données. Analyse plus de parties pour faire émerger ton radar.
        </p>
      ) : (
        <div className="space-y-2">
          {reliable.map(s => (
            <MotifRow key={s.motif} stat={s} onDrill={onDrill} />
          ))}
        </div>
      )}
      {fragile.length > 0 && (
        <details className="mt-3 text-xs">
          <summary className="cursor-pointer text-neutral-500">
            Motifs vus 1-2 fois ({fragile.length}) — échantillon trop faible
          </summary>
          <div className="mt-2 space-y-1 pl-3">
            {fragile.map(s => (
              <div key={s.motif} className="flex items-baseline gap-2 text-neutral-500">
                <span>{s.label}</span>
                <span className="font-mono">{s.missed}M / {s.found}T</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}

function TrendPanel({ trend }: { trend: Trend }) {
  return (
    <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-4">
      <div className="flex items-baseline justify-between flex-wrap gap-2 mb-3">
        <h3 className="font-semibold">Tendance récente</h3>
        <span className="text-xs text-neutral-500">
          Semaine dernière active vs les 4 précédentes
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <TrendCard
          label="Précision (cp/coup)"
          delta={trend.cpLoss}
          formatRecent={v => v.toFixed(0)}
          formatDelta={d => `${d > 0 ? '+' : ''}${d.toFixed(0)} cp`}
        />
        <TrendCard
          label="Blunders / partie"
          delta={trend.blundersPerGame}
          formatRecent={v => v.toFixed(2)}
          formatDelta={d => `${d > 0 ? '+' : ''}${d.toFixed(2)}`}
        />
        <TrendCard
          label="Win rate"
          delta={trend.winRate}
          formatRecent={v => `${(v * 100).toFixed(0)}%`}
          formatDelta={d => `${d > 0 ? '+' : ''}${(d * 100).toFixed(0)} pt`}
        />
        <TrendCard
          label="Parties / semaine"
          delta={trend.gamesPerWeek}
          formatRecent={v => v.toFixed(0)}
          formatDelta={d => `${d > 0 ? '+' : ''}${d.toFixed(0)}`}
        />
      </div>
      <p className="text-[10px] text-neutral-500 mt-2">
        Comparaison sur la dernière semaine active ({trend.cpLoss.recentGames} partie{trend.cpLoss.recentGames > 1 ? 's' : ''}) face aux 4 d'avant ({trend.cpLoss.baselineGames} parties).
      </p>
    </div>
  )
}

function TrendCard({
  label, delta, formatRecent, formatDelta,
}: {
  label: string
  delta: TrendDelta
  formatRecent: (v: number) => string
  formatDelta: (d: number) => string
}) {
  const dir = trendDirection(delta)
  const colorClass = dir === 'improved' ? 'text-green-400'
    : dir === 'worsened' ? 'text-red-400'
    : 'text-neutral-400'
  const arrow = dir === 'improved' ? (delta.delta < 0 ? '↓' : '↑')
    : dir === 'worsened' ? (delta.delta < 0 ? '↓' : '↑')
    : '·'
  return (
    <div className="bg-neutral-900/60 border border-[var(--color-border)] rounded-md p-3">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="text-2xl font-bold mt-1">{formatRecent(delta.recent)}</div>
      <div className={`text-xs mt-1 flex items-center gap-1 ${colorClass}`}>
        <span>{arrow}</span>
        <span className="font-mono">{formatDelta(delta.delta)}</span>
      </div>
    </div>
  )
}

function RecurringMistakesPanel({
  exact, byOpening,
}: {
  exact: RecurringMistake[]
  byOpening: RecurringMistake[]
}) {
  const exactSig = new Set(
    exact.map(e => `${e.occurrences[0]?.opening}||${e.sanPlayed}`),
  )
  const openingOnly = byOpening.filter(
    o => !exactSig.has(`${o.parentOpening}||${o.sanPlayed}`),
  )
  const [opened, setOpened] = useState<RecurringMistake | null>(null)
  return (
    <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-4 space-y-4">
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <h3 className="font-semibold">Tes erreurs récurrentes</h3>
        <span className="text-xs text-neutral-500">
          Clique pour ouvrir la position
        </span>
      </div>

      {exact.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-neutral-400 mb-2 uppercase tracking-wider">
            Même position, même mauvais coup
          </h4>
          <ul className="space-y-3">
            {exact.slice(0, 5).map(m => (
              <RecurringRow key={m.id} m={m} showBoard onOpen={() => setOpened(m)} />
            ))}
          </ul>
        </div>
      )}

      {openingOnly.length > 0 && (
        <details>
          <summary className="cursor-pointer text-xs font-semibold text-neutral-400 uppercase tracking-wider">
            Même mauvais coup dans la même ouverture ({openingOnly.length})
          </summary>
          <ul className="space-y-2 mt-2">
            {openingOnly.slice(0, 10).map(m => (
              <RecurringRow key={m.id} m={m} onOpen={() => setOpened(m)} />
            ))}
          </ul>
        </details>
      )}

      {opened && opened.positionKey && (
        <PositionExplorer
          fen={opened.positionKey + (opened.positionKey.split(' ').length < 4 ? ' - - 0 1' : '')}
          onClose={() => setOpened(null)}
          playedSan={opened.sanPlayed}
          bestSan={opened.bestSan}
          title={`${opened.sanPlayed} × ${opened.occurrences.length} · ${opened.parentOpening ?? ''}`}
        />
      )}
    </div>
  )
}

function RecurringRow({
  m, showBoard, onOpen,
}: {
  m: RecurringMistake
  showBoard?: boolean
  onOpen?: () => void
}) {
  const clickable = !!onOpen && !!m.positionKey
  return (
    <li
      onClick={onOpen}
      className={`bg-neutral-900/50 border border-[var(--color-border)] rounded p-3 flex gap-3 items-start ${
        clickable ? 'cursor-pointer hover:border-[var(--color-accent)]/60 transition-colors' : ''
      }`}
    >
      {showBoard && m.positionKey && (
        <div className="shrink-0 w-32 pointer-events-none">
          <TrainingBoard
            position={m.positionKey}
            orientation="white"
            allowDragging={false}
            maxWidth={128}
            id={m.id}
          />
        </div>
      )}
      <div className="flex-1 min-w-0 text-sm">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-red-300 font-mono font-bold">{m.sanPlayed}</span>
          <span className="text-neutral-500">×</span>
          <span className="font-bold text-neutral-200">{m.occurrences.length} fois</span>
          <span className="text-xs text-neutral-500">· perdu {m.totalCpLost} cp au total</span>
          {m.bestSan && m.bestSan !== m.sanPlayed && (
            <span className="text-xs text-neutral-400">
              · meilleur : <span className="font-mono text-green-300">{m.bestSan}</span>
            </span>
          )}
        </div>
        <div className="text-xs text-neutral-500 mt-0.5">
          {m.parentOpening && <>Dans <span className="text-neutral-300">{m.parentOpening}</span> · </>}
          {m.occurrences.length > 0 && (
            <>dernière vs <span className="text-neutral-300">{m.occurrences[0].opponent}</span> il y a {daysAgo(m.occurrences[0].endTime)} j</>
          )}
        </div>
        <div className="text-[10px] text-neutral-500 mt-1">
          {m.occurrences.slice(0, 5).map((o, i) => (
            <span key={i} className="mr-2">
              {new Date(o.endTime * 1000).toLocaleDateString()} vs {o.opponent}
            </span>
          ))}
        </div>
      </div>
    </li>
  )
}

function MotifRow({
  stat, onDrill,
}: {
  stat: MotifStat
  onDrill?: (motif: MotifTag) => void
}) {
  const pct = stat.missRate * 100
  const barColor = pct >= 60 ? 'bg-red-500'
    : pct >= 35 ? 'bg-orange-400'
    : 'bg-green-500'
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-28 text-neutral-300 truncate" title={stat.label}>{stat.label}</span>
      <div className="flex-1 h-2 bg-neutral-900 rounded overflow-hidden">
        <div className={`h-full ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <Tooltip content="% raté = motifs manqués divisés par motifs rencontrés (manqués + trouvés)">
        <span className="font-mono text-xs text-neutral-300 w-14 text-right cursor-help underline decoration-dotted decoration-neutral-700">{pct.toFixed(0)}%</span>
      </Tooltip>
      <Tooltip content="M = motifs manqués (tu as joué un autre coup) · T = motifs trouvés (tu as joué le bon)">
        <span className="font-mono text-[10px] text-neutral-500 w-16 cursor-help">
          {stat.missed}M / {stat.found}T
        </span>
      </Tooltip>
      {onDrill && stat.missed > 0 && (
        <button
          onClick={() => onDrill(stat.motif)}
          className="text-xs px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200"
          title={`Drill les ${stat.missed} ${stat.label.toLowerCase()} ratés`}
        >Drill</button>
      )}
    </div>
  )
}

// Phase breakdown: per-phase avg cpLoss + counts. Worst phase gets called
// out so the user knows where the bleeding happens.
function PhaseBreakdownPanel({
  stats, totalUserMistakes,
}: { stats: AggregateStats; totalUserMistakes: number }) {
  const phases = ['opening', 'middlegame', 'endgame'] as const
  const phaseList = phases.map(p => ({ key: p, ...stats.phases[p] }))
  const activePhases = phaseList.filter(p => p.userMoves > 0)
  const worstByCpLoss = activePhases.length > 0
    ? activePhases.reduce((a, b) => a.avgCpLoss > b.avgCpLoss ? a : b)
    : null
  const maxCpLoss = Math.max(40, ...activePhases.map(p => p.avgCpLoss))

  return (
    <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-4">
      <div className="flex items-baseline justify-between mb-1">
        <h3 className="font-semibold">Performance par phase</h3>
        <Tooltip content="Ouverture = 1-20 plies. Finale = 20 derniers plies. Milieu = le reste.">
          <span className="text-[10px] text-neutral-500 cursor-help">ℹ︎</span>
        </Tooltip>
      </div>
      <p className="text-xs text-neutral-500 mb-3">
        Où la précision décroche dans la partie.
      </p>
      <div className="space-y-2.5">
        {phaseList.map(p => {
          const pct = maxCpLoss > 0 ? Math.min(100, (p.avgCpLoss / maxCpLoss) * 100) : 0
          const isWorst = worstByCpLoss?.key === p.key && activePhases.length > 1
          return (
            <div key={p.key} className="text-sm">
              <div className="flex justify-between items-baseline text-xs mb-1">
                <span className={isWorst ? 'text-red-300 font-medium' : 'text-neutral-300'}>
                  {PHASE_LABELS[p.key as Phase]}
                  {isWorst && <span className="ml-1 text-[10px] uppercase tracking-wider">le plus faible</span>}
                </span>
                <span className="text-neutral-400 font-mono">
                  {p.userMoves > 0 ? `${p.avgCpLoss.toFixed(0)} cp/coup` : '—'}
                </span>
              </div>
              <div className="w-full bg-neutral-900 rounded h-1.5 overflow-hidden">
                <div
                  className="h-full transition-all"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: isWorst ? '#ef4444' : '#7aa6ee',
                  }}
                />
              </div>
              <div className="flex gap-3 text-[11px] text-neutral-500 mt-1">
                <span>{p.userMoves} coups</span>
                {p.blunders > 0 && <span style={{ color: CLASSIFICATION_COLORS.blunder }}>{p.blunders} gaffes</span>}
                {p.mistakes > 0 && <span style={{ color: CLASSIFICATION_COLORS.mistake }}>{p.mistakes} err.</span>}
                {p.inaccuracies > 0 && <span style={{ color: CLASSIFICATION_COLORS.inaccuracy }}>{p.inaccuracies} inex.</span>}
              </div>
            </div>
          )
        })}
      </div>
      <div className="mt-3 text-xs text-neutral-500">
        Total : {totalUserMistakes} coups imprécis toutes phases.
      </div>
    </div>
  )
}
