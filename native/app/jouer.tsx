import { useState } from 'react'
import { Stack } from 'expo-router'
import { Screen } from '@/components/ui'
import StockfishPlaySetup, { type PlayColor } from '@/components/StockfishPlaySetup'
import StockfishPlaySession from '@/components/StockfishPlaySession'

export default function JouerScreen() {
  const [playing, setPlaying] = useState(false)
  const [elo, setElo] = useState(1400)
  const [color, setColor] = useState<PlayColor>('white')
  return (
    <Screen>
      <Stack.Screen options={{ title: 'Jouer contre Stockfish' }} />
      {playing
        ? <StockfishPlaySession elo={elo} color={color} onExit={() => setPlaying(false)} />
        : <StockfishPlaySetup elo={elo} color={color} onElo={setElo} onColor={setColor} onStart={() => setPlaying(true)} />}
    </Screen>
  )
}
