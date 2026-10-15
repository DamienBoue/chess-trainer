// One concept's sheet.
import { Stack, useLocalSearchParams } from 'expo-router'
import { findConcept } from '@shared/concepts/lookup'
import ConceptBody from '@/components/ConceptBody'
import { H1, Screen, T } from '@/components/ui'

export default function ConceptScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const concept = id ? findConcept(id) : undefined
  if (!concept) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Concept' }} />
        <T tone="muted">Ce concept n'existe pas.</T>
      </Screen>
    )
  }
  return (
    <Screen>
      <Stack.Screen options={{ title: concept.title }} />
      <H1>{concept.title}</H1>
      <ConceptBody concept={concept} />
    </Screen>
  )
}
