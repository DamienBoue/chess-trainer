// The website's tab bar icons (MobileTabBar.tsx), drawn with react-native-svg.
import type { ColorValue } from 'react-native'
import Svg, { Circle, Path, Rect } from 'react-native-svg'

export type TabIconName = 'home' | 'games' | 'train' | 'theory' | 'progress'

export default function TabIcon({ name, color, size = 24 }: { name: TabIconName; color: ColorValue; size?: number }) {
  const common = { fill: 'none', stroke: color, strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'home' && <><Rect x="3" y="5" width="18" height="16" rx="2" {...common} /><Path d="M3 10h18M8 3v4M16 3v4M9 15l2 2 4-4" {...common} /></>}
      {name === 'games' && <><Rect x="3" y="3" width="18" height="18" rx="1" {...common} /><Path d="M3 12h18M12 3v18" {...common} /></>}
      {name === 'train' && <><Circle cx="12" cy="12" r="9" {...common} /><Circle cx="12" cy="12" r="5" {...common} /><Circle cx="12" cy="12" r="1.5" {...common} /></>}
      {name === 'theory' && <Path d="M2 5h7a3 3 0 0 1 3 3v12a2 2 0 0 0-2-2H2zM22 5h-7a3 3 0 0 0-3 3v12a2 2 0 0 1 2-2h8z" {...common} />}
      {name === 'progress' && <Path d="M4 20V10M10 20V4M16 20v-7M22 20H2" {...common} />}
    </Svg>
  )
}
