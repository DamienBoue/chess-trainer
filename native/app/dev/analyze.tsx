// Diagnostic: analyse the most recent game end to end, then open it
// (chesstrainer://dev/analyze) — chess.com, Stockfish, storage, analysis.
import { useEffect, useRef, useState } from 'react'
import { Stack, router, type Href } from 'expo-router'
import { gameSlug } from '@shared/nav/gameSlug'
import { Screen, T } from '@/components/ui'
import { useAppData } from '@/lib/appData'

export default function DevAnalyze() {
  const { games, hydrated, analyze, analyzing } = useAppData()
  const [error, setError] = useState<string | null>(null)
  const started = useRef(false)
  useEffect(() => {
    if (!hydrated || started.current || games.length === 0) return
    started.current = true
    const t0 = Date.now()
    analyze(games[0])
      .then(a => router.replace(`/partie/${gameSlug(a.url)}?ms=${Date.now() - t0}` as Href))
      .catch(e => setError(e instanceof Error ? e.message : String(e)))
  }, [hydrated, games, analyze])
  return (
    <Screen>
      <Stack.Screen options={{ title: 'Analyse de test' }} />
      <T>{error ? `Échec : ${error}` : games.length === 0 ? 'Aucune partie (connecte-toi d\'abord).' : `Analyse… ${analyzing ? `${analyzing.done}/${analyzing.total} coups` : ''}`}</T>
    </Screen>
  )
}
