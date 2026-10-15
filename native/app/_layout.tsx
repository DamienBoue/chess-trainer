import { DarkTheme, Stack, ThemeProvider } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import EngineHost from '@/components/EngineHost'
import { AppDataProvider } from '@/lib/appData'
import { C } from '@/constants/theme'

export { ErrorBoundary } from 'expo-router'

const theme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: C.bg, card: C.panel, border: C.border, primary: C.accentHover, text: C.text },
}

export default function RootLayout() {
  return (
    <ThemeProvider value={theme}>
      <AppDataProvider>
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: C.panel },
            headerTintColor: C.text,
            contentStyle: { backgroundColor: C.bg },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack>
        <EngineHost />
        <StatusBar style="light" />
      </AppDataProvider>
    </ThemeProvider>
  )
}
