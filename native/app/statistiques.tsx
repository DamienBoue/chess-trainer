// Statistiques. A window (7 days … always) and a time control apply to every
// tab: recent games say how you play now. "Résultats" and "Ouvertures" read
// every game played; "Précision" and "Faiblesses" the analysed ones.
import { useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Stack, router } from 'expo-router'
import { aggregate, deriveInsights, PHASE_LABELS, type AggregateStats } from '@shared/analysis/aggregate'
import { CLASSIFICATION_COLORS, CLASSIFICATION_LABELS } from '@shared/analysis/classify'
import { extractExercises } from '@shared/analysis/exercises'
import { computeMotifRadar } from '@shared/analysis/motifRadar'
import { MIN_GAMES, computeResults, formatCount, ratingsBefore, resultsInsights, scoreOf, standardRows } from '@shared/analysis/results'
import {
  PERIODS,
  TIME_CLASS_LABELS,
  filterAnalyses,
  parseFilter,
  periodLong,
  periodStart,
  timeClassOptions,
  type StatsFilter,
} from '@shared/analysis/statsFilter'
import { buildStrengths } from '@shared/analysis/strengths'
import { buildTimeline } from '@shared/analysis/timeline'
import { computeTrend, trendDirection, type TrendDelta } from '@shared/analysis/trend'
import { KEYS } from '@shared/storage/keys'
import Segmented from '@/components/Segmented'
import StatsBarRow from '@/components/StatsBarRow'
import StatsOpeningsTab from '@/components/StatsOpeningsTab'
import StatsResultsTab from '@/components/StatsResultsTab'
import StatsSparkline from '@/components/StatsSparkline'
import { Button, Card, H1, Loading, Screen, T } from '@/components/ui'
import { useAnalyses, useAppData, useGameRows } from '@/lib/appData'
import { C, TOUCH } from '@/constants/theme'

type Tab = 'results' | 'precision' | 'weaknesses' | 'openings'
const TABS: { id: Tab; label: string }[] = [
  { id: 'results', label: 'Résultats' },
  { id: 'precision', label: 'Précision' },
  { id: 'weaknesses', label: 'Faiblesses' },
  { id: 'openings', label: 'Ouvertures' },
]
const CLASS_ORDER = ['best', 'great', 'good', 'inaccuracy', 'mistake', 'blunder', 'book'] as const

function loadFilter(): StatsFilter {
  try { return parseFilter(localStorage.getItem(KEYS.statsFilter)) } catch { return parseFilter(null) }
}

