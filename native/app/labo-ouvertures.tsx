// "Labo d'ouvertures": your most played line against the masters (Lichess
// explorer), ply by ply, flagging moves outside the masters' top 3.
import { Stack } from 'expo-router'
import { useMemo, useState } from 'react'
import { View } from 'react-native'
import { buildRepertoire, type RepertoireRoot } from '@shared/analysis/repertoire'
import { mostPlayedLine } from '@shared/analysis/openingLine'
import OpeningLabPly from '@/components/OpeningLabPly'
import { OpeningChips, OpeningEmpty } from '@/components/OpeningKit'
import { Card, H1, Screen, T } from '@/components/ui'
import { useAppData } from '@/lib/appData'

const keyOf = (r: RepertoireRoot) => `${r.parent}::${r.color}`

export default function OpeningLabScreen() {
  const { analyses } = useAppData()
  const list = useMemo(() => Object.values(analyses), [analyses])
  const roots = useMemo(() => buildRepertoire(list), [list])
  const [picked, setPicked] = useState<string | null>(null)
  // Until a pick, the most played opening; looked up in the current roots so
  // a pick follows its opening when the games change.
  const shown = roots.find(r => keyOf(r) === picked) ?? roots[0] ?? null
  const line = useMemo(() => (shown ? mostPlayedLine(shown, { maxPlies: 8 }) : []), [shown])

  return (
    <Screen>
      <Stack.Screen options={{ title: "Labo d'ouvertures" }} />
      {roots.length === 0 ? (
        <OpeningEmpty
          title="Labo d'ouvertures"
          description="Pas encore de répertoire à explorer : analyse quelques parties d'abord."
        />
      ) : (
        <>
          <H1>Labo d'ouvertures</H1>
          <T tone="muted">Ce que tu joues vs ce que les maîtres jouent. Repère les déviations théoriques.</T>
          <OpeningChips
            items={roots.map(r => ({ key: keyOf(r), label: `${r.color === 'white' ? '♙' : '♟'} ${r.parent}`, badge: `${r.total}` }))}
            activeKey={shown ? keyOf(shown) : null}
            onPick={setPicked}
          />
          {shown && line.length === 0 && (
            <Card><T tone="muted">Pas assez de données pour reconstruire une ligne : peu de demi-coups enregistrés.</T></Card>
          )}
          {shown && line.length > 0 && (
            <View style={{ gap: 12 }}>
              <Card>
                <T tone="faint" style={{ fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' }}>Ta ligne la plus jouée</T>
                <T tone="strong">
                  {line.map((s, i) => `${i > 0 ? ' ' : ''}${s.oppPrev !== '<start>' ? s.oppPrev + ' ' : ''}${s.userSan}`).join('')}
                </T>
              </Card>
              {line.map((step, i) => (
                <OpeningLabPly
                  key={`${keyOf(shown)}:${i}`}
                  step={step}
                  plyNumber={i + 1}
                  color={shown.color}
                  delayMs={i * 250}
                />
              ))}
            </View>
          )}
        </>
      )}
    </Screen>
  )
}
