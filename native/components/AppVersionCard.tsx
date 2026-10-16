// Phones: which version of the app runs, and a way to fetch the latest one
// now. The app also checks at each launch (expo-updates) and switches to a
// new version at the next one; the website is always the latest.
import { useState } from 'react'
import { Platform } from 'react-native'
import * as Updates from 'expo-updates'
import { Button, Card, SectionLabel, T } from '@/components/ui'

type Check = 'idle' | 'checking' | 'latest' | 'error'

export default function AppVersionCard() {
  const [check, setCheck] = useState<Check>('idle')
  if (Platform.OS === 'web') return null

  const when = Updates.createdAt
    ? Updates.createdAt.toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : null

  async function update() {
    setCheck('checking')
    try {
      const found = await Updates.checkForUpdateAsync()
      if (!found.isAvailable) { setCheck('latest'); return }
      await Updates.fetchUpdateAsync()
      await Updates.reloadAsync()
    } catch {
      setCheck('error')
    }
  }

  return (
    <Card style={{ gap: 12 }}>
      <SectionLabel>Version de l'appli</SectionLabel>
      <T tone="muted">
        {Updates.runtimeVersion ?? '—'}
        {Updates.isEmbeddedLaunch ? ' · version installée avec l\'appli' : when ? ` · mise à jour du ${when}` : ''}
      </T>
      <T tone="faint">Les nouveautés arrivent seules : l'appli les télécharge à l'ouverture et les applique au lancement suivant.</T>
      {Updates.isEnabled && (
        <Button label="Rechercher une mise à jour" kind="secondary" busy={check === 'checking'} onPress={() => { void update() }} />
      )}
      {check === 'latest' && <T tone="win">✓ Tu as la dernière version.</T>}
      {check === 'error' && <T tone="danger">Pas de réseau ou serveur indisponible, réessaie plus tard.</T>}
    </Card>
  )
}
