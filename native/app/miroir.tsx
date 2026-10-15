// "Ouvertures en miroir": replay your openings with the other colour.
import { Stack } from 'expo-router'
import { useMemo } from 'react'
import MirrorDrillSession from '@/components/MirrorDrillSession'
import { H1, Screen, T } from '@/components/ui'
import { useAppData } from '@/lib/appData'

export default function MirrorScreen() {
  const { analyses } = useAppData()
  const list = useMemo(() => Object.values(analyses), [analyses])
  return (
    <Screen>
      <Stack.Screen options={{ title: 'Ouvertures en miroir' }} />
      <H1>Ouvertures en miroir</H1>
      <T tone="muted">Rejoue tes ouvertures côté opposé pour mieux comprendre les structures sous-jacentes.</T>
      <MirrorDrillSession analyses={list} />
    </Screen>
  )
}
