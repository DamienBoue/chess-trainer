// The scouting profile of one player, shared by "Préparer un adversaire" and
// the PGN players screen: stat tiles, recent form, per-colour openings,
// weak / strong openings and time controls.
import { StyleSheet, Text, View } from 'react-native'
import type { ChessComGame } from '@shared/types'
import type { ColorSplit, OpeningStat, ScoutingProfile } from '@shared/analysis/scouting'
import StatsBarRow from '@/components/StatsBarRow'
import { Card, SectionLabel, T } from '@/components/ui'
import { C } from '@/constants/theme'

const TIME_LABELS: Record<string, string> = { rapid: 'Rapide', blitz: 'Blitz', bullet: 'Bullet', daily: 'Correspondance', pgn: 'PGN' }

export function scoutOverall(p: ScoutingProfile): number {
  const wins = p.whiteSide.wins + p.blackSide.wins
  const draws = p.whiteSide.draws + p.blackSide.draws
  return p.games > 0 ? (wins + 0.5 * draws) / p.games : 0
}

function Tile({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileValue}>{value}</Text>
      <Text style={styles.tileLabel}>{label}</Text>
    </View>
  )
}

/** Opening rows: name, games, win rate (colour-coded). */
export function ScoutOpeningRows({ openings, highlightLow }: { openings: OpeningStat[]; highlightLow?: boolean }) {
  if (openings.length === 0) return <T tone="faint">Pas assez de données.</T>
  return (
    <View>
      {openings.map(o => {
        const pct = o.winRate * 100
        const color = highlightLow
          ? (pct < 30 ? C.loss : pct < 50 ? '#fdba74' : C.text)
          : (pct >= 60 ? C.win : pct >= 40 ? C.text : C.loss)
        return (
          <View key={o.name} style={styles.openingRow}>
            <Text style={styles.openingName} numberOfLines={2}>{o.name}</Text>
            <Text style={styles.openingN}>{o.played}×</Text>
            <Text style={[styles.openingPct, { color }]}>{pct.toFixed(0)}%</Text>
          </View>
        )
      })}
    </View>
  )
}

function ColorCard({ title, split }: { title: string; split: ColorSplit }) {
  return (
    <Card style={{ gap: 6 }}>
      <SectionLabel>{title}</SectionLabel>
      <T tone="muted">{split.games} parties · {split.wins}V/{split.losses}D/{split.draws}N · {(split.winRate * 100).toFixed(0)}%</T>
      <ScoutOpeningRows openings={split.openings.slice(0, 6)} />
    </Card>
  )
}

export default function ScoutProfileSections({ profile, games }: { profile: ScoutingProfile; games: ChessComGame[] }) {
  const wins = profile.whiteSide.wins + profile.blackSide.wins
  const losses = profile.whiteSide.losses + profile.blackSide.losses
  const draws = profile.whiteSide.draws + profile.blackSide.draws
  const me = profile.username.toLowerCase()
  const ratings = games
    .map(g => (g.white.username.toLowerCase() === me ? g.black.rating : g.white.rating))
    .filter(r => r > 0)
  const avgOpp = ratings.length > 0 ? Math.round(ratings.reduce((a, b) => a + b, 0) / ratings.length) : 0

  return (
    <View style={{ gap: 12 }}>
      <View style={styles.tiles}>
        <Tile label="Parties scannées" value={profile.games} />
        <Tile label="Score global" value={`${(scoutOverall(profile) * 100).toFixed(0)}%`} />
        <Tile label="Bilan" value={`${wins}V / ${losses}D / ${draws}N`} />
        <Tile label="Elo moyen adv." value={avgOpp || '—'} />
      </View>

      <Card style={{ gap: 8 }}>
        <SectionLabel>Forme récente (plus récent à gauche)</SectionLabel>
        <View style={styles.form}>
          {profile.recentForm.map((r, i) => (
            <Text key={i} style={[styles.formChip, r === 'W' ? styles.formW : r === 'L' ? styles.formL : styles.formD]}>
              {r === 'W' ? 'V' : r === 'L' ? 'D' : 'N'}
            </Text>
          ))}
        </View>
      </Card>

      <ColorCard title="Avec les Blancs" split={profile.whiteSide} />
      <ColorCard title="Avec les Noirs" split={profile.blackSide} />

      <Card style={{ gap: 6 }}>
        <SectionLabel>⚠️ Ouvertures faibles (≥3 parties)</SectionLabel>
        <ScoutOpeningRows openings={profile.worstOpenings} highlightLow />
      </Card>
      <Card style={{ gap: 6 }}>
        <SectionLabel>💪 Ouvertures fortes (≥3 parties)</SectionLabel>
        <ScoutOpeningRows openings={profile.bestOpenings} />
      </Card>

      <Card style={{ gap: 10 }}>
        <SectionLabel>Cadences jouées</SectionLabel>
        {profile.timeClassBreakdown.map(({ tc, games: n, winRate }) => (
          <StatsBarRow key={tc} label={`${TIME_LABELS[tc] ?? tc} · ${n} parties`} value={`${(winRate * 100).toFixed(0)}%`} pct={winRate * 100} color={C.win} />
        ))}
      </Card>
    </View>
  )
}

const styles = StyleSheet.create({
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { flexBasis: '48%', flexGrow: 1, backgroundColor: C.panel, borderColor: C.border, borderWidth: 1, borderRadius: 10, padding: 12, alignItems: 'center' },
  tileValue: { color: C.strong, fontSize: 20, fontWeight: '700' },
  tileLabel: { color: C.faint, fontSize: 12, marginTop: 2 },
  form: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  formChip: { minWidth: 28, textAlign: 'center', paddingVertical: 4, borderRadius: 4, fontSize: 12, fontWeight: '700', overflow: 'hidden' },
  formW: { backgroundColor: 'rgba(22,101,52,0.5)', color: '#86efac' },
  formL: { backgroundColor: 'rgba(127,29,29,0.5)', color: '#fca5a5' },
  formD: { backgroundColor: C.panel2, color: C.text },
  openingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 32, borderTopColor: C.border, borderTopWidth: 1, paddingVertical: 4 },
  openingName: { flex: 1, color: C.text, fontSize: 14 },
  openingN: { color: C.faint, fontSize: 12, width: 32, textAlign: 'right' },
  openingPct: { fontSize: 13, fontWeight: '600', width: 42, textAlign: 'right' },
})
