// Diagnostic: analyse the most recent game end to end, then open it
// (chesstrainer://dev/analyze) — chess.com, Stockfish, storage, analysis.
import { useEffect, useRef, useState } from 'react'
import { Stack, router, type Href } from 'expo-router'
import { gameSlug } from '@shared/nav/gameSlug'
import { Screen, T } from '@/components/ui'
import { useAppData, useGameRows } from '@/lib/appData'

export default function DevAnalyze() {
  const { analyze, analyzing, getGame } = useAppData()
  const games = useGameRows() ?? []
  const [error, setError] = useState<string | null>(null)
  const started = useRef(false)
  useEffect(() => {
    if (started.current || games.length === 0) return
    started.current = true
    const t0 = Date.now()
    getGame(games[0].url, games[0].end / 1000)
      .then(g => { if (!g) throw new Error('partie introuvable'); return analyze(g) })
      .then(a => router.replace(`/partie/${gameSlug(a.url)}?ms=${Date.now() - t0}` as Href))
      .catch(e => setError(e instanceof Error ? e.message : String(e)))
  }, [games, analyze, getGame])
  return (
    <Screen>
      <Stack.Screen options={{ title: 'Analyse de test' }} />
      <T>{error ? `Échec : ${error}` : games.length === 0 ? 'Aucune partie (connecte-toi d\'abord).' : `Analyse… ${analyzing ? `${analyzing.done}/${analyzing.total} coups` : ''}`}</T>
    </Screen>
  )
}
