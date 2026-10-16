// "Préparer un adversaire": an opponent's recent public chess.com games turned
// into a profile (openings, form, strengths and weaknesses) plus their
// Lichess opening tree.
import { Stack } from 'expo-router'
import { useState } from 'react'
import { StyleSheet, TextInput, View } from 'react-native'
import type { ChessComGame } from '@shared/types'
import { getRecentGames } from '@shared/api/chesscom'
import { scoutingProfile, type ScoutingProfile } from '@shared/analysis/scouting'
import NumberStepperRow from '@/components/NumberStepperRow'
import ScoutExplorerPanel from '@/components/ScoutExplorerPanel'
import ScoutProfileSections from '@/components/ScoutProfileSections'
import { Button, Card, H1, Screen, SectionLabel, T } from '@/components/ui'
import { C, TOUCH } from '@/constants/theme'

export default function PreparerScreen() {
  const [name, setName] = useState('')
  const [count, setCount] = useState(50)
  const [games, setGames] = useState<ChessComGame[] | null>(null)
  const [profile, setProfile] = useState<ScoutingProfile | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    const trimmed = name.trim()
    if (!trimmed) return
    setLoading(true); setError(null); setProfile(null); setGames(null)
    try {
      const fetched = await getRecentGames(trimmed, count)
      if (fetched.length === 0) { setError('Aucune partie publique trouvée pour ce pseudo.'); return }
      setGames(fetched)
      setProfile(scoutingProfile(trimmed, fetched))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur réseau')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Préparer un adversaire' }} />
      <H1>Préparer un adversaire</H1>
      <T tone="muted">
        Saisis un pseudo chess.com pour récupérer ses parties récentes (publiques) et obtenir un profil d'ouvertures, répartition de cadence, forme récente, points forts et points faibles.
      </T>

      <Card style={{ gap: 10 }}>
        <SectionLabel>Pseudo chess.com</SectionLabel>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="ex: hikaru"
          placeholderTextColor={C.faint}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          onSubmitEditing={() => void submit()}
          style={styles.input}
        />
        <SectionLabel>Nombre de parties</SectionLabel>
        <NumberStepperRow value={count} min={10} max={200} step={10} onChange={setCount} />
        <Button label="Préparer" onPress={() => void submit()} busy={loading} disabled={!name.trim()} />
      </Card>

      {error ? <View style={styles.error}><T tone="loss">{error}</T></View> : null}

      {profile && games ? (
        <>
          <ScoutProfileSections profile={profile} games={games} />
          <T tone="faint">
            Astuce préparation : prépare une réponse contre ses ouvertures principales, et anticipe qu'il évitera celles où il a un mauvais score. Ses ouvertures faibles sont des angles d'attaque pour toi.
          </T>
          <ScoutExplorerPanel username={profile.username} />
        </>
      ) : null}
    </Screen>
  )
}

const styles = StyleSheet.create({
  input: { minHeight: TOUCH, backgroundColor: C.bg, borderColor: C.border, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, color: C.strong, fontSize: 16 },
  error: { backgroundColor: 'rgba(248,113,113,0.12)', borderRadius: 8, padding: 10 },
})
