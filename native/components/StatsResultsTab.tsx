// "Résultats": every game of the window, analysed or not. The score first,
// then what stands out against your usual results, then the detail: rating,
// colours, how games end, opponents' strength, form.
import { StyleSheet, Text, View } from 'react-native'
import {
  ENDING_LABELS,
  DAY_PART_LABELS,
  SHORT_GAME,
  formatCount,
  scoreOf,
  totalOf,
  type Ending,
  type ResultInsight,
  type ResultsStats,
  type WDL,
} from '@shared/analysis/results'
import { TIME_CLASS_LABELS } from '@shared/analysis/statsFilter'
import StatsBarRow from '@/components/StatsBarRow'
import StatsSparkline from '@/components/StatsSparkline'
import { Card, T } from '@/components/ui'
import { C } from '@/constants/theme'

const pct = (x: number) => `${Math.round(x * 100)}\u00a0%`
/** A share that rounds to 0 but is not: "<1 %". */
const share = (x: number) => (x > 0 && x < 0.005 ? '<1\u00a0%' : pct(x))
const plural = (n: number, word: string) => `${formatCount(n)} ${word}${n > 1 ? 's' : ''}`

export default function StatsResultsTab({ stats, usual, insights, periodLong }: {
  stats: ResultsStats
  /** The games before the window, when there are enough to compare. */
  usual: ResultsStats | null
  insights: ResultInsight[]
  periodLong: string
}) {
  const score = scoreOf(stats.all)
  const live = totalOf(stats.afterLoss) + totalOf(stats.otherwise)
  return (
    <>
      <Card style={styles.gap}>
        <View style={styles.between}>
          <View>
            <Text style={styles.big}>{pct(score)}</Text>
            <T tone="faint" style={styles.small}>des points {periodLong}</T>
          </View>
          <View style={styles.right}>
            <T style={styles.wdl}>
              <Text style={{ color: C.win }}>{formatCount(stats.all.w)} V</Text> · <Text style={{ color: C.muted }}>{formatCount(stats.all.d)} N</Text> · <Text style={{ color: C.loss }}>{formatCount(stats.all.l)} D</Text>
            </T>
            {usual && <T tone="faint" style={styles.small}>d'habitude {pct(scoreOf(usual.all))}</T>}
          </View>
        </View>
        <WdlBar r={stats.all} />
        <T tone="muted" style={styles.small}>
          {plural(stats.games, 'partie')} · {plural(stats.activeDays, 'jour')} de jeu · {Math.round(stats.avgMoves)} coups en moyenne
        </T>
      </Card>

      {insights.length > 0 && (
        <Card style={styles.list}>
          <T tone="strong" style={styles.bold}>À retenir</T>
          {insights.map((i, k) => (
            <View key={k} style={styles.insight}>
              <Text style={[styles.icon, { color: i.kind === 'strength' ? C.win : C.warn }]}>{i.kind === 'strength' ? '▲' : '!'}</Text>
              <T style={styles.insightText}>{i.text}</T>
            </View>
          ))}
        </Card>
      )}

      {stats.ratings.length > 0 && (
        <Card style={styles.gap}>
          <T tone="strong" style={styles.bold}>Classement</T>
          {stats.ratings.slice(0, 3).map(t => (
            <View key={t.timeClass} style={styles.track}>
              <View style={styles.between}>
                <T>{TIME_CLASS_LABELS[t.timeClass] ?? t.timeClass}</T>
                <T>
                  <Text style={styles.rating}>{t.end}</Text>
                  <Text style={{ color: t.delta > 0 ? C.win : t.delta < 0 ? C.loss : C.muted }}>  {t.delta > 0 ? '+' : t.delta < 0 ? '−' : '±'}{Math.abs(t.delta)}</Text>
                </T>
              </View>
              {t.series.length > 2 && <StatsSparkline values={t.series} up color={t.delta >= 0 ? C.accentHover : C.danger} />}
              <T tone="faint" style={styles.small}>{plural(t.games, 'partie')} classée{t.games > 1 ? 's' : ''} · départ {t.start} · pic {t.peak}</T>
            </View>
          ))}
        </Card>
      )}

      <Card style={styles.gap}>
        <T tone="strong" style={styles.bold}>Par couleur</T>
        {(['white', 'black'] as const).map(color => {
          const r = stats.byColor[color]
          if (totalOf(r) === 0) return null
          return (
            <View key={color} style={styles.track}>
              <View style={styles.between}>
                <T>{color === 'white' ? 'Blancs' : 'Noirs'}</T>
                <T tone="muted" style={styles.small}>{pct(scoreOf(r))} · {formatCount(r.w)}V / {formatCount(r.d)}N / {formatCount(r.l)}D</T>
              </View>
              <WdlBar r={r} />
            </View>
          )
        })}
      </Card>

      <EndingsCard stats={stats} />

      <Card style={styles.gap}>
        <T tone="strong" style={styles.bold}>Selon le niveau adverse</T>
        <T tone="faint" style={styles.small}>Ton score, et celui que l'écart de classement prévoit.</T>
        {stats.gaps.filter(g => totalOf(g) > 0).map(g => {
          const s = scoreOf(g)
          const color = s >= g.expected + 0.05 ? '#22c55e' : s <= g.expected - 0.05 ? '#ef4444' : '#7aa6ee'
          return (
            <StatsBarRow
              key={g.id}
              label={g.label}
              value={`${pct(s)} · prévu ${pct(g.expected)}`}
              hint={plural(totalOf(g), 'partie')}
              pct={s * 100}
              color={color}
            />
          )
        })}
      </Card>

      {live >= 10 && (
        <Card style={styles.gap}>
          <T tone="strong" style={styles.bold}>Forme</T>
          <T tone="faint" style={styles.small}>Parties en direct (hors Daily). « Après une défaite » : relancée moins de 45 min après une défaite.</T>
          {totalOf(stats.afterLoss) > 0 && (
            <StatsBarRow label="Juste après une défaite" value={pct(scoreOf(stats.afterLoss))} hint={plural(totalOf(stats.afterLoss), 'partie')} pct={scoreOf(stats.afterLoss) * 100} color={scoreOf(stats.afterLoss) < scoreOf(stats.otherwise) - 0.05 ? '#ef4444' : '#7aa6ee'} />
          )}
          <StatsBarRow label="Le reste du temps" value={pct(scoreOf(stats.otherwise))} hint={plural(totalOf(stats.otherwise), 'partie')} pct={scoreOf(stats.otherwise) * 100} color="#7aa6ee" />
          {stats.dayParts.filter(p => totalOf(p) > 0).map(p => (
            <StatsBarRow key={p.id} label={DAY_PART_LABELS[p.id]} value={pct(scoreOf(p))} hint={plural(totalOf(p), 'partie')} pct={scoreOf(p) * 100} color="#a78bfa" />
          ))}
        </Card>
      )}
    </>
  )
}

const LOSS_ORDER: Ending[] = ['checkmate', 'resign', 'time', 'abandon', 'other']
const DRAW_ORDER: Ending[] = ['agreed', 'repetition', 'stalemate', 'insufficient', '50move', 'timevsinsufficient', 'other']
const ENDING_COLORS: Partial<Record<Ending, string>> = { checkmate: '#ef4444', resign: '#fb923c', time: '#fbbf24', abandon: '#737373' }

function EndingsCard({ stats }: { stats: ResultsStats }) {
  const { w, d, l } = stats.all
  const rows = (by: Partial<Record<Ending, number>>, total: number, order: Ending[]) =>
    order.filter(e => (by[e] ?? 0) > 0).sort((a, b) => (by[b] ?? 0) - (by[a] ?? 0)).map(e => {
      const n = by[e] ?? 0
      return <StatsBarRow key={e} label={ENDING_LABELS[e]} value={`${share(n / total)} · ${formatCount(n)}`} pct={(n / total) * 100} color={ENDING_COLORS[e] ?? '#7aa6ee'} />
    })
  return (
    <Card style={styles.gap}>
      <T tone="strong" style={styles.bold}>Comment se finissent tes parties</T>
      {l > 0 && (
        <>
          <T tone="muted" style={styles.sub}>{plural(l, 'défaite')}</T>
          {rows(stats.lossesBy, l, LOSS_ORDER)}
          <T tone="faint" style={styles.small}>
            Défaites express (≤ {SHORT_GAME} coups) : {formatCount(stats.shortLosses)} · {pct(stats.shortLosses / l)}
          </T>
        </>
      )}
      {w > 0 && (
        <>
          <T tone="muted" style={styles.sub}>{plural(w, 'victoire')}</T>
          {rows(stats.winsBy, w, LOSS_ORDER)}
        </>
      )}
      {d > 0 && (
        <>
          <T tone="muted" style={styles.sub}>{plural(d, 'nulle')}</T>
          <T tone="faint" style={styles.small}>
            {DRAW_ORDER.filter(e => (stats.drawsBy[e] ?? 0) > 0).map(e => `${ENDING_LABELS[e]} ${formatCount(stats.drawsBy[e] ?? 0)}`).join(' · ')}
          </T>
        </>
      )}
    </Card>
  )
}

export function WdlBar({ r }: { r: WDL }) {
  if (totalOf(r) === 0) return null
  return (
    <View style={styles.stack}>
      <View style={{ flex: r.w, backgroundColor: '#22c55e' }} />
      <View style={{ flex: r.d, backgroundColor: '#737373' }} />
      <View style={{ flex: r.l, backgroundColor: '#ef4444' }} />
    </View>
  )
}

const styles = StyleSheet.create({
  bold: { fontWeight: '600' },
  small: { fontSize: 12, lineHeight: 17 },
  sub: { fontSize: 13, fontWeight: '600', marginTop: 4 },
  gap: { gap: 10 },
  list: { gap: 8 },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 },
  right: { alignItems: 'flex-end', gap: 2 },
  big: { color: C.strong, fontSize: 34, fontWeight: '700' },
  wdl: { fontSize: 15, fontWeight: '600' },
  rating: { color: C.strong, fontSize: 18, fontWeight: '700' },
  track: { gap: 6 },
  stack: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: '#171717' },
  insight: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  icon: { width: 16, textAlign: 'center', fontSize: 14, fontWeight: '800', lineHeight: 21 },
  insightText: { flex: 1 },
})
