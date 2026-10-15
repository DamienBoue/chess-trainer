// First launch: the chess.com account whose games the app trains on.
import { useState } from 'react'
import { KeyboardAvoidingView, Platform, StyleSheet, TextInput } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Button, H1, T } from '@/components/ui'
import { useAppData } from '@/lib/appData'
import { C, RADIUS, TOUCH } from '@/constants/theme'

export default function Login() {
  const { login } = useAppData()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    if (!name.trim()) return
    setBusy(true)
    setError(null)
    try {
      await login(name)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <SafeAreaView style={styles.root}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.body}>
        <H1>♞ Chess Trainer</H1>
        <T tone="muted">Tes parties chess.com analysées par Stockfish, tes erreurs en exercices et les plans stratégiques de tes positions.</T>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Ton pseudo chess.com"
          placeholderTextColor={C.faint}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="go"
          onSubmitEditing={submit}
          style={styles.input}
          accessibilityLabel="Pseudo chess.com"
        />
        {error && <T tone="danger">{error}</T>}
        <Button label="Charger mes parties" onPress={submit} busy={busy} disabled={!name.trim()} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  body: { flex: 1, justifyContent: 'center', padding: 24, gap: 16 },
  input: {
    minHeight: TOUCH, borderRadius: RADIUS, borderWidth: 1, borderColor: C.border, backgroundColor: C.panel,
    color: C.strong, paddingHorizontal: 14, fontSize: 16,
  },
})
