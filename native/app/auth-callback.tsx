// Google sends the phone back here when the system opens the app on the
// redirect link instead of the sign-in sheet (Android): finish the sign-in.
import { useEffect, useState } from 'react'
import { Stack, router } from 'expo-router'
import * as Linking from 'expo-linking'
import { Screen, T } from '@/components/ui'
import { sessionFromUrl } from '@/lib/cloud'

export default function AuthCallback() {
  const url = Linking.useLinkingURL()
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!url) return
    sessionFromUrl(url).then(() => router.replace('/preferences')).catch(e => setError(e instanceof Error ? e.message : String(e)))
  }, [url])
  return (
    <Screen>
      <Stack.Screen options={{ title: 'Connexion' }} />
      <T>{error ? `Connexion impossible : ${error}` : 'Connexion en cours…'}</T>
    </Screen>
  )
}
