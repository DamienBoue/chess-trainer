import type { ChessComGame, GameAnalysis } from '../types'
import { getResultForUser, getUserSide, parsePgnHeaders } from '../analysis/pgn'
import type { BatchState } from '../App'

interface Props {
  username: string
  games: ChessComGame[]
  analyses: Record<string, GameAnalysis>
  onSelectGame: (game: ChessComGame) => void
  batch: BatchState | null
  onStartBatch: () => void
  onCancelBatch: () => void
}

export default function GamesList({
  username, games, analyses,
  onSelectGame, batch, onStartBatch, onCancelBatch,
}: Props) {
  if (games.length === 0) {
    return <div className="p-8 text-neutral-400">Aucune partie chargée.</div>
  }
  const analyzedCount = Object.keys(analyses).length
  const remaining = games.filter(g => !analyses[g.url]).length
  const isBatchRunning = batch !== null

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-4 flex items-baseline justify-between flex-wrap gap-3">
        <h2 className="text-xl font-semibold">{games.length} parties récentes</h2>
        <span className="text-xs text-neutral-500">{analyzedCount} analysée(s)</span>
      </div>

      {!isBatchRunning && remaining > 0 && (
        <div className="mb-4 flex items-center justify-between gap-3 bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-3">
          <span className="text-sm text-neutral-300">
            {remaining} partie{remaining > 1 ? 's' : ''} non-analysée{remaining > 1 ? 's' : ''}.
            <span className="text-xs text-neutral-500 ml-2">~30-60s par partie</span>
          </span>
          <button
            onClick={onStartBatch}
            className="px-3 py-1.5 text-sm bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white rounded font-medium"
          >
            Tout analyser ({remaining})
          </button>
        </div>
      )}

      {isBatchRunning && batch && (
        <BatchBanner batch={batch} games={games} onCancel={onCancelBatch} />
      )}

      <div className="space-y-1">
        {games.map((g) => (
          <GameRow
            key={g.url}
            game={g}
            username={username}
            analyzed={!!analyses[g.url]}
            current={batch?.currentGameUrl === g.url}
            disabled={isBatchRunning && !analyses[g.url]}
            onClick={() => onSelectGame(g)}
          />
        ))}
      </div>
    </div>
  )
}

function BatchBanner({
  batch, games, onCancel,
}: {
  batch: BatchState
  games: ChessComGame[]
  onCancel: () => void
}) {
  const overallPct = batch.total > 0 ? (batch.done / batch.total) * 100 : 0
  const movePct = batch.currentMove && batch.currentMove.total > 0
    ? (batch.currentMove.done / batch.currentMove.total) * 100
    : 0
  const currentGame = batch.currentGameUrl ? games.find(g => g.url === batch.currentGameUrl) : null
  const opponentName = currentGame ? extractOpponent(currentGame, batch.currentGameUrl) : ''

  return (
    <div className="mb-4 bg-[var(--color-panel)] border border-[var(--color-accent)] rounded-md p-4">
      <div className="flex items-center justify-between mb-2 gap-3">
        <span className="text-sm font-medium">
          Analyse en lot · partie {batch.done + 1} / {batch.total}
          {batch.failed > 0 && (
            <span className="ml-2 text-xs text-red-400">({batch.failed} échec{batch.failed > 1 ? 's' : ''})</span>
          )}
        </span>
        <button
          onClick={onCancel}
          className="px-3 py-1 text-xs bg-neutral-800 hover:bg-neutral-700 rounded"
        >
          Arrêter
        </button>
      </div>
      <div className="space-y-2">
        <ProgressBar pct={overallPct} label={`Global ${Math.floor(overallPct)}%`} />
        {batch.currentMove && (
          <ProgressBar
            pct={movePct}
            label={`Partie en cours${opponentName ? ` (vs ${opponentName})` : ''} : coup ${batch.currentMove.done}/${batch.currentMove.total}${batch.currentMove.currentSan ? ` · ${batch.currentMove.currentSan}` : ''}`}
            small
          />
        )}
      </div>
      <p className="text-xs text-neutral-500 mt-2">
        L'analyse continue même si tu changes d'onglet. Tu peux arrêter à tout moment, les parties déjà analysées sont conservées.
      </p>
    </div>
  )
}

function ProgressBar({ pct, label, small }: { pct: number; label: string; small?: boolean }) {
  return (
    <div>
      <div className={`flex justify-between ${small ? 'text-[10px]' : 'text-xs'} text-neutral-400 mb-1`}>
        <span>{label}</span>
      </div>
      <div className={`w-full bg-neutral-900 rounded-full ${small ? 'h-1' : 'h-2'} overflow-hidden`}>
        <div
          className="h-full bg-[var(--color-accent)] transition-all duration-200"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function extractOpponent(game: ChessComGame, _url: string | null): string {
  // Without knowing user color here, just return both
  return `${game.white.username} vs ${game.black.username}`
}

function GameRow({
  game,
  username,
  analyzed,
  current,
  disabled,
  onClick,
}: {
  game: ChessComGame
  username: string
  analyzed: boolean
  current: boolean
  disabled: boolean
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
      disabled={disabled}
      className={`w-full text-left border rounded-md p-3 flex items-center gap-4 transition-colors ${
        current
          ? 'bg-[var(--color-accent)]/10 border-[var(--color-accent)]'
          : disabled
            ? 'bg-[var(--color-panel)] border-[var(--color-border)] opacity-50 cursor-not-allowed'
            : 'bg-[var(--color-panel)] hover:bg-neutral-800 border-[var(--color-border)]'
      }`}
    >
      <div className={`w-2 h-10 rounded-full ${side === 'white' ? 'bg-neutral-200' : 'bg-neutral-700'}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`font-medium ${resultColor}`}>{resultLabel}</span>
          <span className="text-neutral-500 text-sm">vs {opponent.username} ({opponent.rating})</span>
          {current && <span className="text-xs px-2 py-0.5 rounded bg-[var(--color-accent)] text-white">en cours…</span>}
          {analyzed && !current && <span className="text-xs px-2 py-0.5 rounded bg-[var(--color-accent)] text-white">analysée</span>}
        </div>
        <div className="text-xs text-neutral-500 mt-0.5">
          {headers.opening || headers.eco || '—'} · {game.time_class} · {date.toLocaleDateString()}
        </div>
      </div>
      <div className="text-neutral-500 text-sm">→</div>
    </button>
  )
}
