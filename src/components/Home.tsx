import { useState } from 'react'
import type { ChessComGame } from '../types'
import { getRecentGames } from '../api/chesscom'
import { importPgnAsChessComGame } from '../api/pgn-import'

interface Props {
  initialUsername: string
  onSubmit: (username: string, games: ChessComGame[]) => void
}

type Mode = 'chesscom' | 'pgn'

export default function Home({ initialUsername, onSubmit }: Props) {
  const [mode, setMode] = useState<Mode>('chesscom')
  const [username, setUsername] = useState(initialUsername)
  const [count, setCount] = useState(20)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // PGN-import state
  const [pgnText, setPgnText] = useState('')
  const [pgnColor, setPgnColor] = useState<'auto' | 'white' | 'black'>('auto')

  async function handleChessCom(e: React.FormEvent) {
    e.preventDefault()
    if (!username.trim()) return
    setLoading(true)
    setError(null)
    try {
      const games = await getRecentGames(username.trim(), count)
      if (games.length === 0) {
        setError('Aucune partie trouvée pour ce pseudo.')
        return
      }
      onSubmit(username.trim(), games)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }

  function handlePgn(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const cleanedPgn = pgnText.trim()
    if (!cleanedPgn) {
      setError('Colle un PGN d\'abord.')
      return
    }
    if (!username.trim()) {
      setError('Indique un pseudo (sera utilisé comme identifiant local pour tes parties importées).')
      return
    }
    try {
      // Split if multiple games are pasted (separated by [Event] markers).
      const blocks = splitPgnBlocks(cleanedPgn)
      const games: ChessComGame[] = blocks.map(b => importPgnAsChessComGame(b, pgnColor, username.trim()))
      if (games.length === 0) {
        setError('Aucun PGN valide détecté.')
        return
      }
      onSubmit(username.trim(), games)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'PGN invalide')
    }
  }

  return (
    <div className="max-w-xl mx-auto p-8 mt-8">
      <h2 className="text-3xl font-semibold mb-2">Analyse tes parties</h2>
      <p className="text-neutral-400 mb-6">
        Récupère tes parties depuis chess.com ou colle un PGN pour analyser n'importe quelle partie localement avec Stockfish.
      </p>

      <div className="inline-flex rounded-md border border-[var(--color-border)] bg-[var(--color-panel)] p-0.5 text-sm mb-6">
        <ModeTab active={mode === 'chesscom'} onClick={() => setMode('chesscom')}>chess.com</ModeTab>
        <ModeTab active={mode === 'pgn'} onClick={() => setMode('pgn')}>Importer un PGN</ModeTab>
      </div>

      {mode === 'chesscom' && (
        <form onSubmit={handleChessCom} className="space-y-4">
          <div>
            <label className="block text-sm text-neutral-300 mb-1">Pseudo chess.com</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="ex: hikaru"
              className="w-full px-3 py-2 bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md focus:outline-none focus:border-[var(--color-accent)]"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm text-neutral-300 mb-1">Nombre de parties à charger</label>
            <input
              type="number"
              min={1}
              max={100}
              value={count}
              onChange={(e) => setCount(parseInt(e.target.value, 10) || 20)}
              className="w-full px-3 py-2 bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md focus:outline-none focus:border-[var(--color-accent)]"
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading || !username.trim()}
            className="w-full px-4 py-2 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white rounded-md font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Chargement…' : 'Charger les parties'}
          </button>
        </form>
      )}

      {mode === 'pgn' && (
        <form onSubmit={handlePgn} className="space-y-4">
          <div>
            <label className="block text-sm text-neutral-300 mb-1">Pseudo (identifiant local)</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="ton pseudo (utilisé pour grouper localement)"
              className="w-full px-3 py-2 bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md focus:outline-none focus:border-[var(--color-accent)]"
            />
          </div>

          <div>
            <label className="block text-sm text-neutral-300 mb-1">Tu joues avec</label>
            <div className="flex gap-2 text-sm">
              {(['auto', 'white', 'black'] as const).map(c => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setPgnColor(c)}
                  className={`px-3 py-1.5 rounded border ${
                    pgnColor === c
                      ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10'
                      : 'border-[var(--color-border)] hover:bg-neutral-800'
                  }`}
                >
                  {c === 'auto' ? 'Auto (depuis le pseudo)' : c === 'white' ? 'Blancs' : 'Noirs'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm text-neutral-300 mb-1">PGN (un ou plusieurs)</label>
            <textarea
              value={pgnText}
              onChange={(e) => setPgnText(e.target.value)}
              rows={10}
              placeholder='[Event "..."]&#10;[White "..."]&#10;[Black "..."]&#10;...&#10;1. e4 e5 ...'
              className="w-full px-3 py-2 bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md focus:outline-none focus:border-[var(--color-accent)] font-mono text-xs"
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            className="w-full px-4 py-2 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white rounded-md font-medium transition-colors"
          >
            Importer
          </button>
        </form>
      )}

      <div className="mt-8 text-xs text-neutral-500">
        L'analyse Stockfish tourne entièrement dans ton navigateur, rien n'est envoyé à un serveur.
      </div>
    </div>
  )
}

function ModeTab({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1 rounded transition-colors ${
        active ? 'bg-[var(--color-accent)] text-white' : 'text-neutral-300 hover:bg-neutral-800'
      }`}
    >
      {children}
    </button>
  )
}

// Split a PGN blob into individual games. Headers always start with "[Event ".
function splitPgnBlocks(raw: string): string[] {
  const parts: string[] = []
  const lines = raw.split('\n')
  let current: string[] = []
  for (const line of lines) {
    if (line.startsWith('[Event ') && current.length > 0) {
      parts.push(current.join('\n').trim())
      current = []
    }
    current.push(line)
  }
  if (current.length > 0) parts.push(current.join('\n').trim())
  return parts.filter(p => p.length > 0)
}
