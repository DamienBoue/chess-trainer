// Parties: the chess.com games, analysed or not. A tap opens the analysis
// (and runs Stockfish first when the game hasn't been analysed yet). The
// whole history can be downloaded; analyses go by batches of the most
// recent games (Stockfish takes about half a minute per game).
import { useMemo, useState } from 'react'
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { router, type Href } from 'expo-router'
import type { ChessComGame } from '@shared/types'
import { getResultForUser, getUserSide } from '@shared/analysis/pgn'
import { gameSlug } from '@shared/nav/gameSlug'
import { Button, Card, Pill, T } from '@/components/ui'
import { useAppData } from '@/lib/appData'
import { C } from '@/constants/theme'

/** Analyses launched at once from the list. */
const BATCH = 20
type Filter = 'all' | 'pending' | 'analysed'
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'Toutes' }, { value: 'pending', label: 'À analyser' }, { value: 'analysed', label: 'Analysées' },
]

const RESULT = { win: { label: 'Victoire', tone: 'win' }, loss: { label: 'Défaite', tone: 'loss' }, draw: { label: 'Nulle', tone: 'muted' } } as const

export default function Games() {
  const { username, games, analyses, analyzing, analyze, reloadGames, syncing, lastSync, history, downloadHistory, stopHistory } = useAppData()
  const [filter, setFilter] = useState<Filter>('all')
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pending = useMemo(() => games.filter(g => !analyses[g.url]), [games, analyses])
  const shown = useMemo(
    () => (filter === 'pending' ? pending : filter === 'analysed' ? games.filter(g => analyses[g.url]) : games),
    [filter, games, analyses, pending],
  )
  const historyComplete = history.total > 0 && history.done >= history.total

  async function open(game: ChessComGame) {
    setError(null)
    try {
      if (!analyses[game.url]) await analyze(game)
      router.push(`/partie/${gameSlug(game.url)}` as Href)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  async function analyzeBatch() {
    setError(null)
    // The most recent first (games are sorted newest first).
    for (const g of pending.slice(0, BATCH)) {
      try { await analyze(g) } catch (e) { setError(e instanceof Error ? e.message : String(e)); break }
    }
  }

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.content}
      data={shown}
      keyExtractor={g => g.url}
      refreshControl={<RefreshControl refreshing={refreshing} tintColor={C.muted} onRefresh={async () => { setRefreshing(true); try { await reloadGames() } finally { setRefreshing(false) } }} />}
      ListHeaderComponent={
        <View style={styles.header}>
          <T tone="muted">{games.length} parties · {games.length - pending.length} analysée{games.length - pending.length > 1 ? 's' : ''}</T>
          <T tone="faint" style={styles.small}>{syncing ? 'Recherche de nouvelles parties…' : lastSync ? `À jour ${sinceLabel(lastSync)} · tire vers le bas pour vérifier` : 'Tire vers le bas pour chercher tes nouvelles parties'}</T>
          {analyzing && <T tone="accent">Analyse en cours… {analyzing.total ? `${analyzing.done}/${analyzing.total} coups` : ''}</T>}
          {error && <T tone="danger">{error}</T>}
          {pending.length > 0 && !analyzing && (
            <Button label={pending.length > BATCH ? `Analyser les ${BATCH} plus récentes` : `Tout analyser (${pending.length})`} onPress={analyzeBatch} />
          )}
          <Card>
            <T tone="strong" style={styles.bold}>Historique complet</T>
            {history.running ? (
              <>
                <T tone="muted">Téléchargement… mois {history.done}/{history.total} · +{history.added} partie{history.added > 1 ? 's' : ''}</T>
                <Button label="Arrêter" kind="secondary" onPress={stopHistory} />
              </>
            ) : historyComplete ? (
              <T tone="muted">✓ Toutes tes parties chess.com sont là ({history.total} mois).</T>
            ) : (
              <>
                <T tone="muted">
                  {history.done > 0 ? `${history.done}/${history.total} mois téléchargés. ` : ''}
                  Toutes tes parties chess.com depuis ton inscription, mois par mois (reprend où il s'est arrêté).
                </T>
                <Button label={history.done > 0 ? 'Continuer le téléchargement' : '📥 Télécharger tout l\'historique'} kind="secondary" onPress={() => { void downloadHistory().catch(e => setError(e instanceof Error ? e.message : String(e))) }} />
              </>
            )}
          </Card>
          <View style={styles.filters}>
            {FILTERS.map(f => (
              <Pressable key={f.value} onPress={() => setFilter(f.value)} style={[styles.chip, filter === f.value && styles.chipOn]} accessibilityRole="button" accessibilityState={{ selected: filter === f.value }}>
                <Text style={[styles.chipText, filter === f.value && styles.chipTextOn]}>
                  {f.label} ({f.value === 'all' ? games.length : f.value === 'pending' ? pending.length : games.length - pending.length})
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      }
      renderItem={({ item: game }) => {
        const a = analyses[game.url]
        const side = getUserSide(game, username)
        const opp = side === 'white' ? game.black : game.white
        const result = RESULT[getResultForUser(game, username)]
        const busy = analyzing?.url === game.url
        return (
          <Card onPress={() => open(game)} disabled={!!analyzing && !busy}>
            <View style={styles.row}>
              <T tone={result.tone} style={styles.result}>{result.label}</T>
              <T tone="muted" numberOfLines={1} style={styles.grow}>vs <T tone="strong">{opp.username}</T> ({opp.rating})</T>
              {a ? <Pill label="analysée" /> : busy ? <Pill label="…" tone="muted" /> : null}
            </View>
            <T tone="faint" numberOfLines={1} style={styles.small}>
              {a?.opening ? `${a.opening} · ` : ''}{game.time_class} · {new Date(game.end_time * 1000).toLocaleDateString('fr-FR')}
            </T>
          </Card>
        )
      }}
      ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
    />
  )
}

/** "il y a 5 min", "à l'instant"… */
function sinceLabel(ms: number): string {
  const min = Math.round((Date.now() - ms) / 60_000)
  if (min < 1) return 'à l\'instant'
  if (min < 60) return `il y a ${min} min`
  const h = Math.round(min / 60)
  return h < 24 ? `il y a ${h} h` : `il y a ${Math.round(h / 24)} j`
}

const styles = StyleSheet.create({
  bold: { fontWeight: '600' },
  filters: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: { minHeight: 36, paddingHorizontal: 12, borderRadius: 18, borderWidth: 1, borderColor: C.border, justifyContent: 'center' },
  chipOn: { backgroundColor: C.accent, borderColor: C.accent },
  chipText: { color: C.muted, fontSize: 13 },
  chipTextOn: { color: C.strong, fontWeight: '600' },
  list: { flex: 1, backgroundColor: C.bg },
  content: { padding: 16, paddingBottom: 32 },
  header: { gap: 10, marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  grow: { flex: 1 },
  result: { fontWeight: '700' },
  small: { fontSize: 13 },
})
