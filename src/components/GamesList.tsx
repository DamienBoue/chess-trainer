import type { ChessComGame, GameAnalysis } from '../types'
import { getResultForUser, getUserSide, parsePgnHeaders } from '../analysis/pgn'

interface Props {
  username: string
  games: ChessComGame[]
  analyses: Record<string, GameAnalysis>
  onSelectGame: (game: ChessComGame) => void
}

export default function GamesList({ username, games, analyses, onSelectGame }: Props) {
  if (games.length === 0) {
    return <div className="p-8 text-neutral-400">Aucune partie chargée.</div>
  }
  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-xl font-semibold">{games.length} parties récentes</h2>
        <span className="text-xs text-neutral-500">{Object.keys(analyses).length} analysée(s)</span>
      </div>

      <div className="space-y-1">
        {games.map((g) => (
          <GameRow
            key={g.url}
            game={g}
            username={username}
            analyzed={!!analyses[g.url]}
            onClick={() => onSelectGame(g)}
          />
        ))}
      </div>
    </div>
  )
}

function GameRow({
  game,
  username,
  analyzed,
  onClick,
}: {
  game: ChessComGame
  username: string
  analyzed: boolean
  onClick: () => void
}) {
  const side = getUserSide(game, username)
  const result = getResultForUser(game, username)
  const opponent = side === 'white' ? game.black : game.white
  const headers = parsePgnHeaders(game.pgn)
  const date = new Date(game.end_time * 1000)

  const resultColor = result === 'win'
    ? 'text-green-400'
    : result === 'loss'
      ? 'text-red-400'
      : 'text-neutral-300'

  const resultLabel = result === 'win' ? 'Victoire' : result === 'loss' ? 'Défaite' : 'Nulle'

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-[var(--color-panel)] hover:bg-neutral-800 border border-[var(--color-border)] rounded-md p-3 flex items-center gap-4 transition-colors"
    >
      <div className={`w-2 h-10 rounded-full ${side === 'white' ? 'bg-neutral-200' : 'bg-neutral-700'}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`font-medium ${resultColor}`}>{resultLabel}</span>
          <span className="text-neutral-500 text-sm">vs {opponent.username} ({opponent.rating})</span>
          {analyzed && <span className="text-xs px-2 py-0.5 rounded bg-[var(--color-accent)] text-white">analysée</span>}
        </div>
        <div className="text-xs text-neutral-500 mt-0.5">
          {headers.opening || headers.eco || '—'} · {game.time_class} · {date.toLocaleDateString()}
        </div>
      </div>
      <div className="text-neutral-500 text-sm">→</div>
    </button>
  )
}
