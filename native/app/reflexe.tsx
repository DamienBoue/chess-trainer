// "Réflexe anti-gaffe": spot the threat before the clock runs out.
import { Stack } from 'expo-router'
import { useMemo } from 'react'
import ReflexDrillSession from '@/components/ReflexDrillSession'
import { Loading, Screen } from '@/components/ui'
import { useAnalyses } from '@/lib/appData'

export default function ReflexScreen() {
  const analyses = useAnalyses()
  const list = useMemo(() => Object.values(analyses ?? {}), [analyses])
  if (!analyses) return <Loading />
  return (
    <Screen>
      <Stack.Screen options={{ title: 'Réflexe anti-gaffe' }} />
      <ReflexDrillSession analyses={list} />
    </Screen>
  )
}
