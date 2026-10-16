// Parties: the chess.com games, analysed or not. A tap opens the analysis
// (and runs Stockfish first when the game hasn't been analysed yet). The
// whole history can be downloaded; analyses go by batches of the most
// recent games (Stockfish takes about half a minute per game).
import { useMemo, useState } from 'react'
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { router, type Href } from 'expo-router'
import type { GameRow } from '@shared/analysis/results'
import { gameSlug } from '@shared/nav/gameSlug'
import { Button, Card, Pill, T } from '@/components/ui'
import { useAppData, useGameRows } from '@/lib/appData'
import { C } from '@/constants/theme'

/** Analyses launched at once from the list. */
const BATCH = 20
type Filter = 'all' | 'pending' | 'analysed'
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'Toutes' }, { value: 'pending', label: 'À analyser' }, { value: 'analysed', label: 'Analysées' },
]

const RESULT = { win: { label: 'Victoire', tone: 'win' }, loss: { label: 'Défaite', tone: 'loss' }, draw: { label: 'Nulle', tone: 'muted' } } as const

export default function Games() {
  const { digests, analyzing, analyze, getGame, reloadGames, syncing, lastSync, history, downloadHistory, stopHistory } = useAppData()
  // The games' rows: no PGN is read to list them (storage/games).
  const loaded = useGameRows()
  const games = useMemo(() => loaded ?? [], [loaded])
  const [filter, setFilter] = useState<Filter>('all')
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pending = useMemo(() => games.filter(g => !digests[g.url]), [games, digests])
  const shown = useMemo(
    () => (filter === 'pending' ? pending : filter === 'analysed' ? games.filter(g => digests[g.url]) : games),
    [filter, games, digests, pending],
  )
  const historyComplete = history.total > 0 && history.done >= history.total

  /** The stored game (its PGN), then Stockfish. */
  async function analyzeRow(row: GameRow) {
    const game = await getGame(row.url, row.end / 1000)
    if (!game) throw new Error('Partie introuvable sur cet appareil.')
    return analyze(game)
  }

  async function open(row: GameRow) {
    setError(null)
    try {
      if (!digests[row.url]) await analyzeRow(row)
      router.push(`/partie/${gameSlug(row.url)}` as Href)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  async function analyzeBatch() {
    setError(null)
    // The most recent first (rows are sorted newest first).
    for (const r of pending.slice(0, BATCH)) {
      try { await analyzeRow(r) } catch (e) { setError(e instanceof Error ? e.message : String(e)); break }
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
          <T tone="muted">{loaded ? `${games.length} parties · ${games.length - pending.length} analysée${games.length - pending.length > 1 ? 's' : ''}` : 'Chargement de tes parties…'}</T>
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
        const a = digests[game.url]
        const result = RESULT[game.result]
        const busy = analyzing?.url === game.url
        return (
          <Card onPress={() => open(game)} disabled={!!analyzing && !busy}>
            <View style={styles.row}>
              <T tone={result.tone} style={styles.result}>{result.label}</T>
              <T tone="muted" numberOfLines={1} style={styles.grow}>vs <T tone="strong">{game.opponent}</T> ({game.oppRating})</T>
              {a ? <Pill label="analysée" /> : busy ? <Pill label="…" tone="muted" /> : null}
            </View>
            <T tone="faint" numberOfLines={1} style={styles.small}>
              {a?.opening ? `${a.opening} · ` : ''}{game.timeClass} · {new Date(game.end).toLocaleDateString('fr-FR')}
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
