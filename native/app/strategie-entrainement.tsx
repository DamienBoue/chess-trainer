// "Entraîneur stratégique": drills from the player's own analysed games.
import { Stack } from 'expo-router'
import { useMemo } from 'react'
import StrategyDrillSession from '@/components/StrategyDrillSession'
import { Loading, Screen } from '@/components/ui'
import { useAnalyses } from '@/lib/appData'

export default function StrategyTrainerScreen() {
  const analyses = useAnalyses()
  const list = useMemo(() => Object.values(analyses ?? {}), [analyses])
  if (!analyses) return <Loading />
  return (
    <Screen>
      <Stack.Screen options={{ title: 'Entraîneur stratégique' }} />
      <StrategyDrillSession analyses={list} />
    </Screen>
  )
}
