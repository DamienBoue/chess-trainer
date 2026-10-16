// One book: its exercises one by one (chapter filter, previous / next, jump to
// the next unsolved) with the progress saved per exercise. The website's
// "Rush" sub-mode is left out.
import { Stack, useLocalSearchParams } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import { View } from 'react-native'
import type { Book, BookProgress, ExerciseOutcome } from '@shared/library/types'
import { getBook, getProgress, recordOutcome } from '@shared/library/storage'
import BookExerciseSession from '@/components/BookExerciseSession'
import { OpeningChips } from '@/components/OpeningKit'
import { Button, H1, Screen, T } from '@/components/ui'

export default function LivreScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [book, setBook] = useState<Book | null>(null)
  const [progress, setProgress] = useState<BookProgress | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    Promise.all([getBook(id), getProgress(id)]).then(([b, p]) => {
      if (!alive) return
      if (!b) setError(`Livre introuvable : ${id}`)
      else { setBook(b); setProgress(p) }
    }).catch(e => alive && setError(String(e)))
    return () => { alive = false }
  }, [id])

  if (error) return <Screen><Stack.Screen options={{ title: 'Livre' }} /><T tone="danger">{error}</T></Screen>
  if (!book || !progress) return <Screen><Stack.Screen options={{ title: 'Livre' }} /><T tone="muted">Chargement…</T></Screen>
  return <BookBrowser book={book} progress={progress} onProgress={setProgress} />
}

function BookBrowser({ book, progress, onProgress }: { book: Book; progress: BookProgress; onProgress: (p: BookProgress) => void }) {
  const chapters = useMemo(() => [...new Set(book.exercises.map(e => e.chapter).filter((c): c is string => !!c))], [book])
  const [chapter, setChapter] = useState('all')
  const [idx, setIdx] = useState(0)
  const list = useMemo(() => chapter === 'all' ? book.exercises : book.exercises.filter(e => e.chapter === chapter), [book, chapter])
  const active = list[idx] ?? null
  const solved = list.filter(e => progress.byExercise[e.id]?.outcome === 'solved').length
  const badge = active ? progress.byExercise[active.id] : undefined

  async function record(exerciseId: string, outcome: ExerciseOutcome) {
    onProgress(await recordOutcome(book.id, exerciseId, outcome))
  }

  function nextUnsolved() {
    const i = list.findIndex(e => { const st = progress.byExercise[e.id]; return !st || st.outcome === 'wrong' })
    if (i >= 0) setIdx(i)
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: book.title }} />
      <H1>{book.title}</H1>
      <T tone="muted">
        {book.exercises.length} exercices · Importé le {new Date(book.importedAt).toLocaleDateString('fr-FR')} · {solved} / {list.length} résolus
      </T>

      {chapters.length > 1 ? (
        <OpeningChips
          activeKey={chapter}
          onPick={k => { setChapter(k); setIdx(0) }}
          items={[
            { key: 'all', label: 'Tous', badge: `(${book.exercises.length})` },
            ...chapters.map(c => ({ key: c, label: c, badge: `(${book.exercises.filter(e => e.chapter === c).length})` })),
          ]}
        />
      ) : null}

      {!active ? (
        <T tone="muted">Aucun exercice pour ce filtre.</T>
      ) : (
        <>
          <T tone="strong">
            #{active.n}
            {badge ? <T tone={badge.outcome === 'solved' ? 'win' : badge.outcome === 'revealed' ? 'accent' : 'loss'}>
              {'  '}{badge.outcome === 'solved' ? '✓ résolu' : badge.outcome === 'revealed' ? '👁 révélé' : '✗ raté'}
            </T> : null}
            <T tone="faint">  {active.side === 'w' ? '⚪ Trait aux blancs' : '⚫ Trait aux noirs'} · {active.moves.length}-coup{active.moves.length > 1 ? 's' : ''}</T>
          </T>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button label="← Préc" kind="secondary" disabled={idx === 0} onPress={() => setIdx(i => Math.max(0, i - 1))} style={{ flex: 1 }} />
            <Button label="Suiv →" kind="secondary" disabled={idx >= list.length - 1} onPress={() => setIdx(i => Math.min(list.length - 1, i + 1))} style={{ flex: 1 }} />
          </View>
          <BookExerciseSession key={active.id} exercise={active} onOutcome={o => void record(active.id, o)} />
          <Button label="Aller au prochain non-résolu" kind="secondary" onPress={nextUnsolved} />
        </>
      )}
    </Screen>
  )
}
