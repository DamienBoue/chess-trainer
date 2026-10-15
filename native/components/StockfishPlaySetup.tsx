// Setup of a game against the engine: colour and strength.
import { View } from 'react-native'
import { Button, Card, SectionLabel, T } from '@/components/ui'
import OptionChipsRow from '@/components/OptionChipsRow'
import NumberStepperRow from '@/components/NumberStepperRow'

export type PlayColor = 'white' | 'black'
// UCI_Elo accepts 1320..3190 on Stockfish 17; the website caps the slider at 2850.
export const ELO_MIN = 1320
export const ELO_MAX = 2850

const PRESETS = [
  { value: 1320, label: 'Débutant' },
  { value: 1600, label: 'Intermédiaire' },
  { value: 1900, label: 'Club' },
  { value: 2400, label: 'Maître' },
  { value: 2850, label: 'Max' },
]

export default function StockfishPlaySetup({ elo, color, onElo, onColor, onStart }: {
  elo: number
  color: PlayColor
  onElo: (v: number) => void
  onColor: (c: PlayColor) => void
  onStart: () => void
}) {
  return (
    <>
      <T tone="muted">Stockfish 17 lite, dont on règle la force. Les coups se jouent d'un toucher : la pièce, puis sa case d'arrivée.</T>
      <Card style={{ gap: 12 }}>
        <SectionLabel>Force estimée</SectionLabel>
        <NumberStepperRow value={elo} min={ELO_MIN} max={ELO_MAX} step={50} onChange={onElo} unit="Elo" />
        <OptionChipsRow options={PRESETS} value={PRESETS.some(p => p.value === elo) ? elo : -1} onChange={onElo} />
        <View />
        <SectionLabel>Tu joues</SectionLabel>
        <OptionChipsRow
          options={[{ value: 'white' as PlayColor, label: '⚪ Blancs' }, { value: 'black' as PlayColor, label: '⚫ Noirs' }]}
          value={color}
          onChange={onColor}
        />
      </Card>
      <Button label="Lancer la partie" onPress={onStart} />
    </>
  )
}
