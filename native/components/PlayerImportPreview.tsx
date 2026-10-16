// After reading a PGN: the players found (≥ 3 games), all ticked, to keep or
// drop before saving.
import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import type { PlayerProfile } from '@shared/players/storage'
import { Button, Card, T } from '@/components/ui'
import { C, TOUCH } from '@/constants/theme'

export default function PlayerImportPreview({ profiles, busy, onCancel, onConfirm }: {
  profiles: PlayerProfile[]
  busy: boolean
  onCancel: () => void
  onConfirm: (ids: Set<string>) => void
}) {
  const [checked, setChecked] = useState<Set<string>>(() => new Set(profiles.map(p => p.id)))
  const toggle = (id: string) => setChecked(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })
  const all = checked.size === profiles.length

  return (
    <Card highlight style={{ gap: 10 }}>
      <T tone="strong" style={{ fontWeight: '700', fontSize: 16 }}>{profiles.length} profils détectés</T>
      <T tone="faint">Décoche pour ignorer.</T>
      <Button
        label={all ? 'Tout décocher' : 'Tout cocher'}
        kind="secondary"
        onPress={() => setChecked(all ? new Set() : new Set(profiles.map(p => p.id)))}
      />
      {/* A TWIC file lists hundreds of players: the list scrolls on its own. */}
      <ScrollView style={styles.list} nestedScrollEnabled>
        {profiles.map(p => (
          <Pressable key={p.id} onPress={() => toggle(p.id)} accessibilityRole="checkbox" accessibilityState={{ checked: checked.has(p.id) }} style={styles.row}>
            <Text style={styles.box}>{checked.has(p.id) ? '☑' : '☐'}</Text>
            <Text style={styles.name} numberOfLines={1}>{p.name}</Text>
            <Text style={styles.count}>{p.games.length} parties</Text>
          </Pressable>
        ))}
      </ScrollView>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button label="Annuler" kind="secondary" onPress={onCancel} style={{ flex: 1 }} />
        <Button label={`Importer ${checked.size}`} onPress={() => onConfirm(checked)} disabled={checked.size === 0} busy={busy} style={{ flex: 1 }} />
      </View>
    </Card>
  )
}

const styles = StyleSheet.create({
  list: { maxHeight: 320, borderColor: C.border, borderWidth: 1, borderRadius: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: TOUCH, paddingHorizontal: 12 },
  box: { color: C.accentHover, fontSize: 20 },
  name: { flex: 1, color: C.text, fontSize: 15 },
  count: { color: C.faint, fontSize: 12 },
})
