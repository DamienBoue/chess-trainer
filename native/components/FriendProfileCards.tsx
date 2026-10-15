// Profile cards and the side-by-side metrics for "Comparer avec un ami",
// stacked rather than in the website's table (four columns don't fit 390px).
import { StyleSheet, View } from 'react-native'
import type { ProfileStats } from '@shared/analysis/profile'
import { Card, T } from '@/components/ui'
import { C } from '@/constants/theme'

const pct = (v: number) => `${(v * 100).toFixed(0)}%`
const num = (v: number) => (v ? v.toFixed(0) : '—')

export function FriendProfileCard({ profile, mine }: { profile: ProfileStats; mine?: boolean }) {
  return (
    <Card highlight={mine} style={mine ? undefined : { borderColor: '#3b82f6' }}>
      <View style={styles.head}>
        <T tone="strong" style={styles.name}>@{profile.username}</T>
        <T tone="faint">{profile.games} parties</T>
      </View>
      <View style={styles.stats}>
        <Stat label="Victoires" value={profile.wins} tone="win" />
        <Stat label="Défaites" value={profile.losses} tone="loss" />
        <Stat label="Nulles" value={profile.draws} tone="muted" />
      </View>
      <Line label="Taux de victoire" value={pct(profile.winRate)} />
      <Line label="Elo moyen" value={num(profile.avgRating)} />
      <Line label="Adv. moyen" value={num(profile.avgOppRating)} />
      <Line label="Taux avec les Blancs" value={pct(profile.whiteWinRate)} />
      <Line label="Taux avec les Noirs" value={pct(profile.blackWinRate)} />
      <T tone="faint" style={{ marginTop: 8 }}>Top ouvertures</T>
      {profile.topOpenings.map(o => (
        <View key={o.name} style={styles.line}>
          <T numberOfLines={1} style={{ flex: 1 }}>{o.name}</T>
          <T tone="faint">{o.played}×</T>
        </View>
      ))}
    </Card>
  )
}

export function FriendDirectComparison({ me, friend }: { me: ProfileStats; friend: ProfileStats }) {
  const rows = [
    { label: 'Taux de victoire', me: me.winRate * 100, friend: friend.winRate * 100, f: (v: number) => `${v.toFixed(0)}%` },
    { label: 'Elo moyen', me: me.avgRating, friend: friend.avgRating, f: (v: number) => (v ? v.toFixed(0) : '—') },
    { label: 'Adv. moyen', me: me.avgOppRating, friend: friend.avgOppRating, f: (v: number) => (v ? v.toFixed(0) : '—') },
    { label: 'Taux avec les Blancs', me: me.whiteWinRate * 100, friend: friend.whiteWinRate * 100, f: (v: number) => `${v.toFixed(0)}%` },
    { label: 'Taux avec les Noirs', me: me.blackWinRate * 100, friend: friend.blackWinRate * 100, f: (v: number) => `${v.toFixed(0)}%` },
  ]
  return (
    <Card style={{ gap: 10 }}>
      <T tone="strong">Comparaison directe</T>
      {rows.map(r => {
        const delta = r.me - r.friend
        const tied = Math.abs(delta) < 0.5
        const sign = delta > 0 ? '+' : ''
        return (
          <View key={r.label} style={styles.cmp}>
            <T tone="faint">{r.label}</T>
            <View style={styles.line}>
              <T tone={!tied && delta > 0 ? 'win' : 'text'} style={styles.cmpVal}>@{me.username} · {r.f(r.me)}</T>
              <T tone="faint">{sign}{r.f(delta).replace('%', '')}{r.f(0).endsWith('%') ? '%' : ''}</T>
              <T tone={!tied && delta < 0 ? 'win' : 'text'} style={[styles.cmpVal, { textAlign: 'right' }]}>{r.f(r.friend)} · @{friend.username}</T>
            </View>
          </View>
        )
      })}
    </Card>
  )
}

function Stat({ label, value, tone }: { label: string; value: number; tone: 'win' | 'loss' | 'muted' }) {
  return (
    <View style={styles.stat}>
      <T tone={tone} style={styles.statValue}>{value}</T>
      <T tone="faint" style={{ fontSize: 11, lineHeight: 14 }}>{label}</T>
    </View>
  )
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.line}>
      <T tone="muted">{label}</T>
      <T tone="strong">{value}</T>
    </View>
  )
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  name: { fontSize: 18, fontWeight: '700', flexShrink: 1 },
  stats: { flexDirection: 'row', gap: 8, marginVertical: 8 },
  stat: { flex: 1, backgroundColor: C.bg, borderRadius: 8, padding: 8, alignItems: 'center' },
  statValue: { fontSize: 20, lineHeight: 26, fontWeight: '700' },
  line: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  cmp: { gap: 2 },
  cmpVal: { flex: 1, fontSize: 14 },
})
