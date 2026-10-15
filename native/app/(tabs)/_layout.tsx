// The five parts of the app, as on the website's phone layout.
import { useMemo } from 'react'
import { Tabs } from 'expo-router'
import { extractExercises } from '@shared/analysis/exercises'
import { isDue } from '@shared/storage/persist'
import TabIcon, { type TabIconName } from '@/components/TabIcon'
import Login from '@/components/Login'
import { useAppData } from '@/lib/appData'
import { C } from '@/constants/theme'

const TABS: { name: string; title: string; icon: TabIconName }[] = [
  { name: 'index', title: 'Aujourd\'hui', icon: 'home' },
  { name: 'parties', title: 'Parties', icon: 'games' },
  { name: 'entrainement', title: 'Entraînement', icon: 'train' },
  { name: 'theorie', title: 'Théorie', icon: 'theory' },
  { name: 'progres', title: 'Progrès', icon: 'progress' },
]

export default function TabLayout() {
  const { username, analyses, progress } = useAppData()
  const due = useMemo(
    () => extractExercises(Object.values(analyses)).filter(e => isDue(progress[e.id])).length,
    [analyses, progress],
  )
  if (!username) return <Login />
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: C.panel },
        headerTintColor: C.text,
        headerShadowVisible: false,
        tabBarStyle: { backgroundColor: C.panel, borderTopColor: C.border },
        tabBarActiveTintColor: C.accentHover,
        tabBarInactiveTintColor: C.faint,
        sceneStyle: { backgroundColor: C.bg },
      }}
    >
      {TABS.map(t => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.title,
            tabBarIcon: ({ color }) => <TabIcon name={t.icon} color={color} />,
            tabBarBadge: t.name === 'entrainement' && due > 0 ? due : undefined,
            tabBarBadgeStyle: { backgroundColor: C.accent, color: C.strong },
          }}
        />
      ))}
    </Tabs>
  )
}
