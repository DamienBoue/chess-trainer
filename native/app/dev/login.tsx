// Diagnostic: sign in from a link (chesstrainer://dev/login?u=<pseudo>),
// for devices and simulators without a keyboard at hand.
import { useEffect, useRef, useState } from 'react'
import { Stack, router, useLocalSearchParams } from 'expo-router'
import { Screen, T } from '@/components/ui'
import { useAppData } from '@/lib/appData'

export default function DevLogin() {
  const { u } = useLocalSearchParams<{ u?: string }>()
  const { login } = useAppData()
  const [status, setStatus] = useState(`Connexion de ${u ?? '?'}…`)
  // Once: login() changes identity with the data it loads.
  const started = useRef(false)
  useEffect(() => {
    if (!u || started.current) return
    started.current = true
    login(u).then(() => router.replace('/')).catch(e => setStatus(`Échec : ${e instanceof Error ? e.message : String(e)}`))
  }, [u, login])
  return (
    <Screen>
      <Stack.Screen options={{ title: 'Connexion' }} />
      <T>{status}</T>
    </Screen>
  )
}
