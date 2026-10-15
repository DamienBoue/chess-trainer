import { Link, Stack } from 'expo-router'
import { Screen, T } from '@/components/ui'

export default function NotFound() {
  return (
    <>
      <Stack.Screen options={{ title: 'Introuvable' }} />
      <Screen>
        <T tone="strong">Cet écran n'existe pas.</T>
        <Link href="/"><T tone="accent">Retour à Aujourd'hui</T></Link>
      </Screen>
    </>
  )
}
