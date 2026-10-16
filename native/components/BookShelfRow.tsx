// One book of the library: title, counts, progress bar, open and delete
// (delete takes two taps: Alert has no multi-button on the web build).
import { StyleSheet, Text, View } from 'react-native'
import type { Book } from '@shared/library/types'
import { Button, Card, T } from '@/components/ui'
import { C, TOUCH } from '@/constants/theme'

export default function BookShelfRow({ book, solved, attempted, confirmingDelete, onOpen, onDelete }: {
  book: Book
  solved: number
  attempted: number
  confirmingDelete: boolean
  onOpen: () => void
  onDelete: () => void
}) {
  const total = book.exercises.length
  const pct = total > 0 ? Math.round((solved / total) * 100) : 0
  return (
    <Card style={{ gap: 8 }}>
      <T tone="strong" style={styles.title} numberOfLines={2}>{book.title}</T>
      <T tone="faint">
        {total} exercices · Source : {book.source.toUpperCase()} · Importé le {new Date(book.importedAt).toLocaleDateString('fr-FR')}
      </T>
      <View style={styles.progressRow}>
        <View style={styles.track}><View style={{ width: `${pct}%`, height: '100%', backgroundColor: C.win }} /></View>
        <Text style={styles.count}>
          <Text style={{ color: C.win }}>{solved}</Text> / {total}
        </Text>
      </View>
      <T tone="faint">{attempted > 0 ? `${attempted} tentés · ` : ''}{pct}% résolus</T>
      <View style={styles.actions}>
        <Button label="Ouvrir" onPress={onOpen} style={{ flex: 1 }} />
        <Button
          label={confirmingDelete ? 'Confirmer la suppression' : 'Supprimer'}
          kind="secondary"
          onPress={onDelete}
          style={{ flex: 1, minHeight: TOUCH }}
        />
      </View>
      {confirmingDelete ? <T tone="danger">La progression de ce livre est effacée aussi.</T> : null}
    </Card>
  )
}

const styles = StyleSheet.create({
  title: { fontSize: 17, fontWeight: '700' },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  track: { flex: 1, height: 6, borderRadius: 3, backgroundColor: C.bg, overflow: 'hidden' },
  count: { color: C.muted, fontSize: 14, fontVariant: ['tabular-nums'] },
  actions: { flexDirection: 'row', gap: 8, marginTop: 4 },
})
