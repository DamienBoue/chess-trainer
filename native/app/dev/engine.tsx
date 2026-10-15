// Diagnostic: does Stockfish answer on this device? (the website has
// /sf-test.html). Open chesstrainer://dev/engine.
import { useEffect, useState } from 'react'
import { Stack } from 'expo-router'
import { Screen, T } from '@/components/ui'
import { useAppData } from '@/lib/appData'

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

export default function EngineDiagnostic() {
  const { engine } = useAppData()
  const [result, setResult] = useState('Stockfish démarre…')
  useEffect(() => {
    const t0 = Date.now()
    engine().evaluate(START, 12, 800)
      .then(r => setResult(`OK en ${Date.now() - t0} ms — profondeur ${r.depth}, meilleur coup ${r.bestMoveUci}, score ${r.scoreCp} cp`))
      .catch(e => setResult(`Échec : ${e instanceof Error ? e.message : String(e)}`))
  }, [engine])
  return (
    <Screen>
      <Stack.Screen options={{ title: 'Diagnostic moteur' }} />
      <T>{result}</T>
    </Screen>
  )
}
