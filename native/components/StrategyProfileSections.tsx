// "Mon profil stratégique": where the player struggles positionally across all
// analysed games — structures, types of centre, structural concessions, missed plans.
import { useMemo } from 'react'
import { StyleSheet, View } from 'react-native'
import { router, type Href } from 'expo-router'
import { gameSlug } from '@shared/components/route'
import { buildStrategyProfile } from '@shared/strategy/profile'
import type { GameAnalysis } from '@shared/types'
import { Card, SectionLabel, T } from '@/components/ui'
import { Pressable } from 'react-native'
import { strategyReviewOf } from '@/lib/analysis'
import { C, TOUCH } from '@/constants/theme'

function Bar({ ratio, color }: { ratio: number; color: string }) {
  return (
    <View style={styles.track}>
      <View style={{ width: `${Math.max(0, Math.min(1, ratio)) * 100}%`, height: '100%', backgroundColor: color, borderRadius: 3 }} />
    </View>
  )
}

export default function StrategyProfileSections({ analyses }: { analyses: GameAnalysis[] }) {
  const profile = useMemo(() => {
    // A game whose review fails is left out rather than breaking the profile.
    const ok = analyses.filter(a => strategyReviewOf(a))
    return buildStrategyProfile(ok, a => strategyReviewOf(a)!)
  }, [analyses])

  const label = (url: string) => {
    const a = analyses.find(x => x.url === url)
    return a ? `vs ${a.opponent}` : 'partie'
  }
  const maxCp = Math.max(...profile.centers.map(x => x.avgCpLoss), profile.avgCpLoss, 1)

  return (
    <>
      <Card>
        <SectionLabel>À retenir</SectionLabel>
        {profile.headlines.length === 0 ? (
          <T tone="muted" style={styles.small}>
            Pas encore de tendance nette sur {profile.games} partie{profile.games > 1 ? 's' : ''}. Analyse davantage de parties pour faire émerger tes points forts et tes faiblesses stratégiques.
          </T>
        ) : profile.headlines.map((h, i) => (
          <View key={i} style={styles.row}><T tone="accent">▸</T><View style={styles.grow}><T style={styles.small}>{h}</T></View></View>
        ))}
        <T tone="faint" style={styles.small}>
          {profile.games} parties · {profile.moves} coups joués · {Math.round(profile.avgCpLoss)} cp perdus par coup en moyenne.
        </T>
      </Card>

      <Card>
        <SectionLabel>Tes structures</SectionLabel>
        <T tone="faint" style={styles.small}>Les structures de pions qui ont tenu au moins 4 demi-coups, et ce que tu y fais.</T>
        {profile.structures.length === 0 && <T tone="muted" style={styles.small}>Aucune structure type reconnue pour l'instant.</T>}
        {profile.structures.map(s => (
          <View key={`${s.id}:${s.role}`} style={styles.item}>
            <View style={styles.between}>
              <View style={styles.grow}>
                <T tone="strong" style={styles.small}>{s.name}</T>
                <T tone="faint" style={styles.tiny}>{s.roleLabel} · {s.games} partie{s.games > 1 ? 's' : ''}</T>
              </View>
              <T tone="muted" style={styles.small}>{Math.round(s.avgCpLoss)} cp/coup</T>
            </View>
            <View style={styles.row}>
              <View style={styles.grow}><Bar ratio={s.score} color={s.score >= 0.55 ? '#5fa052' : s.score >= 0.45 ? '#e6c34d' : '#d04a4a'} /></View>
              <T tone="muted" style={[styles.tiny, styles.pct]}>{Math.round(s.score * 100)} %</T>
            </View>
          </View>
        ))}
      </Card>

      {profile.centers.length > 0 && (
        <Card>
          <SectionLabel>Selon le type de centre</SectionLabel>
          <T tone="faint" style={styles.small}>Centipions perdus par coup selon la nature du centre au moment où tu joues. Le trait blanc = ta moyenne.</T>
          {profile.centers.map(c => {
            const worse = c.avgCpLoss > profile.avgCpLoss * 1.15
            return (
              <View key={c.type} style={styles.item}>
                <View style={styles.between}>
                  <T style={[styles.small, styles.grow]}>{c.label} <T tone="faint" style={styles.tiny}>· {c.moves} coups</T></T>
                  <T tone={worse ? 'loss' : 'muted'} style={styles.small}>{Math.round(c.avgCpLoss)} cp/coup</T>
                </View>
                <View>
                  <Bar ratio={c.avgCpLoss / maxCp} color={worse ? '#d04a4a' : '#5b88ba'} />
                  <View style={[styles.mark, { left: `${(profile.avgCpLoss / maxCp) * 100}%` }]} />
                </View>
              </View>
            )
          })}
        </Card>
      )}

      <Card>
        <SectionLabel>Concessions structurelles</SectionLabel>
        <T tone="faint" style={styles.small}>Ce que tes coups ont abîmé dans ta structure — comparé à tes adversaires.</T>
        {profile.habits.length === 0 && <T tone="muted" style={styles.small}>Rien à signaler.</T>}
        {profile.habits.map(h => (
          <View key={h.kind} style={[styles.item, styles.between]}>
            <T style={[styles.small, styles.grow]}>{h.label}</T>
            <T tone={h.count > h.oppCount ? 'loss' : 'muted'} style={styles.small}>
              {h.count} <T tone="faint" style={styles.tiny}>dont {h.costly} coûteux · adv. {h.oppCount}</T>
            </T>
          </View>
        ))}
      </Card>

      <Card>
        <SectionLabel>Plans manqués</SectionLabel>
        <T tone="faint" style={styles.small}>Positions où le moteur lançait un plan reconnaissable et où ton coup a coûté ≥ 60 cp.</T>
        {profile.missed.length === 0 && <T tone="muted" style={styles.small}>Aucun plan manqué détecté.</T>}
        {profile.missed.map(m => (
          <View key={m.kind} style={styles.item}>
            <View style={styles.between}>
              <T style={[styles.small, styles.grow]}>{m.label}</T>
              <T tone="muted" style={styles.small}>{m.count}× · {m.totalCp} cp</T>
            </View>
            <View style={styles.links}>
              {m.examples.map((ex, i) => (
                <Pressable
                  key={i}
                  // The analysis opens at the start: the screen has no ply parameter yet.
                  onPress={() => router.push(`/partie/${gameSlug(ex.url)}` as Href)}
                  accessibilityRole="link"
                  accessibilityLabel={ex.title}
                  style={({ pressed }) => [styles.link, pressed && { opacity: 0.7 }]}
                >
                  <T tone="muted" style={styles.tiny}>{label(ex.url)} · coup {Math.ceil((ex.ply + 1) / 2)}</T>
                </Pressable>
              ))}
            </View>
          </View>
        ))}
      </Card>
    </>
  )
}

const styles = StyleSheet.create({
  small: { fontSize: 13, lineHeight: 18 },
  tiny: { fontSize: 11, lineHeight: 15 },
  grow: { flex: 1 },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  between: { flexDirection: 'row', gap: 8, alignItems: 'baseline', justifyContent: 'space-between' },
  item: { gap: 4, paddingTop: 8, borderTopWidth: 1, borderTopColor: C.border, marginTop: 4 },
  track: { height: 6, borderRadius: 3, backgroundColor: C.panel2, overflow: 'hidden' },
  pct: { width: 40, textAlign: 'right' },
  mark: { position: 'absolute', top: -2, width: 1, height: 10, backgroundColor: 'rgba(255,255,255,0.6)' },
  links: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  link: { minHeight: TOUCH, justifyContent: 'center', paddingHorizontal: 10, borderRadius: 8, backgroundColor: C.panel2 },
})
