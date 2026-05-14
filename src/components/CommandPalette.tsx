// Global "command palette" — Cmd+K / Ctrl+K opens a fuzzy search box.
// Items: every nav view, recently-analyzed games (by opponent), and books
// from the local Library. Enter or click navigates.

import { useEffect, useMemo, useState } from 'react'
import type { ChessComGame, GameAnalysis } from '../types'
import { listBooks } from '../library/storage'
import type { Book } from '../library/types'

export type CommandTarget =
  | { kind: 'view'; view: string; label: string; section: string }
  | { kind: 'game'; gameUrl: string; label: string; section: string }
  | { kind: 'book'; bookId: string; label: string; section: string }

interface Props {
  username: string
  analyses: GameAnalysis[]
  games: ChessComGame[]
  onNavigate: (target: CommandTarget) => void
}

const VIEW_ITEMS = [
  { view: 'home',       label: 'Accueil', section: 'Vues' },
  { view: 'plan',       label: 'Plan du jour', section: 'Vues' },
  { view: 'roadmap',    label: 'Roadmap (progression Elo)', section: 'Vues' },
  { view: 'games',      label: 'Parties', section: 'Vues' },
  { view: 'stats',      label: 'Stats', section: 'Vues' },
  { view: 'repertoire', label: 'Répertoire', section: 'Vues' },
  { view: 'exercises',  label: 'Exercices', section: 'Vues' },
  { view: 'daily',      label: 'Quotidien', section: 'Vues' },
  { view: 'rush',       label: 'Puzzle Rush', section: 'Vues' },
  { view: 'blunder',    label: 'Blunder reflex', section: 'Vues' },
  { view: 'calc',       label: 'Calcul (séquence)', section: 'Vues' },
  { view: 'library',    label: 'Bibliothèque', section: 'Vues' },
  { view: 'compare',    label: 'Comparer (chess.com)', section: 'Vues' },
  { view: 'scouting',   label: 'Scouting (chess.com)', section: 'Vues' },
  { view: 'players',    label: 'Joueurs PGN (FIDE)', section: 'Vues' },
  { view: 'play',       label: 'Jouer vs Stockfish', section: 'Vues' },
  { view: 'settings',   label: 'Préférences', section: 'Vues' },
] as const

function fuzzyMatch(query: string, target: string): boolean {
  const q = query.toLowerCase()
  const t = target.toLowerCase()
  if (!q) return true
  // Match all query characters in order (subsequence).
  let i = 0
  for (const c of t) {
    if (c === q[i]) i++
    if (i >= q.length) return true
  }
  return false
}

export default function CommandPalette({ username, analyses, games, onNavigate }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [books, setBooks] = useState<Book[]>([])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen(o => !o)
      } else if (e.key === 'Escape' && open) {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  useEffect(() => {
    if (!open) return
    setQuery('')
    setSelectedIdx(0)
    listBooks().then(setBooks)
  }, [open])

  const items: CommandTarget[] = useMemo(() => {
    const out: CommandTarget[] = []
    for (const v of VIEW_ITEMS) {
      if (fuzzyMatch(query, v.label)) {
        out.push({ kind: 'view', view: v.view, label: v.label, section: v.section })
      }
    }
    // Recent analyzed games (last 20), keyed by opponent name.
    const recent = analyses
      .slice()
      .sort((a, b) => b.endTime - a.endTime)
      .slice(0, 20)
    for (const a of recent) {
      const label = `vs ${a.opponent} · ${a.userColor === 'white' ? '⚪' : '⚫'} ${a.result}`
      if (fuzzyMatch(query, label)) {
        out.push({ kind: 'game', gameUrl: a.url, label, section: 'Parties analysées' })
      }
    }
    for (const b of books) {
      if (fuzzyMatch(query, b.title)) {
        out.push({ kind: 'book', bookId: b.id, label: b.title, section: 'Bibliothèque' })
      }
    }
    return out.slice(0, 30)
  }, [query, analyses, books])

  // Keep the selection inside bounds when items change.
  useEffect(() => {
    if (selectedIdx >= items.length) setSelectedIdx(0)
  }, [items, selectedIdx])

  function pick(t: CommandTarget) {
    setOpen(false)
    onNavigate(t)
  }

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4 bg-black/60"
      onClick={() => setOpen(false)}
    >
      <div
        className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-lg shadow-2xl w-full max-w-lg overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <input
          autoFocus
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setSelectedIdx(0) }}
          placeholder={`Rechercher (vues, parties, livres)… — connecté en tant que @${username}`}
          className="w-full px-4 py-3 bg-transparent border-b border-[var(--color-border)] text-sm focus:outline-none"
          onKeyDown={e => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(i => Math.min(items.length - 1, i + 1)) }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx(i => Math.max(0, i - 1)) }
            else if (e.key === 'Enter' && items[selectedIdx]) { e.preventDefault(); pick(items[selectedIdx]) }
          }}
        />
        <div className="max-h-80 overflow-y-auto">
          {items.length === 0 ? (
            <p className="px-4 py-6 text-sm text-neutral-500 text-center">Aucun résultat.</p>
          ) : (
            items.map((t, i) => (
              <button
                key={t.kind + ':' + (t.kind === 'view' ? t.view : t.kind === 'game' ? t.gameUrl : t.bookId)}
                onClick={() => pick(t)}
                onMouseEnter={() => setSelectedIdx(i)}
                className={`w-full text-left px-4 py-2 flex items-center gap-3 ${
                  i === selectedIdx ? 'bg-[var(--color-accent)]/20' : 'hover:bg-neutral-800'
                }`}
              >
                <span className="text-xs text-neutral-500 w-24 shrink-0">{t.section}</span>
                <span className="text-sm text-neutral-200 truncate flex-1">{t.label}</span>
              </button>
            ))
          )}
        </div>
        <div className="px-4 py-2 border-t border-[var(--color-border)] text-[10px] text-neutral-500 flex justify-between">
          <span>↑↓ pour naviguer · Entrée pour ouvrir · Esc pour fermer</span>
          <span>{games.length} parties · {books.length} livres</span>
        </div>
      </div>
    </div>
  )
}
