// Profile of one imported player, or the head-to-head of two: which openings
// to play (or to expect) given each one's weak spots.
import { useMemo } from 'react'
import { Text, View } from 'react-native'
import type { PlayerProfile } from '@shared/players/storage'
import { scoutingProfile, type OpeningStat, type ScoutingProfile } from '@shared/analysis/scouting'
import { compareProfiles, type OpeningOpportunity } from '@shared/analysis/playerCompare'
import { scoutOverall, ScoutOpeningRows } from '@/components/ScoutProfileSections'
import { Card, SectionLabel, T } from '@/components/ui'
import { C } from '@/constants/theme'

const topOpenings = (list: OpeningStat[], n: number) => [...list].sort((a, b) => b.played - a.played).slice(0, n)

function ScoutSummary({ name, p }: { name: string; p: ScoutingProfile }) {
  return (
    <Card style={{ gap: 6 }}>
      <T tone="strong" style={{ fontWeight: '700', fontSize: 16 }}>{name}</T>
      <T tone="muted">{p.games} parties · score global {(scoutOverall(p) * 100).toFixed(0)}%</T>
      <T tone="muted">Blancs : {(p.whiteSide.winRate * 100).toFixed(0)}% · Noirs : {(p.blackSide.winRate * 100).toFixed(0)}%</T>
      <SectionLabel>Top ouvertures avec Blancs</SectionLabel>
      <ScoutOpeningRows openings={topOpenings(p.whiteSide.openings, 4)} />
      <SectionLabel>Top ouvertures avec Noirs</SectionLabel>
      <ScoutOpeningRows openings={topOpenings(p.blackSide.openings, 4)} />
    </Card>
  )
}

export function PlayerSingleProfile({ profile }: { profile: PlayerProfile }) {
  const sp = useMemo(() => scoutingProfile(profile.name, profile.games), [profile])
  return (
    <View style={{ gap: 8 }}>
      <ScoutSummary name={profile.name} p={sp} />
      <T tone="faint">Coche un deuxième profil pour activer la comparaison.</T>
    </View>
  )
}

function OpportunityCard({ title, subtitle, opps, as }: { title: string; subtitle: string; opps: OpeningOpportunity[]; as: 'white' | 'black' }) {
  return (
    <Card style={{ gap: 6 }}>
      <T tone="strong" style={{ fontWeight: '700' }}>{title}</T>
      <T tone="faint">{subtitle}</T>
      {opps.length === 0 ? <T tone="muted">Pas d'opportunité claire avec les données actuelles.</T> : opps.map((o, i) => {
        const stat = as === 'white' ? o.asBlack : o.asWhite
        return (
          <View key={i} style={{ flexDirection: 'row', gap: 8, alignItems: 'baseline' }}>
            <Text style={{ color: C.faint, width: 18, textAlign: 'right' }}>{i + 1}.</Text>
            <Text style={{ color: C.text, flex: 1, fontSize: 14 }} numberOfLines={2}>{o.opening}</Text>
            <Text style={{ color: C.loss, fontSize: 13 }}>{stat ? (stat.winRate * 100).toFixed(0) : '?'}%</Text>
            <Text style={{ color: C.faint, fontSize: 11 }}>/{stat?.played ?? 0}</Text>
          </View>
        )
      })}
    </Card>
  )
}

export function PlayerHeadToHead({ a, b }: { a: PlayerProfile; b: PlayerProfile }) {
  const spA = useMemo(() => scoutingProfile(a.name, a.games), [a])
  const spB = useMemo(() => scoutingProfile(b.name, b.games), [b])
  const cmp = useMemo(() => compareProfiles(spA, spB), [spA, spB])
  return (
    <View style={{ gap: 10 }}>
      <T tone="strong" style={{ fontWeight: '700', fontSize: 18 }}>{a.name} vs {b.name}</T>
      <ScoutSummary name={a.name} p={spA} />
      <ScoutSummary name={b.name} p={spB} />
      <OpportunityCard title={`Si ${a.name} joue Blancs, jouer…`} subtitle={`Ouvertures où ${b.name} est faible en Noirs`} opps={cmp.meVsOpp.asWhite} as="white" />
      <OpportunityCard title={`Si ${a.name} joue Noirs, exploiter…`} subtitle={`Ouvertures où ${b.name} est faible en Blancs`} opps={cmp.meVsOpp.asBlack} as="black" />
      <OpportunityCard title={`Si ${b.name} joue Blancs, jouer…`} subtitle={`Ouvertures où ${a.name} est faible en Noirs`} opps={cmp.oppVsMe.asWhite} as="white" />
      <OpportunityCard title={`Si ${b.name} joue Noirs, exploiter…`} subtitle={`Ouvertures où ${a.name} est faible en Blancs`} opps={cmp.oppVsMe.asBlack} as="black" />
      {cmp.notes.length > 0 ? (
        <Card style={{ borderColor: 'rgba(194,120,50,0.5)' }}>
          {cmp.notes.map((n, i) => <T key={i} style={{ color: '#fdba74', fontSize: 13 }}>• {n}</T>)}
        </Card>
      ) : null}
    </View>
  )
}
