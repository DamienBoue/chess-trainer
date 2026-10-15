// "Critiques" tab of the repertoire: the holes (positions where you never
// settled on one move) and the critiques (habits that bleed cp or results).
// A tap shows the position on a read-only board.
import { useMemo, useState } from 'react'
import { View } from 'react-native'
import { critiqueRepertoire, findRepertoireHoles, type RepertoireRoot } from '@shared/analysis/repertoire'
import type { Color } from '@shared/types'
import Board from '@/components/Board'
import { useOpeningBoardSize } from '@/components/OpeningKit'
import { Card, SectionLabel, T } from '@/components/ui'
import { C } from '@/constants/theme'

// Stored FENs may lack the last fields; chess.js wants a full one.
const fullFen = (fen: string) => (fen.split(' ').length >= 4 ? fen : fen + ' - - 0 1')

function PositionPeek({ fen, color }: { fen: string; color: Color }) {
  const size = useOpeningBoardSize(true)
  return <View style={{ marginTop: 8, alignItems: 'center' }}><Board fen={fullFen(fen)} size={size} orientation={color} /></View>
}

export default function RepertoireCritiquesPanel({ roots }: { roots: RepertoireRoot[] }) {
  const holes = useMemo(() => findRepertoireHoles(roots).slice(0, 5), [roots])
  const critiques = useMemo(() => critiqueRepertoire(roots), [roots])
  const [open, setOpen] = useState<string | null>(null)
  const toggle = (id: string) => setOpen(o => (o === id ? null : id))

  return (
    <View style={{ gap: 10 }}>
      {holes.length > 0 && (
        <>
          <SectionLabel>🕳️ Trous du répertoire</SectionLabel>
          <T tone="muted" style={{ fontSize: 13 }}>Positions où tu n'as pas choisi un coup à mémoriser.</T>
          {holes.map((h, i) => (
            <Card key={`h${i}`} onPress={h.fenBefore ? () => toggle(`h${i}`) : undefined}>
              <T tone="strong" style={{ fontWeight: '600' }}>{h.parent}</T>
              <T tone="faint" style={{ fontSize: 12 }}>
                {h.color === 'white' ? '♔ Blancs' : '♚ Noirs'} · coup {h.ply} · {h.visits} visites · top {(h.topShare * 100).toFixed(0)}%
              </T>
              <T style={{ fontSize: 13 }}>
                {h.choices.map((c, j) => `${c.san} ${(c.share * 100).toFixed(0)}%${j < h.choices.length - 1 ? '  ·  ' : ''}`).join('')}
              </T>
              {(h.avgCpLoss > 30 || h.winRate < 0.4) && (
                <T style={{ fontSize: 12, color: '#fdba74' }}>
                  {h.avgCpLoss > 30 ? `CPL moyen : ${h.avgCpLoss.toFixed(0)}` : ''}
                  {h.avgCpLoss > 30 && h.winRate < 0.4 ? ' · ' : ''}
                  {h.winRate < 0.4 ? `Win rate : ${(h.winRate * 100).toFixed(0)}%` : ''}
                </T>
              )}
              {open === `h${i}` && <PositionPeek fen={h.fenBefore} color={h.color} />}
            </Card>
          ))}
          <T tone="faint" style={{ fontSize: 12 }}>
            Choisis UN coup, travaille-le dans « S'entraîner » et c'est plié. Mieux vaut un coup correct mémorisé qu'un choix aléatoire à chaque partie.
          </T>
        </>
      )}

      <SectionLabel>Critiques {critiques.length > 0 ? `(${critiques.length})` : ''}</SectionLabel>
      {critiques.length === 0 ? (
        <Card><T tone="muted">Aucun mauvais réflexe détecté pour l'instant. Continue à analyser des parties pour que des habitudes se dessinent.</T></Card>
      ) : (
        <>
          <T tone="muted" style={{ fontSize: 13 }}>
            Des coups que tu joues souvent mais qui méritent d'être étudiés : soit Stockfish n'est pas d'accord (perte cp moyenne élevée), soit ton score y est mauvais.
          </T>
          {critiques.slice(0, 12).map((c, i) => {
            const tag = c.reason === 'high-cploss' ? 'Imprécis' : c.reason === 'low-winrate' ? 'Mauvais score' : 'Imprécis + mauvais score'
            return (
              <Card key={`c${i}`} onPress={c.fenBefore ? () => toggle(`c${i}`) : undefined}>
                <T tone="strong" style={{ fontWeight: '600' }}>{c.parent} · {c.color === 'white' ? 'Blancs' : 'Noirs'}</T>
                <T tone="faint" style={{ fontSize: 12 }}>après {c.oppPrev === '<start>' ? 'le début' : c.oppPrev} · coup {c.ply}</T>
                <T style={{ fontSize: 12, color: c.reason === 'low-winrate' ? C.loss : '#fdba74', fontWeight: '600' }}>{tag}</T>
                <T>
                  Tu joues d'habitude <T tone="strong" style={{ fontWeight: '700' }}>{c.san}</T> ({c.count}×) · CPL moyen {c.avgCpLoss.toFixed(0)} cp · WR {(c.winRate * 100).toFixed(0)}% sur {c.total} parties.
                </T>
                {c.engineSuggestion && (
                  <T tone="muted" style={{ fontSize: 13 }}>
                    Stockfish a souvent préféré <T tone="win" style={{ fontWeight: '700' }}>{c.engineSuggestion.san}</T> ({c.engineSuggestion.count}× dans tes parties).
                  </T>
                )}
                {open === `c${i}` && <PositionPeek fen={c.fenBefore} color={c.color} />}
              </Card>
            )
          })}
        </>
      )}
    </View>
  )
}
