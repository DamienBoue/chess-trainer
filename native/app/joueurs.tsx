// "Joueurs (PGN)": import the games of one or several players (OTB included)
// from a PGN file, list the saved players, show a profile or compare two.
import { Stack } from 'expo-router'
import { useCallback, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { deletePlayer, listPlayers, savePlayer, type PlayerProfile } from '@shared/players/storage'
import { buildPlayerProfiles } from '@shared/players/import'
import { PlayerHeadToHead, PlayerSingleProfile } from '@/components/PlayerComparePanel'
import PlayerImportPreview from '@/components/PlayerImportPreview'
import { Button, Card, H1, Screen, T } from '@/components/ui'
import { C, TOUCH } from '@/constants/theme'
import { pickTextFiles } from '@/lib/pickTextFiles'

export default function JoueursScreen() {
  const [profiles, setProfiles] = useState<PlayerProfile[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState<PlayerProfile[] | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [help, setHelp] = useState(false)

  const refresh = useCallback(() => listPlayers().then(setProfiles), [])
  useFocusEffect(useCallback(() => { void refresh().catch(e => setError(String(e))) }, [refresh]))

  async function importPgn() {
    setBusy(true); setError(null)
    try {
      const files = await pickTextFiles()
      if (!files) return
      // Let the spinner paint: parsing a big TWIC file blocks the JS thread.
      await new Promise(r => setTimeout(r, 30))
      const found = buildPlayerProfiles(files.map(f => f.text).join('\n\n'), 3)
      if (found.length === 0) { setError('Aucun joueur avec ≥3 parties trouvé dans le PGN.'); return }
      setPreview(found)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function saveSelected(ids: Set<string>) {
    if (!preview) return
    setBusy(true)
    try {
      for (const p of preview) {
        if (!ids.has(p.id)) continue
        // Same player again: append the games not yet known.
        const existing = profiles?.find(e => e.id === p.id)
        if (existing) {
          const seen = new Set(existing.games.map(g => g.url))
          await savePlayer({ ...existing, games: [...existing.games, ...p.games.filter(g => !seen.has(g.url))], importedAt: new Date().toISOString() })
        } else {
          await savePlayer(p)
        }
      }
      setPreview(null)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function onDelete(id: string) {
    if (confirmId !== id) { setConfirmId(id); return }
    setConfirmId(null)
    await deletePlayer(id)
    await refresh()
    setSelected(s => s.filter(i => i !== id))
  }

  // Two profiles at most: a third tick drops the oldest.
  const toggle = (id: string) => setSelected(prev => prev.includes(id) ? prev.filter(i => i !== id) : prev.length >= 2 ? [prev[1], id] : [...prev, id])
  const a = profiles?.find(p => p.id === selected[0]) ?? null
  const b = profiles?.find(p => p.id === selected[1]) ?? null

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Joueurs (PGN)' }} />
      <H1>Joueurs (PGN)</H1>
      <T tone="muted">
        Importe les parties d'un ou plusieurs joueurs, y compris des parties OTB (jouées sur un vrai échiquier), via un fichier PGN (TWIC, PGN Mentor, export ChessBase). Coche deux profils pour les comparer.
      </T>
      <Button label="＋ Importer PGN" onPress={() => void importPgn()} busy={busy && !preview} />

      {error ? <View style={styles.error}><T tone="loss">{error}</T></View> : null}

      {preview ? <PlayerImportPreview profiles={preview} busy={busy} onCancel={() => setPreview(null)} onConfirm={ids => void saveSelected(ids)} /> : null}

      {!profiles ? (
        <T tone="muted">Chargement…</T>
      ) : profiles.length === 0 ? (
        <Card>
          <Pressable onPress={() => setHelp(h => !h)} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }}>
            <T tone="muted">{help ? '▾' : '▸'} D'où télécharger des PGN ?</T>
          </Pressable>
          {help ? (
            <T tone="muted">
              • TWIC (theweekinchess.com/twic) : archive hebdo des opens majeurs depuis 1994 (PGN zippé, à dézipper avant).{'\n'}
              • PGN Mentor (pgnmentor.com/files.html) : un fichier par grand joueur.{'\n'}
              • Lichess Broadcasts (lichess.org/broadcast) : bouton « PGN » sur chaque tournoi.
            </T>
          ) : null}
        </Card>
      ) : (
        <Card style={{ padding: 0, gap: 0 }}>
          <T tone="faint" style={{ padding: 12 }}>Coche jusqu'à 2 profils pour la comparaison ({selected.length}/2)</T>
          {profiles.map(p => {
            const on = selected.includes(p.id)
            return (
              <View key={p.id} style={[styles.row, on && { backgroundColor: 'rgba(118,150,86,0.15)' }]}>
                <Pressable onPress={() => toggle(p.id)} accessibilityRole="checkbox" accessibilityState={{ checked: on }} style={styles.pick}>
                  <Text style={styles.box}>{on ? '☑' : '☐'}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name} numberOfLines={1}>{p.name}</Text>
                    <Text style={styles.meta}>{p.games.length} parties · importé {new Date(p.importedAt).toLocaleDateString('fr-FR')}</Text>
                  </View>
                </Pressable>
                <Pressable onPress={() => void onDelete(p.id)} accessibilityRole="button" accessibilityLabel={`Supprimer le profil ${p.name}`} style={styles.del}>
                  <Text style={{ color: confirmId === p.id ? C.danger : C.muted, fontSize: confirmId === p.id ? 12 : 16 }}>{confirmId === p.id ? 'Confirmer' : '✕'}</Text>
                </Pressable>
              </View>
            )
          })}
        </Card>
      )}

      {a && b ? <PlayerHeadToHead a={a} b={b} /> : null}
      {a && !b ? <PlayerSingleProfile profile={a} /> : null}
    </Screen>
  )
}

const styles = StyleSheet.create({
  error: { backgroundColor: 'rgba(248,113,113,0.12)', borderRadius: 8, padding: 10 },
  row: { flexDirection: 'row', alignItems: 'center', borderTopColor: C.border, borderTopWidth: 1 },
  pick: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: TOUCH + 8, paddingLeft: 12 },
  box: { color: C.accentHover, fontSize: 20 },
  name: { color: C.strong, fontSize: 15, fontWeight: '600' },
  meta: { color: C.faint, fontSize: 12 },
  del: { minWidth: 64, minHeight: TOUCH, alignItems: 'center', justifyContent: 'center' },
})
