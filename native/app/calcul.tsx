// "Calcul de séquence": type the forced line without touching the board.
import { Stack } from 'expo-router'
import { useMemo } from 'react'
import { KeyboardAvoidingView, Platform } from 'react-native'
import CalcSequenceSession from '@/components/CalcSequenceSession'
import { Loading, Screen } from '@/components/ui'
import { useAnalyses } from '@/lib/appData'

export default function CalcScreen() {
  const analyses = useAnalyses()
  const list = useMemo(() => Object.values(analyses ?? {}), [analyses])
  // The answer box sits mid-page: lift the page when the keyboard opens.
  if (!analyses) return <Loading />
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen>
        <Stack.Screen options={{ title: 'Calcul de séquence' }} />
        <CalcSequenceSession analyses={list} />
      </Screen>
    </KeyboardAvoidingView>
  )
}