export default function StatsScreen() {
  const { digests, history } = useAppData()
  const [stored, setStored] = useState(loadFilter)
  const [now] = useState(() => Date.now())
  const [tab, setTab] = useState<Tab>('results')

  // Results read the games' rows; the precision tabs, every analysis, only
  // once opened.
  const loadedRows = useGameRows()
  const rows = useMemo(() => standardRows(loadedRows ?? []), [loadedRows])
  const analyses = useAnalyses(tab === 'precision' || tab === 'weaknesses')
  const allAnalyses = useMemo(() => Object.values(analyses ?? {}), [analyses])
  const tcOptions = useMemo(() => timeClassOptions(rows.map(r => r.timeClass)), [rows])
  // A stored time control no longer played falls back to all of them.
  const filter: StatsFilter = tcOptions.includes(stored.timeClass) ? stored : { ...stored, timeClass: 'all' }
  const setFilter = (next: StatsFilter) => {
    setStored(next)
    try { localStorage.setItem(KEYS.statsFilter, JSON.stringify(next)) } catch { /* kept for this visit only */ }
  }

  const start = periodStart(filter.period, now)
  const tcRows = useMemo(() => (filter.timeClass === 'all' ? rows : rows.filter(r => r.timeClass === filter.timeClass)), [rows, filter.timeClass])
  const windowRows = useMemo(() => (start === null ? tcRows : tcRows.filter(r => r.end >= start)), [tcRows, start])
  const results = useMemo(() => computeResults(windowRows, { before: ratingsBefore(tcRows, start) }), [windowRows, tcRows, start])
  const before = useMemo(() => (start === null ? null : computeResults(tcRows.filter(r => r.end < start))), [tcRows, start])
  const usual = before && before.games >= 30 ? before : null
  const highlights = useMemo(() => resultsInsights(results, before), [results, before])

  const list = useMemo(() => filterAnalyses(allAnalyses, filter, now), [allAnalyses, filter.period, filter.timeClass, now]) // eslint-disable-line react-hooks/exhaustive-deps
  const stats = useMemo(() => aggregate(list), [list])
  const insights = useMemo(() => deriveInsights(stats), [stats])
  const exercises = useMemo(() => extractExercises(list), [list])
  const radar = useMemo(() => computeMotifRadar(exercises), [exercises])
  const strengths = useMemo(() => buildStrengths({ stats, exercises }), [stats, exercises])
  const timeline = useMemo(() => buildTimeline(list), [list])
  const trend = useMemo(() => computeTrend(timeline), [timeline])

  if (!loadedRows) return <Loading />
  if (rows.length === 0 && Object.keys(digests).length === 0) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Statistiques' }} />
        <H1>Pas encore de stats</H1>
        <Card>
          <T tone="muted">Les stats se calculent sur tes parties chess.com. Récupère-les dans Parties pour débloquer cette page.</T>
        </Card>
        <Button label="Voir mes parties" onPress={() => router.push('/parties')} />
      </Screen>
    )
  }

  const long = periodLong(filter.period)
  const fullHistory = history.total > 0 && history.done >= history.total - 1
  const oldest = rows[0]?.end

  const n = stats.gamesAnalyzed
  const totalMistakes = stats.byClass.blunder + stats.byClass.mistake + stats.byClass.inaccuracy

  const notAnalysed = (
    <Card style={styles.gap}>
      <T tone="muted">Aucune partie analysée {long}{filter.timeClass !== 'all' ? ` en ${TIME_CLASS_LABELS[filter.timeClass].toLowerCase()}` : ''}. La précision et les faiblesses viennent de l'analyse Stockfish de tes parties.</T>
      <Button label="Analyser mes parties récentes" onPress={() => router.push('/parties')} />
    </Card>
  )

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Statistiques' }} />
      <Segmented
        label="Période"
        options={PERIODS.map(p => ({ value: p.id, label: p.label }))}
        value={filter.period}
        onChange={period => setFilter({ ...filter, period })}
      />
      {tcOptions.length > 0 && (
        <Segmented
          label="Cadence"
          options={tcOptions.map(c => ({ value: c, label: TIME_CLASS_LABELS[c] }))}
          value={filter.timeClass}
          onChange={timeClass => setFilter({ ...filter, timeClass })}
        />
      )}

      <View style={styles.tabs}>
        {TABS.map(t => (
          <Pressable
            key={t.id}
            onPress={() => setTab(t.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === t.id }}
            aria-selected={tab === t.id}
            style={[styles.tab, tab === t.id && styles.tabActive]}
          >
            <Text style={[styles.tabText, tab === t.id && { color: C.strong }]} numberOfLines={1}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      {tab === 'results' && (results.games === 0 ? (
        <Card style={styles.gap}>
          <T tone="muted">Aucune partie {long}.</T>
          {filter.period !== 'all' && <Button label="Voir depuis toujours" kind="secondary" onPress={() => setFilter({ ...filter, period: 'all' })} />}
        </Card>
      ) : (
        <>
          {results.games < MIN_GAMES && <T tone="faint" style={styles.small}>Moins de {MIN_GAMES} parties {long} : élargis la période pour des tendances fiables.</T>}
          <StatsResultsTab stats={results} usual={usual} insights={highlights} periodLong={long} />
        </>
      ))}

      {tab === 'openings' && (results.games === 0 ? (
        <Card><T tone="muted">Aucune partie {long}.</T></Card>
      ) : (
        <StatsOpeningsTab openings={results.openings} average={scoreOf(results.all)} />
      ))}

      {(tab === 'results' || tab === 'openings') && oldest !== undefined && !fullHistory && (
        <T tone="faint" style={styles.small}>
          Calculé sur les {formatCount(rows.length)} parties récupérées (depuis le {new Date(oldest).toLocaleDateString('fr-FR')}). Pour remonter plus loin : Parties → Historique complet.
        </T>
      )}

      {(tab === 'precision' || tab === 'weaknesses') && !analyses && (
        <Card><T tone="muted">Chargement des analyses…</T></Card>
      )}
      {(tab === 'precision' || tab === 'weaknesses') && analyses && n === 0 && notAnalysed}
      {(tab === 'precision' || tab === 'weaknesses') && n > 0 && (
        <T tone="muted" style={styles.small}>{n} partie{n > 1 ? 's' : ''} analysée{n > 1 ? 's' : ''} parmi les {formatCount(results.games)} jouée{results.games > 1 ? 's' : ''} {long}</T>
      )}

      {tab === 'precision' && n > 0 && (
        <>
          {strengths.length > 0 && (
            <Card style={styles.good}>
              <T tone="win" style={styles.bold}>✓ Tes points forts</T>
              {strengths.map((s, i) => <T key={i}>• {s.text}</T>)}
            </Card>
          )}
          {insights.length > 0 && (
            <Card>
              <T tone="strong" style={styles.bold}>Points clés</T>
              {insights.map((i, idx) => (
                <T key={idx} tone={i.kind === 'weakness' ? 'danger' : i.kind === 'strength' ? 'win' : 'text'}>• {i.text}</T>
              ))}
            </Card>
          )}

          <Card>
            <T tone="strong" style={styles.bold}>Précision moyenne</T>
            <T tone="faint" style={styles.small}>Centipawns perdus par coup vs Stockfish (100 cp = 1 pion).</T>
            <View style={styles.twoCols}>
              <View style={styles.col}>
                <Text style={[styles.big, { color: C.win }]}>{stats.avgCpLossUser.toFixed(0)}<Text style={styles.unit}> cp</Text></Text>
                <T tone="faint" style={styles.small}>Toi</T>
              </View>
              <View style={styles.col}>
                <Text style={[styles.big, { color: C.muted }]}>{stats.avgCpLossOpponent.toFixed(0)}<Text style={styles.unit}> cp</Text></Text>
                <T tone="faint" style={styles.small}>Adversaires</T>
              </View>
            </View>
            <T tone="faint" style={styles.small}>~20-30 maître · 30-60 solide · 60-100 club · 100+ à améliorer</T>
          </Card>

          {trend && (
            <Card style={styles.gap}>
              <T tone="strong" style={styles.bold}>Tendance récente</T>
              <T tone="faint" style={styles.small}>Dernière semaine active vs les 4 précédentes</T>
              <View style={styles.grid}>
                <TrendCell label="Précision (cp/coup)" d={trend.cpLoss} fmt={v => v.toFixed(0)} fmtD={d => `${d > 0 ? '+' : ''}${d.toFixed(0)} cp`} />
                <TrendCell label="Gaffes / partie" d={trend.blundersPerGame} fmt={v => v.toFixed(2)} fmtD={d => `${d > 0 ? '+' : ''}${d.toFixed(2)}`} />
                <TrendCell label="Victoires" d={trend.winRate} fmt={v => `${(v * 100).toFixed(0)}%`} fmtD={d => `${d > 0 ? '+' : ''}${(d * 100).toFixed(0)} pt`} />
                <TrendCell label="Parties / semaine" d={trend.gamesPerWeek} fmt={v => v.toFixed(0)} fmtD={d => `${d > 0 ? '+' : ''}${d.toFixed(0)}`} />
              </View>
            </Card>
          )}

          {timeline.length > 1 && (
            <Card style={styles.gap}>
              <T tone="strong" style={styles.bold}>Précision semaine par semaine</T>
              <T tone="faint" style={styles.small}>cp perdus par coup — plus bas = mieux ({timeline[0].label} → {timeline[timeline.length - 1].label})</T>
              <StatsSparkline values={timeline.map(w => w.avgUserCpLoss)} />
            </Card>
          )}

          <PhasesCard stats={stats} totalMistakes={totalMistakes} />
        </>
      )}

      {tab === 'weaknesses' && n > 0 && (
        <>
          <Card style={styles.gap}>
            <T tone="strong" style={styles.bold}>Motifs tactiques les plus ratés</T>
            <T tone="faint" style={styles.small}>% raté = motifs manqués / motifs rencontrés (M manqués, T trouvés).</T>
            {radar.filter(r => r.total >= 3).length === 0 ? (
              <T tone="muted">Pas encore assez de données. Analyse plus de parties pour faire émerger ton radar.</T>
            ) : (
              radar.filter(r => r.total >= 3).map(s => {
                const pct = s.missRate * 100
                return (
                  <StatsBarRow
                    key={s.motif}
                    label={s.label}
                    value={`${pct.toFixed(0)}%`}
                    hint={`${s.missed}M / ${s.found}T`}
                    pct={pct}
                    color={pct >= 60 ? '#ef4444' : pct >= 35 ? '#fb923c' : '#22c55e'}
                  />
                )
              })
            )}
            {radar.some(r => r.total < 3) && (
              <T tone="faint" style={styles.small}>
                Vus 1-2 fois (échantillon trop faible) : {radar.filter(r => r.total < 3).map(s => `${s.label} ${s.missed}M/${s.found}T`).join(' · ')}
              </T>
            )}
          </Card>

          <Card style={styles.gap}>
            <T tone="strong" style={styles.bold}>Distribution de tes coups</T>
            {CLASS_ORDER.map(c => {
              const count = stats.byClass[c]
              const pct = stats.totalMoves ? (count / stats.totalMoves) * 100 : 0
              return <StatsBarRow key={c} label={CLASSIFICATION_LABELS[c]} value={`${count} · ${pct.toFixed(1)}%`} pct={pct} color={CLASSIFICATION_COLORS[c]} />
            })}
          </Card>
        </>
      )}

    </Screen>
  )
}

function TrendCell({ label, d, fmt, fmtD }: { label: string; d: TrendDelta; fmt: (v: number) => string; fmtD: (d: number) => string }) {
  const dir = trendDirection(d)
  const color = dir === 'improved' ? C.win : dir === 'worsened' ? C.danger : C.muted
  return (
    <View style={styles.cell}>
      <T tone="faint" style={styles.small}>{label}</T>
      <Text style={styles.cellValue}>{fmt(d.recent)}</Text>
      <Text style={{ color, fontSize: 12 }}>{dir === 'improved' ? '▲' : dir === 'worsened' ? '▼' : '='} {fmtD(d.delta)}</Text>
    </View>
  )
}

function PhasesCard({ stats, totalMistakes }: { stats: AggregateStats; totalMistakes: number }) {
  const list = (['opening', 'middlegame', 'endgame'] as const).map(k => ({ key: k, ...stats.phases[k] }))
  const active = list.filter(p => p.userMoves > 0)
  const worst = active.length > 1 ? active.reduce((a, b) => (a.avgCpLoss > b.avgCpLoss ? a : b)) : null
  const max = Math.max(40, ...active.map(p => p.avgCpLoss))
  return (
    <Card style={styles.gap}>
      <T tone="strong" style={styles.bold}>Performance par phase</T>
      <T tone="faint" style={styles.small}>Où la précision décroche. Ouverture = 20 premiers plies, finale = 20 derniers.</T>
      {list.map(p => {
        const isWorst = worst?.key === p.key
        const extras = [
          `${p.userMoves} coups`,
          p.blunders > 0 ? `${p.blunders} gaffes` : '',
          p.mistakes > 0 ? `${p.mistakes} err.` : '',
          p.inaccuracies > 0 ? `${p.inaccuracies} inex.` : '',
        ].filter(Boolean).join(' · ')
        return (
          <StatsBarRow
            key={p.key}
            label={PHASE_LABELS[p.key] + (isWorst ? ' · le plus faible' : '')}
            value={p.userMoves > 0 ? `${p.avgCpLoss.toFixed(0)} cp/coup` : '—'}
            hint={extras}
            pct={(p.avgCpLoss / max) * 100}
            color={isWorst ? '#ef4444' : '#7aa6ee'}
            emphasis={isWorst}
          />
        )
      })}
      <T tone="faint" style={styles.small}>Total : {totalMistakes} coups imprécis, toutes phases.</T>
    </Card>
  )
}

const styles = StyleSheet.create({
  bold: { fontWeight: '600' },
  small: { fontSize: 12, lineHeight: 17 },
  gap: { gap: 10 },
  good: { borderColor: 'rgba(34,197,94,0.35)', backgroundColor: 'rgba(34,197,94,0.06)', gap: 6 },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.border },
  tab: { flex: 1, minHeight: TOUCH, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent', marginBottom: -1 },
  tabActive: { borderBottomColor: C.accent },
  tabText: { color: C.muted, fontSize: 15, fontWeight: '600' },
  twoCols: { flexDirection: 'row', gap: 12, marginVertical: 8 },
  col: { flex: 1 },
  big: { fontSize: 32, fontWeight: '700' },
  unit: { fontSize: 14, fontWeight: '400', color: C.faint },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell: { flexBasis: '48%', flexGrow: 1, backgroundColor: '#1f1f1f', borderRadius: 8, padding: 10, gap: 2 },
  cellValue: { color: C.strong, fontSize: 22, fontWeight: '700' },
})
