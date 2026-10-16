// Aujourd'hui: what to do now — the last game to review, the exercises due
// and the day's plan, as on the website's home.
import { useMemo } from 'react'
import { StyleSheet, View } from 'react-native'
import { router, type Href } from 'expo-router'
import { buildPlan, totalMinutes } from '@shared/analysis/plan'
import { DAILY_EXERCISES } from '@shared/analysis/dailyQueue'
import { aggregate } from '@shared/analysis/aggregate'
import { loadRepertoireProgress } from '@shared/storage/persist'
import { loadDaily, todayString } from '@shared/storage/daily'
import { bracketForElo, effectiveElo, loadEloPreference } from '@shared/skill/elo'
import { gameSlug } from '@shared/nav/gameSlug'
import { Button, Card, H1, Pill, Screen, SectionLabel, T } from '@/components/ui'
import { useAppData } from '@/lib/appData'
import { hrefFor } from '@/lib/routes'

const RESULT_FR = { win: 'Victoire', loss: 'Défaite', draw: 'Nulle' } as const

export default function Today() {
  const { username, analyses, progress, logout, daily } = useAppData()
  const list = useMemo(() => Object.values(analyses), [analyses])
  const last = useMemo(() => [...list].sort((a, b) => b.endTime - a.endTime)[0], [list])
  const elo = effectiveElo(loadEloPreference(), list)
  const bracket = bracketForElo(elo)
  const stats = useMemo(() => aggregate(list), [list])
  const plan = useMemo(() => {
    const puzzle = loadDaily()
    const dailyDone = puzzle?.date === todayString() && !!puzzle.solved
    return buildPlan(list, progress, loadRepertoireProgress(), {
      dailyDone, bracket, exercisesToday: { remaining: daily.remaining.length, total: daily.total },
    })
  }, [list, progress, bracket, daily])

  if (list.length === 0) {
    return (
      <Screen>
        <H1>Bonjour @{username}</H1>
        <Card>
          <T tone="strong" style={styles.bold}>Démarrer en 3 étapes</T>
          <T tone="muted">1. Va dans Parties : tes dernières parties chess.com sont chargées.</T>
          <T tone="muted">2. Analyse-les : Stockfish tourne sur ton téléphone.</T>
          <T tone="muted">3. Reviens ici : ton plan et tes exercices sont prêts.</T>
        </Card>
        <Button label="Voir mes parties" onPress={() => router.push('/parties')} />
        <Button label="Changer de compte" kind="ghost" onPress={logout} />
      </Screen>
    )
  }

  const userErrors = last
    ? last.moves.filter(m => (m.ply % 2 === 1) === (last.userColor === 'white') && (m.classification === 'blunder' || m.classification === 'mistake')).length
    : 0

  return (
    <Screen>
      <View style={styles.greeting}>
        <H1>Bonjour @{username}</H1>
        <Pill label={`${bracket.label}${elo != null ? ` ${elo}` : ''}`} tone="muted" />
      </View>
      <T tone="muted">{list.length} parties analysées · précision moyenne {stats.avgCpLossUser.toFixed(0)} cp/coup</T>

      {last && (
        <Card onPress={() => router.push((userErrors > 0 ? `/partie/revue/${gameSlug(last.url)}` : `/partie/${gameSlug(last.url)}`) as Href)}>
          <SectionLabel>Dernière partie</SectionLabel>
          <T>vs <T tone="strong">{last.opponent}</T> · {RESULT_FR[last.result]}</T>
          <T tone="muted">{userErrors === 0 ? 'Aucune erreur grave' : `${userErrors} erreur${userErrors > 1 ? 's' : ''} ou gaffe${userErrors > 1 ? 's' : ''}`}</T>
          <T tone="accent">{userErrors > 0 ? 'Revoir mes erreurs →' : 'Revoir →'}</T>
        </Card>
      )}
      <Card onPress={() => { const h = hrefFor({ view: 'exercises' }); if (h) router.push(h) }} highlight={daily.remaining.length > 0}>
        <SectionLabel>Exercices du jour</SectionLabel>
        {daily.total === 0
          ? <T>Rien à revoir : analyse tes dernières parties pour en créer.</T>
          : daily.remaining.length > 0
            ? <T><T tone="strong">{daily.remaining.length}</T> à faire · {daily.done}/{daily.total} faits</T>
            : <T tone="win">✓ Séance du jour terminée ({daily.total}/{daily.total})</T>}
        <T tone="faint" style={styles.small}>Tes erreurs récentes et tes révisions, {DAILY_EXERCISES} par jour au plus.</T>
      </Card>

      <SectionLabel>Plan du jour · {plan.length} étapes · ≈ {totalMinutes(plan)} min</SectionLabel>
      {plan.map(item => {
        const href = hrefFor({ view: item.target === 'strategy' ? 'strategy' : item.target, strategyTab: item.target === 'strategy' ? 'trainer' : undefined })
        return (
          <Card key={item.id} onPress={href ? () => router.push(href) : undefined}>
            <T tone="strong" style={styles.bold}>{item.title}</T>
            <T tone="muted" style={styles.small}>{item.subtitle}</T>
            <T tone="faint" style={styles.small}>≈ {item.estMinutes} min{href ? '' : ' · bientôt sur mobile'}</T>
          </Card>
        )
      })}
      <Button label="Changer de compte" kind="ghost" onPress={logout} />
    </Screen>
  )
}

const styles = StyleSheet.create({
  greeting: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  bold: { fontWeight: '600' },
  small: { fontSize: 13, lineHeight: 18 },
})
