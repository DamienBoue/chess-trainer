// Statistiques, as stacked cards: overview, phases, tactical motifs, openings.
// Ported from the website's StatsView; the heatmap, recurring-mistakes boards
// and study recommendations are left out (they need the DOM boards).
import { useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Stack } from 'expo-router'
import { aggregate, deriveInsights, PHASE_LABELS, type AggregateStats } from '@shared/analysis/aggregate'
import { CLASSIFICATION_COLORS, CLASSIFICATION_LABELS } from '@shared/analysis/classify'
import { extractExercises } from '@shared/analysis/exercises'
import { computeMotifRadar } from '@shared/analysis/motifRadar'
import { buildStrengths } from '@shared/analysis/strengths'
import { buildTimeline } from '@shared/analysis/timeline'
import { computeTrend, trendDirection, type TrendDelta } from '@shared/analysis/trend'
import StatsBarRow from '@/components/StatsBarRow'
import StatsSparkline from '@/components/StatsSparkline'
import { Card, H1, Screen, SectionLabel, T } from '@/components/ui'
import { useAppData } from '@/lib/appData'
import { C, TOUCH } from '@/constants/theme'

type Tab = 'overview' | 'weaknesses' | 'openings'
const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Aperçu' },
  { id: 'weaknesses', label: 'Faiblesses' },
  { id: 'openings', label: 'Ouvertures' },
]
const CLASS_ORDER = ['best', 'great', 'good', 'inaccuracy', 'mistake', 'blunder', 'book'] as const

export default function StatsScreen() {
  const { analyses } = useAppData()
  const list = useMemo(() => Object.values(analyses), [analyses])
  const stats = useMemo(() => aggregate(list), [list])
  const insights = useMemo(() => deriveInsights(stats), [stats])
  const exercises = useMemo(() => extractExercises(list), [list])
  const radar = useMemo(() => computeMotifRadar(exercises), [exercises])
  const strengths = useMemo(() => buildStrengths({ stats, exercises }), [stats, exercises])
  const timeline = useMemo(() => buildTimeline(list), [list])
  const trend = useMemo(() => computeTrend(timeline), [timeline])
  const [tab, setTab] = useState<Tab>('overview')

  if (list.length === 0) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Statistiques' }} />
        <H1>Pas encore de stats</H1>
        <Card>
          <T tone="muted">Les stats sont calculées depuis tes parties analysées par Stockfish. Analyse au moins une partie pour débloquer cette page.</T>
        </Card>
      </Screen>
    )
  }

  const n = stats.gamesAnalyzed
  const totalMistakes = stats.byClass.blunder + stats.byClass.mistake + stats.byClass.inaccuracy

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Statistiques' }} />
      <T tone="muted">{n} partie{n > 1 ? 's' : ''} analysée{n > 1 ? 's' : ''}</T>

      <View style={styles.tabs}>
        {TABS.map(t => (
          <Pressable
            key={t.id}
            onPress={() => setTab(t.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === t.id }}
            style={[styles.tab, tab === t.id && styles.tabActive]}
          >
            <Text style={[styles.tabText, tab === t.id && { color: C.strong }]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      {tab === 'overview' && (
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

          <Card style={styles.gap}>
            <T tone="strong" style={styles.bold}>Résultats par couleur</T>
            {(['white', 'black'] as const).map(color => <ResultBar key={color} color={color} r={stats.resultsByColor[color]} />)}
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

      {tab === 'weaknesses' && (
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

      {tab === 'openings' && <OpeningsCard groups={stats.openingGroups} />}
    </Screen>
  )
}

function ResultBar({ color, r }: { color: 'white' | 'black'; r: { w: number; l: number; d: number } }) {
  const total = r.w + r.l + r.d
  return (
    <View style={{ gap: 4 }}>
      <View style={styles.between}>
        <T>{color === 'white' ? 'Blancs' : 'Noirs'}</T>
        <T tone="muted" style={styles.small}>{r.w}V / {r.l}D / {r.d}N</T>
      </View>
      {total > 0 && (
        <View style={styles.stack}>
          <View style={{ flex: r.w, backgroundColor: '#22c55e' }} />
          <View style={{ flex: r.d, backgroundColor: '#737373' }} />
          <View style={{ flex: r.l, backgroundColor: '#ef4444' }} />
        </View>
      )}
    </View>
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

function OpeningsCard({ groups }: { groups: AggregateStats['openingGroups'] }) {
  const [open, setOpen] = useState<Set<string>>(new Set())
  const toggle = (name: string) => setOpen(prev => {
    const next = new Set(prev)
    if (next.has(name)) next.delete(name)
    else next.add(name)
    return next
  })
  return (
    <>
      <SectionLabel>Ouvertures jouées</SectionLabel>
      {groups.length === 0 ? (
        <Card><T tone="muted">Pas encore de données.</T></Card>
      ) : (
        groups.map(g => {
          const multi = g.variations.length > 1
          const isOpen = open.has(g.name)
          return (
            <Card key={g.name} onPress={multi ? () => toggle(g.name) : undefined} style={styles.gap}>
              <View style={styles.between}>
                <T tone="strong" style={[styles.bold, { flex: 1 }]}>{multi ? (isOpen ? '▾ ' : '▸ ') : ''}{g.name}</T>
                <WinRate wins={g.wins} played={g.played} />
              </View>
              {multi && !isOpen && <T tone="faint" style={styles.small}>{g.variations.length} variations</T>}
              {isOpen && g.variations.map(v => (
                <View key={v.name} style={[styles.between, styles.variation]}>
                  <T tone="muted" style={[styles.small, { flex: 1 }]}>{v.name}{v.ecoCode ? ` · ${v.ecoCode}` : ''}</T>
                  <WinRate wins={v.wins} played={v.played} small />
                </View>
              ))}
            </Card>
          )
        })
      )}
    </>
  )
}

function WinRate({ wins, played, small }: { wins: number; played: number; small?: boolean }) {
  const rate = played ? (wins / played) * 100 : 0
  const color = rate >= 50 ? C.win : rate >= 33 ? C.text : C.danger
  return (
    <Text style={{ color, fontSize: small ? 12 : 14 }}>
      {rate.toFixed(0)}% <Text style={{ color: C.faint, fontSize: 11 }}>({wins}/{played})</Text>
    </Text>
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
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 },
  stack: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: '#171717' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell: { flexBasis: '48%', flexGrow: 1, backgroundColor: '#1f1f1f', borderRadius: 8, padding: 10, gap: 2 },
  cellValue: { color: C.strong, fontSize: 22, fontWeight: '700' },
  variation: { paddingLeft: 12, paddingVertical: 4, borderTopWidth: 1, borderTopColor: C.border },
})
