import { useEffect, useMemo, useState } from 'react'
import { StyleSheet, TextInput } from 'react-native'
import { Stack } from 'expo-router'
import type { ChessComGame } from '@shared/types'
import { getRecentGames } from '@shared/api/chesscom'
import { profileFromGames } from '@shared/analysis/profile'
import { Button, Card, Screen, SectionLabel, T } from '@/components/ui'
import OptionChipsRow from '@/components/OptionChipsRow'
import { FriendDirectComparison, FriendProfileCard } from '@/components/FriendProfileCards'
import { useAppData } from '@/lib/appData'
import { C, TOUCH } from '@/constants/theme'

const COUNTS = [20, 30, 50, 100].map(n => ({ value: n, label: String(n) }))

export default function ComparerScreen() {
  const { username, loadAllGames } = useAppData()
  // Your games, read for this screen only.
  const [games, setGames] = useState<ChessComGame[]>([])
  useEffect(() => {
    let cancelled = false
    void loadAllGames().then(g => { if (!cancelled) setGames(g) })
    return () => { cancelled = true }
  }, [loadAllGames])
  const me = useMemo(() => profileFromGames(username, games), [username, games])
  const [name, setName] = useState('')
  const [count, setCount] = useState(30)
  // The profile is tied to the pseudo it was fetched for, not to what is being typed.
  const [loaded, setLoaded] = useState<{ name: string; games: ChessComGame[] } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const friend = useMemo(() => (loaded ? profileFromGames(loaded.name, loaded.games) : null), [loaded])

  async function compare() {
    const pseudo = name.trim()
    if (!pseudo) return
    setLoading(true)
    setError(null)
    try {
      const fg = await getRecentGames(pseudo, count)
      if (fg.length === 0) { setError('Aucune partie publique trouvée pour ce pseudo.'); setLoaded(null) }
      else setLoaded({ name: pseudo, games: fg })
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      setError(/ 404 /.test(msg) ? 'Pseudo introuvable sur chess.com.' : msg || 'Erreur réseau')
      setLoaded(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Comparer avec un ami' }} />
      <T tone="muted">Statistiques tirées des parties publiques chess.com (pas d'analyse Stockfish nécessaire).</T>

      <Card style={{ gap: 10 }}>
        <SectionLabel>Pseudo chess.com de l'ami</SectionLabel>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="ex : hikaru"
          placeholderTextColor={C.faint}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          onSubmitEditing={compare}
          style={styles.input}
        />
        <SectionLabel>Parties à charger</SectionLabel>
        <OptionChipsRow options={COUNTS} value={count} onChange={setCount} />
        <Button label="Comparer" onPress={compare} busy={loading} disabled={!name.trim()} />
      </Card>

      {error && <T tone="danger">{error}</T>}

      <FriendProfileCard profile={me} mine />
      {friend
        ? <FriendProfileCard profile={friend} />
        : <Card><T tone="faint" style={{ textAlign: 'center' }}>Entre un pseudo pour afficher son profil ici.</T></Card>}
      {friend && <FriendDirectComparison me={me} friend={friend} />}
    </Screen>
  )
}

const styles = StyleSheet.create({
  input: { minHeight: TOUCH, borderRadius: 8, borderWidth: 1, borderColor: C.border, backgroundColor: C.bg, color: C.strong, paddingHorizontal: 12, fontSize: 16 },
})
