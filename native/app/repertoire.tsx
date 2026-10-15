// "Mon répertoire": the player's lines per opening and colour, the critical
// positions and the line trainer. The website's five tabs become three on a
// phone (Trainer + SRS are folded, the position explorer is left out).
import { Stack } from 'expo-router'
import { useMemo, useState } from 'react'
import { buildRepertoire, critiqueRepertoire } from '@shared/analysis/repertoire'
import { OpeningEmpty, OpeningSegments } from '@/components/OpeningKit'
import RepertoireCritiquesPanel from '@/components/RepertoireCritiquesPanel'
import RepertoireDrillPanel from '@/components/RepertoireDrillPanel'
import RepertoireLinesPanel from '@/components/RepertoireLinesPanel'
import { Card, H1, Screen, T } from '@/components/ui'
import { useAppData } from '@/lib/appData'

type Tab = 'lines' | 'critiques' | 'train'

export default function RepertoireScreen() {
  const { analyses } = useAppData()
  const list = useMemo(() => Object.values(analyses), [analyses])
  const roots = useMemo(() => buildRepertoire(list), [list])
  const critiqueCount = useMemo(() => critiqueRepertoire(roots).length, [roots])
  const [tab, setTab] = useState<Tab>('lines')

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Mon répertoire' }} />
      {list.length < 3 ? (
        <OpeningEmpty
          title="Pas encore de répertoire"
          description={`Le répertoire émerge de tes parties analysées (regroupées par ouverture parent + couleur). Il te faut au moins 3 parties (tu en as ${list.length}).`}
        />
      ) : (
        <>
          <H1>Mon répertoire</H1>
          <T tone="muted">Tes lignes principales par ouverture, construites à partir des parties analysées.</T>
          <OpeningSegments
            value={tab}
            onChange={setTab}
            options={[
              { key: 'lines', label: 'Lignes' },
              { key: 'critiques', label: critiqueCount > 0 ? `Critiques (${critiqueCount})` : 'Critiques' },
              { key: 'train', label: "S'entraîner" },
            ]}
          />
          {roots.length === 0 ? (
            <Card><T tone="muted">Aucune ouverture jouée plus d'une fois pour ce filtre.</T></Card>
          ) : tab === 'lines' ? (
            <RepertoireLinesPanel roots={roots} />
          ) : tab === 'critiques' ? (
            <RepertoireCritiquesPanel roots={roots} />
          ) : (
            <RepertoireDrillPanel roots={roots} />
          )}
        </>
      )}
    </Screen>
  )
}
