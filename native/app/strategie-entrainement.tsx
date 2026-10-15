// "Entraîneur stratégique": drills from the player's own analysed games.
import { Stack } from 'expo-router'
import { useMemo } from 'react'
import StrategyDrillSession from '@/components/StrategyDrillSession'
import { Screen } from '@/components/ui'
import { useAppData } from '@/lib/appData'

export default function StrategyTrainerScreen() {
  const { analyses } = useAppData()
  const list = useMemo(() => Object.values(analyses), [analyses])
  return (
    <Screen>
      <Stack.Screen options={{ title: 'Entraîneur stratégique' }} />
      <StrategyDrillSession analyses={list} />
    </Screen>
  )
}
