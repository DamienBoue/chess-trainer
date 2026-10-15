// "Réflexe anti-gaffe": spot the threat before the clock runs out.
import { Stack } from 'expo-router'
import { useMemo } from 'react'
import ReflexDrillSession from '@/components/ReflexDrillSession'
import { Screen } from '@/components/ui'
import { useAppData } from '@/lib/appData'

export default function ReflexScreen() {
  const { analyses } = useAppData()
  const list = useMemo(() => Object.values(analyses), [analyses])
  return (
    <Screen>
      <Stack.Screen options={{ title: 'Réflexe anti-gaffe' }} />
      <ReflexDrillSession analyses={list} />
    </Screen>
  )
}
