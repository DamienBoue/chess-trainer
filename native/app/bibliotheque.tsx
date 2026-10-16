// "Bibliothèque": the imported exercise books with their progress, the two
// bundled packs (fetched from the website) and the JSON import.
import { Stack, router, useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'
import { Pressable, View } from 'react-native'
import type { Book } from '@shared/library/types'
import { deleteBook, getProgress, listBooks, saveBook } from '@shared/library/storage'
import { validateBookJson } from '@shared/library/import'
import BookShelfRow from '@/components/BookShelfRow'
import { Button, Card, H1, Screen, T } from '@/components/ui'
import { pickTextFiles } from '@/lib/pickTextFiles'

// The bundled books are static files of the website; the app has no copy.
const SITE = 'https://damienboue.github.io/chess-trainer/'
const PACKS = [
  { id: 'lichess-puzzles', file: 'books/lichess-sample.book.json', label: 'Lichess', button: '♟ Pack Lichess (1000)', hint: '1000 puzzles Lichess (CC0), répartis sur 4 niveaux d\'Elo' },
  { id: 'endgames', file: 'books/endgames.book.json', label: 'Finales', button: '♛ Pack Finales (13)', hint: 'Positions classiques de finale avec explications' },
]

interface Row { book: Book; solved: number; attempted: number }

export default function BibliothequeScreen() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [help, setHelp] = useState(false)

  const refresh = useCallback(async () => {
    const books = await listBooks()
    setRows(await Promise.all(books.map(async book => {
      const states = Object.values((await getProgress(book.id)).byExercise)
      return { book, solved: states.filter(s => s.outcome === 'solved').length, attempted: states.length }
    })))
  }, [])
  // Back from a book, its progress has moved.
  useFocusEffect(useCallback(() => { void refresh().catch(e => setError(String(e))) }, [refresh]))

  async function importFiles() {
    setBusy(true); setError(null); setNotice(null)
    try {
      const files = await pickTextFiles()
      if (!files) return
      let n = 0
      for (const f of files) {
        let raw: unknown
        try { raw = JSON.parse(f.text) } catch { throw new Error(`${f.name} : fichier JSON invalide.`) }
        await saveBook(validateBookJson(raw))
        n++
      }
      await refresh()
      setNotice(`${n} livre${n > 1 ? 's' : ''} importé${n > 1 ? 's' : ''}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function installPack(pack: typeof PACKS[number]) {
    setBusy(true); setError(null); setNotice(null)
    try {
      const res = await fetch(`${SITE}${pack.file}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      await saveBook(validateBookJson(await res.json()))
      await refresh()
      setNotice(`Pack "${pack.label}" installé`)
    } catch (e) {
      setError(`Échec du chargement de ${pack.label} : ${e instanceof Error ? e.message : e}`)
    } finally {
      setBusy(false)
    }
  }

  async function onDelete(id: string) {
    if (confirmId !== id) { setConfirmId(id); return }
    setConfirmId(null)
    await deleteBook(id)
    await refresh()
  }

  const missing = PACKS.filter(p => !rows?.some(r => r.book.id === p.id))

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Bibliothèque' }} />
      <H1>Bibliothèque</H1>
      <T tone="muted">Tes livres d'exercices importés. Les fichiers JSON sont stockés sur le téléphone — rien n'est envoyé.</T>

      <Button label="＋ Importer un JSON" onPress={() => void importFiles()} busy={busy} />
      {missing.map(p => (
        <Button key={p.id} label={p.button} kind="secondary" disabled={busy} onPress={() => void installPack(p)} />
      ))}
      {missing.length > 0 ? <T tone="faint">{missing.map(p => `${p.label} : ${p.hint}`).join(' · ')}</T> : null}

      {error ? <View style={{ backgroundColor: 'rgba(248,113,113,0.12)', borderRadius: 8, padding: 10 }}><T tone="loss">{error}</T></View> : null}
      {notice ? <T tone="win">{notice}</T> : null}

      <Card>
        <Pressable onPress={() => setHelp(h => !h)} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }}>
          <T tone="muted">{help ? '▾' : '▸'} Comment importer un livre ?</T>
        </Pressable>
        {help ? (
          <View style={{ gap: 8 }}>
            <T tone="muted">
              PDF d'exercices : lance scripts/import_book.py sur ton ordinateur (pymupdf et python-chess requis) ; ça fonctionne
              avec les PDF à police d'échecs vectorielle (Quality Chess, Gambit, Everyman…). Pour les PDF à diagrammes en images
              (ChessBase), passe par un export PGN et l'écran « Joueurs (PGN) ».
            </T>
            <T tone="muted">
              Puzzles Lichess : télécharge lichess_db_puzzle.csv.zst (CC0, ~280 Mo) puis lance scripts/import_lichess_puzzles.py
              --max 2000 --balanced-bands. Envoie ensuite le JSON obtenu sur le téléphone (Fichiers, AirDrop…) et importe-le ici.
            </T>
          </View>
        ) : null}
      </Card>

      {!rows ? (
        <T tone="muted">Chargement…</T>
      ) : rows.length === 0 ? (
        <Card><T tone="muted">Aucun livre importé pour l'instant. Installe un pack ou importe un JSON.</T></Card>
      ) : rows.map(({ book, solved, attempted }) => (
        <BookShelfRow
          key={book.id}
          book={book}
          solved={solved}
          attempted={attempted}
          confirmingDelete={confirmId === book.id}
          onOpen={() => router.push({ pathname: '/livre/[id]', params: { id: book.id } })}
          onDelete={() => void onDelete(book.id)}
        />
      ))}
    </Screen>
  )
}
