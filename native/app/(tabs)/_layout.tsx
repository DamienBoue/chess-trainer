// The five parts of the app, as on the website's phone layout.
import { useMemo } from 'react'
import { Pressable } from 'react-native'
import { Tabs, router } from 'expo-router'
import Svg, { Circle, Path } from 'react-native-svg'
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
        headerRight: () => (
          <Pressable onPress={() => router.push('/preferences')} accessibilityRole="button" accessibilityLabel="Préférences" hitSlop={8} style={{ paddingHorizontal: 14, height: 44, justifyContent: 'center' }}>
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <Circle cx="12" cy="12" r="3" />
              <Path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </Svg>
          </Pressable>
        ),
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
