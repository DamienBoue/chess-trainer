import { useEffect, useRef, useState } from 'react'
import type { Book } from '../library/types'
import { listBooks, deleteBook, getProgress, saveBook } from '../library/storage'
import { importBookFromFile, migrateLegacyWoodpeckerProgress, validateBookJson } from '../library/import'
import { toast } from './Toast'

interface Props {
  onOpenBook: (bookId: string) => void
}

interface BookRow {
  book: Book
  solved: number
  attempted: number
}

export default function LibraryView({ onOpenBook }: Props) {
  const [rows, setRows] = useState<BookRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement | null>(null)

  async function refresh() {
    const books = await listBooks()
    const enriched = await Promise.all(books.map(async b => {
      const p = await getProgress(b.id)
      const states = Object.values(p.byExercise)
      return {
        book: b,
        solved: states.filter(s => s.outcome === 'solved').length,
        attempted: states.length,
      }
    }))
    setRows(enriched)
  }

  useEffect(() => {
    migrateLegacyWoodpeckerProgress().finally(refresh)
  }, [])

  async function onFile(files: FileList | null) {
    if (!files || files.length === 0) return
    setBusy(true)
    setError(null)
    try {
      const arr = Array.from(files)
      for (const file of arr) {
        await importBookFromFile(file)
      }
      await refresh()
      toast.success(`${arr.length} livre${arr.length > 1 ? 's' : ''} importé${arr.length > 1 ? 's' : ''}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function onDelete(bookId: string, title: string) {
    if (!confirm(`Supprimer "${title}" de ta bibliothèque ? La progression est effacée aussi.`)) return
    await deleteBook(bookId)
    await refresh()
  }

  async function installBundledBook(url: string, label: string) {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}${url}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const raw = await res.json()
      const book = validateBookJson(raw)
      await saveBook(book)
      await refresh()
      toast.success(`Pack "${label}" installé`)
    } catch (e) {
      setError(`Échec du chargement de ${label} : ${e instanceof Error ? e.message : e}`)
      toast.error(`Pack "${label}" : ${e instanceof Error ? e.message : 'erreur'}`)
    } finally {
      setBusy(false)
    }
  }

  const hasLichess = rows?.some(r => r.book.id === 'lichess-puzzles') ?? false
  const hasEndgames = rows?.some(r => r.book.id === 'endgames') ?? false

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-4 flex items-baseline justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-semibold">Bibliothèque</h2>
          <p className="text-sm text-neutral-400">
            Tes livres d'exercices importés. Les fichiers JSON sont stockés localement (IndexedDB) — rien n'est uploadé.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {!hasLichess && (
            <button
              onClick={() => installBundledBook('books/lichess-sample.book.json', 'Lichess')}
              disabled={busy}
              className="px-3 py-1.5 text-sm rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-medium"
              title="1000 puzzles Lichess (CC0), répartis sur 4 niveaux de rating"
            >
              ♟ Pack Lichess (1000)
            </button>
          )}
          {!hasEndgames && (
            <button
              onClick={() => installBundledBook('books/endgames.book.json', 'Finales')}
              disabled={busy}
              className="px-3 py-1.5 text-sm rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-medium"
              title="Positions classiques de finale avec explications"
            >
              ♛ Pack Finales (21)
            </button>
          )}
          <label className="px-3 py-1.5 text-sm rounded bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white font-medium cursor-pointer">
            {busy ? 'Import…' : '＋ Importer un JSON'}
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              multiple
              onChange={e => onFile(e.target.files)}
              className="hidden"
              disabled={busy}
            />
          </label>
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-red-900/30 border border-red-700/50 rounded p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <details className="mb-5 bg-[var(--color-panel)] border border-[var(--color-border)] rounded p-3 text-sm">
        <summary className="cursor-pointer text-neutral-300">Comment importer un livre ?</summary>
        <div className="mt-3 text-neutral-400 leading-relaxed space-y-2">
          <p>
            <strong>PDF (livre d'exercices)</strong> — lance{' '}
            <code className="bg-neutral-900 px-1 py-0.5 rounded text-xs">scripts/import_book.py &lt;chemin.pdf&gt;</code> sur ton PDF
            (il faut <code>pymupdf</code> et <code>python-chess</code>). Le script produit un JSON que tu déposes ici.
            Ça fonctionne sur les PDFs qui utilisent une police d'échecs vectorielle (Quality Chess, Gambit, Everyman…).
            Pour les PDFs avec diagrammes en images (ChessBase), repasse par un export PGN puis l'onglet "Parties".
          </p>
          <p>
            <strong>Lichess Puzzle DB</strong> — télécharge{' '}
            <a href="https://database.lichess.org/lichess_db_puzzle.csv.zst" className="underline text-neutral-200" target="_blank" rel="noopener">
              lichess_db_puzzle.csv.zst
            </a>{' '}(CC0, ~280 MB) puis :{' '}
            <code className="bg-neutral-900 px-1 py-0.5 rounded text-xs">
              scripts/import_lichess_puzzles.py lichess_db_puzzle.csv.zst --max 2000 --balanced-bands
            </code>.
            Tu obtiens un JSON à importer ici (par défaut 1000 puzzles répartis sur 4 niveaux). Tu peux filtrer par
            thème (<code>--theme fork --theme pin</code>) ou rating (<code>--min-rating 1400</code>).
          </p>
        </div>
      </details>

      {!rows ? (
        <p className="text-neutral-400">Chargement…</p>
      ) : rows.length === 0 ? (
        <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded p-8 text-center">
          <p className="text-neutral-400 mb-2">Aucun livre importé pour l'instant.</p>
          <p className="text-xs text-neutral-500">
            Déroule "Comment importer" ci-dessus pour la marche à suivre.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map(({ book, solved, attempted }) => {
            const total = book.exercises.length
            const pct = total > 0 ? Math.round((solved / total) * 100) : 0
            return (
              <div
                key={book.id}
                className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded p-4 flex items-center gap-4 flex-wrap"
              >
                <div className="flex-1 min-w-0">
                  <button
                    onClick={() => onOpenBook(book.id)}
                    className="text-left font-semibold text-neutral-100 hover:text-white text-lg truncate block"
                  >
                    {book.title}
                  </button>
                  <div className="text-xs text-neutral-500 mt-0.5">
                    {total} exercices ·
                    {' '}Source : {book.source.toUpperCase()} ·
                    {' '}Importé le {new Date(book.importedAt).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-sm">
                      <span className="font-mono text-green-300">{solved}</span>
                      <span className="text-neutral-500"> / {total}</span>
                    </div>
                    <div className="text-[10px] text-neutral-500">
                      {attempted > 0 && `${attempted} tentés · `}{pct}%
                    </div>
                  </div>
                  <div className="w-24 h-1.5 bg-neutral-900 rounded overflow-hidden">
                    <div className="h-full bg-green-500" style={{ width: `${pct}%` }} />
                  </div>
                  <button
                    onClick={() => onOpenBook(book.id)}
                    className="px-3 py-1.5 text-sm rounded bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white"
                  >
                    Ouvrir
                  </button>
                  <button
                    onClick={() => onDelete(book.id, book.title)}
                    title="Supprimer le livre et sa progression"
                    className="px-2 py-1.5 text-sm rounded text-neutral-400 hover:bg-red-900/40 hover:text-red-300"
                  >
                    ✕
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
