// "Profil stratégique": the player's positional strengths and weaknesses.
import { Stack } from 'expo-router'
import { useMemo } from 'react'
import StrategyProfileSections from '@/components/StrategyProfileSections'
import { Screen, T } from '@/components/ui'
import { useAppData } from '@/lib/appData'

export default function StrategyProfileScreen() {
  const { analyses } = useAppData()
  const list = useMemo(() => Object.values(analyses), [analyses])
  return (
    <Screen>
      <Stack.Screen options={{ title: 'Profil stratégique' }} />
      {list.length === 0
        ? <T tone="muted">Analyse quelques parties pour voir ton profil stratégique.</T>
        : <StrategyProfileSections analyses={list} />}
    </Screen>
  )
}
