// "Puzzle Rush": the player's own exercises against the clock.
import { Stack } from 'expo-router'
import RushRunSession from '@/components/RushRunSession'
import { Card, Screen, T } from '@/components/ui'
import { useAppData } from '@/lib/appData'

export default function RushScreen() {
  const { exercises, recordAttempt } = useAppData()
  return (
    <Screen>
      <Stack.Screen options={{ title: 'Puzzle Rush' }} />
      {exercises.length < 5 ? (
        <Card>
          <T tone="muted">Il faut au moins 5 exercices pour lancer un Puzzle Rush. Analyse plus de parties d'abord.</T>
        </Card>
      ) : (
        <RushRunSession exercises={exercises} onAttempt={recordAttempt} />
      )}
    </Screen>
  )
}
