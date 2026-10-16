import { useState } from 'react'
import { Stack } from 'expo-router'
import { getEngineDepth, setEngineDepth } from '@shared/storage/settings'
import { Button, Card, Screen, SectionLabel, T } from '@/components/ui'
import NumberStepperRow from '@/components/NumberStepperRow'
import OptionChipsRow from '@/components/OptionChipsRow'
import { useAppData } from '@/lib/appData'
import { backgroundSyncSupported, disableBackgroundSync, enableBackgroundSync, isBackgroundSyncEnabled } from '@/lib/backgroundSync'
import { cloudEnabled, signInWithGoogle, signOut } from '@/lib/cloud'

const DEPTHS = [{ value: 10, label: 'Rapide' }, { value: 14, label: 'Recommandé' }, { value: 18, label: 'Profond' }]

export default function PreferencesScreen() {
  const { username, logout, cloud, syncCloud } = useAppData()
  const [signingIn, setSigningIn] = useState(false)
  const [signInError, setSignInError] = useState<string | null>(null)

  async function google() {
    setSigningIn(true)
    setSignInError(null)
    try { await signInWithGoogle() } catch (e) { setSignInError(e instanceof Error ? e.message : String(e)) } finally { setSigningIn(false) }
  }
  const [depth, setDepth] = useState(getEngineDepth())
  // Two taps: Alert has no multi-button on the web build.
  const [confirmLogout, setConfirmLogout] = useState(false)
  const [notify, setNotify] = useState(isBackgroundSyncEnabled)
  const [notifyError, setNotifyError] = useState<string | null>(null)

  async function toggleNotify() {
    setNotifyError(null)
    if (notify) {
      await disableBackgroundSync()
      setNotify(false)
    } else if (await enableBackgroundSync()) {
      setNotify(true)
    } else {
      setNotifyError('Notifications refusées : autorise-les dans les réglages du téléphone.')
    }
  }

  function changeDepth(n: number) {
    setDepth(n)
    // The value is stored first; the website's 'settings-changed' window
    // event may not exist on a phone and nothing here listens to it.
    try { setEngineDepth(n) } catch { /* the write already happened */ }
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Préférences' }} />
      <T tone="muted">{cloud.user ? 'Tes données sont partagées entre tes appareils via ton compte.' : 'Tes données restent sur cet appareil, sauf si tu te connectes pour les partager.'}</T>

      {cloudEnabled && (
        <Card style={{ gap: 12 }}>
          <SectionLabel>Synchronisation (téléphone ↔ PC)</SectionLabel>
          {cloud.user ? (
            <>
              <T>Connecté avec <T tone="strong">{cloud.user.email}</T>.</T>
              <T tone="muted">Analyses, progression des exercices et du répertoire, séance du jour et niveau sont partagés : retrouve-les sur ton téléphone comme sur ton PC.</T>
              <T tone="faint">{cloud.syncing ? 'Synchronisation…' : cloud.syncedAt ? `Synchronisé à ${new Date(cloud.syncedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : 'Pas encore synchronisé'}</T>
              {cloud.error && <T tone="danger">Erreur : {cloud.error}</T>}
              <Button label="Synchroniser maintenant" kind="secondary" busy={cloud.syncing} onPress={() => { void syncCloud() }} />
              <Button label="Se déconnecter" kind="ghost" onPress={() => { void signOut() }} />
            </>
          ) : (
            <>
              <T>Connecte-toi avec Google pour retrouver tes analyses et ta progression sur tous tes appareils.</T>
              <Button label="Se connecter avec Google" onPress={google} busy={signingIn} />
              {signInError && <T tone="danger">{signInError}</T>}
            </>
          )}
        </Card>
      )}

      <Card style={{ gap: 12 }}>
        <SectionLabel>Moteur Stockfish</SectionLabel>
        <T>Profondeur d'analyse (~{depth <= 12 ? '30-60 s' : depth <= 18 ? '1-3 min' : '3 min et plus'} par partie, plus long sur téléphone).</T>
        <NumberStepperRow value={depth} min={8} max={22} onChange={changeDepth} unit="plies" />
        <OptionChipsRow options={DEPTHS} value={DEPTHS.some(d => d.value === depth) ? depth : -1} onChange={changeDepth} />
        <T tone="faint">S'applique à la prochaine analyse de partie.</T>
      </Card>

      <Card style={{ gap: 12 }}>
        <SectionLabel>Nouvelles parties</SectionLabel>
        <T>Tes parties chess.com sont récupérées à chaque ouverture de l'appli, puis analysées automatiquement.</T>
        {backgroundSyncSupported ? (
          <>
            <T tone="muted">En arrière-plan, l'appli peut aussi vérifier régulièrement et te prévenir d'une nouvelle partie (le téléphone choisit le moment : au mieux toutes les heures, souvent la nuit).</T>
            <Button label={notify ? '🔔 Notifications activées — désactiver' : 'Me prévenir de mes nouvelles parties'} kind={notify ? 'secondary' : 'primary'} onPress={toggleNotify} />
            {notifyError && <T tone="danger">{notifyError}</T>}
          </>
        ) : (
          <T tone="faint">Les notifications en arrière-plan demandent l'appli sur téléphone : la version web vérifie à l'ouverture et quand tu reviens sur l'onglet.</T>
        )}
      </Card>

      <Card style={{ gap: 12 }}>
        <SectionLabel>Compte chess.com</SectionLabel>
        <T>Connecté en tant que <T tone="strong">@{username}</T>.</T>
        <Button label={confirmLogout ? 'Confirmer : se déconnecter' : 'Changer de compte'} kind="secondary" onPress={confirmLogout ? logout : () => setConfirmLogout(true)} />
      </Card>
    </Screen>
  )
}
