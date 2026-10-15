import { useState } from 'react'
import { Stack } from 'expo-router'
import { getEngineDepth, setEngineDepth } from '@shared/storage/settings'
import { Button, Card, Screen, SectionLabel, T } from '@/components/ui'
import NumberStepperRow from '@/components/NumberStepperRow'
import OptionChipsRow from '@/components/OptionChipsRow'
import { useAppData } from '@/lib/appData'

const DEPTHS = [{ value: 10, label: 'Rapide' }, { value: 14, label: 'Recommandé' }, { value: 18, label: 'Profond' }]

export default function PreferencesScreen() {
  const { username, logout } = useAppData()
  const [depth, setDepth] = useState(getEngineDepth())
  // Two taps: Alert has no multi-button on the web build.
  const [confirmLogout, setConfirmLogout] = useState(false)

  function changeDepth(n: number) {
    setDepth(n)
    // The value is stored first; the website's 'settings-changed' window
    // event may not exist on a phone and nothing here listens to it.
    try { setEngineDepth(n) } catch { /* the write already happened */ }
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Préférences' }} />
      <T tone="muted">Réglages stockés sur le téléphone. Aucun envoi serveur.</T>

      <Card style={{ gap: 12 }}>
        <SectionLabel>Moteur Stockfish</SectionLabel>
        <T>Profondeur d'analyse (~{depth <= 12 ? '30-60 s' : depth <= 18 ? '1-3 min' : '3 min et plus'} par partie, plus long sur téléphone).</T>
        <NumberStepperRow value={depth} min={8} max={22} onChange={changeDepth} unit="plies" />
        <OptionChipsRow options={DEPTHS} value={DEPTHS.some(d => d.value === depth) ? depth : -1} onChange={changeDepth} />
        <T tone="faint">S'applique à la prochaine analyse de partie.</T>
      </Card>

      <Card style={{ gap: 12 }}>
        <SectionLabel>Compte chess.com</SectionLabel>
        <T>Connecté en tant que <T tone="strong">@{username}</T>.</T>
        <Button label={confirmLogout ? 'Confirmer : se déconnecter' : 'Changer de compte'} kind="secondary" onPress={confirmLogout ? logout : () => setConfirmLogout(true)} />
      </Card>
    </Screen>
  )
}
