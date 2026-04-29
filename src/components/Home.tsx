import { useState } from 'react'
import type { ChessComGame } from '../types'
import { getRecentGames } from '../api/chesscom'

interface Props {
  initialUsername: string
  onSubmit: (username: string, games: ChessComGame[]) => void
}

export default function Home({ initialUsername, onSubmit }: Props) {
  const [username, setUsername] = useState(initialUsername)
  const [count, setCount] = useState(20)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
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

  return (
    <div className="max-w-xl mx-auto p-8 mt-8">
      <h2 className="text-3xl font-semibold mb-2">Analyse tes parties chess.com</h2>
      <p className="text-neutral-400 mb-6">
        Entre ton pseudo chess.com pour récupérer tes parties récentes et les analyser localement avec Stockfish.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
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

      <div className="mt-8 text-xs text-neutral-500">
        Les parties sont récupérées via l'API publique chess.com (pas d'auth requise pour les parties publiques).
        L'analyse Stockfish tourne entièrement dans ton navigateur, rien n'est envoyé à un serveur.
      </div>
    </div>
  )
}
