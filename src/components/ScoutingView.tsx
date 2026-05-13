import { useEffect, useState } from 'react'
import { Chess } from 'chess.js'
import TrainingBoard from './TrainingBoard'
import type { ChessComGame } from '../types'
import { getRecentGames } from '../api/chesscom'
import { scoutingProfile, type ScoutingProfile, type OpeningStat, type ColorSplit } from '../analysis/scouting'
import { fetchExplorer, type ExplorerResponse, type ExplorerMove } from '../api/lichess'

export default function ScoutingView() {
  const [name, setName] = useState('')
  const [count, setCount] = useState(50)
  const [games, setGames] = useState<ChessComGame[] | null>(null)
  const [profile, setProfile] = useState<ScoutingProfile | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    setLoading(true)
    setError(null)
    setProfile(null)
    setGames(null)
    try {
      const fetched = await getRecentGames(trimmed, count)
      if (fetched.length === 0) {
        setError("Aucune partie publique trouvée pour ce pseudo.")
        return
      }
      setGames(fetched)
      setProfile(scoutingProfile(trimmed, fetched))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur réseau')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-1">Scouting d'adversaire</h2>
        <p className="text-sm text-neutral-400">
          Saisi un pseudo chess.com pour récupérer ses parties récentes (publiques) et obtenir un profil d'ouvertures,
          répartition de cadence, forme récente, points forts et points faibles.
        </p>
      </div>

      <form onSubmit={onSubmit} className="flex gap-3 items-end flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs text-neutral-400 mb-1">Pseudo chess.com</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="ex: hikaru"
            className="w-full px-3 py-2 bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md focus:outline-none focus:border-[var(--color-accent)]"
          />
        </div>
        <div className="w-28">
          <label className="block text-xs text-neutral-400 mb-1">N parties</label>
          <input
            type="number"
            min={10}
            max={200}
            value={count}
            onChange={e => setCount(Math.max(10, Math.min(200, parseInt(e.target.value || '50', 10))))}
            className="w-full px-3 py-2 bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md focus:outline-none focus:border-[var(--color-accent)]"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !name.trim()}
          className="px-4 py-2 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white rounded-md disabled:opacity-50 font-medium"
        >
          {loading ? 'Récupération…' : 'Scouter'}
        </button>
      </form>

      {error && (
        <div className="bg-red-900/30 border border-red-700/50 rounded p-3 text-sm text-red-300">{error}</div>
      )}

      {profile && games && <ProfileCard profile={profile} games={games} />}
      {profile && <LichessExplorerPanel username={profile.username} />}
    </div>
  )
}

// ---- Lichess opening explorer panel ----------------------------------------
// Shows the opening tree this player has actually played on Lichess.
// Walks the user from the start position down the tree as they pick moves.

interface ExplorerNode {
  fen: string
  history: Array<{ san: string; mover: 'w' | 'b' }>
}

function LichessExplorerPanel({ username }: { username: string }) {
  const [color, setColor] = useState<'white' | 'black'>('white')
  const [node, setNode] = useState<ExplorerNode>(() => ({
    fen: new Chess().fen(),
    history: [],
  }))
  const [data, setData] = useState<ExplorerResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset traversal when color or player changes.
  useEffect(() => {
    setNode({ fen: new Chess().fen(), history: [] })
  }, [color, username])

  useEffect(() => {
    let aborted = false
    const ctrl = new AbortController()
    setLoading(true)
    setError(null)
    fetchExplorer({
      source: 'player',
      player: username,
      color,
      fen: node.fen,
      speeds: ['blitz', 'rapid', 'classical'],
      moves: 10,
    }, ctrl.signal).then(r => {
      if (aborted) return
      if (!r) setError('Lichess injoignable (pseudo absent ou compte privé ?)')
      setData(r)
      setLoading(false)
    })
    return () => { aborted = true; ctrl.abort() }
  }, [username, color, node.fen])

  function pushMove(san: string) {
    const board = new Chess(node.fen)
    const mv = board.move(san)
    if (!mv) return
    setNode({
      fen: board.fen(),
      history: [...node.history, { san: mv.san, mover: mv.color === 'w' ? 'w' : 'b' }],
    })
  }

  function popMove() {
    if (node.history.length === 0) return
    const board = new Chess()
    const newHist = node.history.slice(0, -1)
    for (const h of newHist) board.move(h.san)
    setNode({ fen: board.fen(), history: newHist })
  }

  function reset() {
    setNode({ fen: new Chess().fen(), history: [] })
  }

  const totalGames = data ? data.white + data.draws + data.black : 0
  const playerScore = data && totalGames > 0
    ? (color === 'white'
        ? (data.white + 0.5 * data.draws) / totalGames
        : (data.black + 0.5 * data.draws) / totalGames)
    : 0

  return (
    <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-4 space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <h3 className="font-semibold text-sm">
          🎯 Explorateur Lichess
          <span className="text-xs text-neutral-500 ml-2">(parties effectives de @{username})</span>
        </h3>
        <div className="ml-auto inline-flex rounded-md border border-[var(--color-border)] bg-neutral-900 p-0.5 text-xs">
          <button
            onClick={() => setColor('white')}
            className={`px-2 py-1 rounded ${color === 'white' ? 'bg-[var(--color-accent)] text-white' : 'text-neutral-300 hover:bg-neutral-800'}`}
          >Quand il joue Blancs</button>
          <button
            onClick={() => setColor('black')}
            className={`px-2 py-1 rounded ${color === 'black' ? 'bg-[var(--color-accent)] text-white' : 'text-neutral-300 hover:bg-neutral-800'}`}
          >Quand il joue Noirs</button>
        </div>
      </div>

      <p className="text-xs text-neutral-500">
        Si @{username} a un compte Lichess avec le même pseudo, ses parties publiques y sont indexées.
        Clique une réponse pour explorer la suite de son répertoire.
      </p>

      <div className="grid md:grid-cols-[260px_1fr] gap-4">
        <div>
          <TrainingBoard
            position={node.fen}
            orientation={color}
            allowDragging={false}
            id="scout-explorer"
            maxWidth={260}
          />
          <div className="mt-2 text-xs text-neutral-500 break-words">
            {node.history.length > 0 ? (
              <>
                <span className="text-neutral-300">{formatLine(node.history)}</span>
                <div className="mt-1 flex gap-2">
                  <button onClick={popMove} className="px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700">← Annuler</button>
                  <button onClick={reset} className="px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700">Position initiale</button>
                </div>
              </>
            ) : (
              <>Position initiale.</>
            )}
          </div>
        </div>

        <div>
          {loading && <p className="text-sm text-neutral-500">Chargement…</p>}
          {error && <p className="text-sm text-orange-300">{error}</p>}
          {data && !loading && !error && (
            <>
              <div className="text-xs text-neutral-400 mb-2">
                {totalGames} parties · score de @{username} : {(playerScore * 100).toFixed(0)}%
                {data.opening?.name && <> · <span className="text-neutral-300">{data.opening.name}</span></>}
              </div>
              {data.moves.length === 0 ? (
                <p className="text-sm text-neutral-500">Aucun coup recensé depuis cette position.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="text-neutral-500 text-xs">
                    <tr>
                      <th className="text-left font-normal pb-1">Coup</th>
                      <th className="text-right font-normal">Parties</th>
                      <th className="text-right font-normal">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.moves.slice(0, 8).map(m => (
                      <MoveRow
                        key={m.uci}
                        move={m}
                        playerColor={color}
                        totalForPosition={totalGames}
                        onClick={() => pushMove(m.san)}
                      />
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function formatLine(history: Array<{ san: string; mover: 'w' | 'b' }>): string {
  let out = ''
  for (let i = 0; i < history.length; i++) {
    if (i % 2 === 0) out += `${Math.floor(i / 2) + 1}.`
    out += ` ${history[i].san}`
  }
  return out.trim()
}

function MoveRow({
  move, playerColor, totalForPosition, onClick,
}: {
  move: ExplorerMove
  playerColor: 'white' | 'black'
  totalForPosition: number
  onClick: () => void
}) {
  const total = move.white + move.draws + move.black
  const freq = totalForPosition > 0 ? total / totalForPosition : 0
  const playerScore = total > 0
    ? (playerColor === 'white'
        ? (move.white + 0.5 * move.draws) / total
        : (move.black + 0.5 * move.draws) / total)
    : 0
  const scoreColor = playerScore >= 0.6 ? 'text-green-400'
    : playerScore >= 0.4 ? 'text-neutral-300' : 'text-red-400'
  return (
    <tr className="border-t border-[var(--color-border)]/40 hover:bg-neutral-900/50">
      <td className="py-1.5">
        <button onClick={onClick} className="text-left font-mono text-neutral-200 hover:text-white">
          {move.san}
          <span className="text-neutral-600 ml-2 text-xs">{(freq * 100).toFixed(0)}%</span>
        </button>
      </td>
      <td className="py-1.5 text-right text-neutral-400 font-mono text-xs">{total}</td>
      <td className={`py-1.5 text-right font-mono text-xs ${scoreColor}`}>
        {(playerScore * 100).toFixed(0)}%
      </td>
    </tr>
  )
}

function ProfileCard({ profile, games }: { profile: ScoutingProfile; games: ChessComGame[] }) {
  const totalWins = profile.whiteSide.wins + profile.blackSide.wins
  const totalLosses = profile.whiteSide.losses + profile.blackSide.losses
  const totalDraws = profile.whiteSide.draws + profile.blackSide.draws
  const overall = profile.games > 0 ? (totalWins + 0.5 * totalDraws) / profile.games : 0
  const avgOppRating = (() => {
    const list = games
      .map(g => {
        const isWhite = g.white.username.toLowerCase() === profile.username.toLowerCase()
        return isWhite ? g.black.rating : g.white.rating
      })
      .filter(r => r > 0)
    return list.length > 0 ? Math.round(list.reduce((a, b) => a + b, 0) / list.length) : 0
  })()

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Parties scannées" value={profile.games} />
        <Stat label="Score global" value={`${(overall * 100).toFixed(0)}%`} />
        <Stat label="Bilan" value={`${totalWins}V / ${totalLosses}D / ${totalDraws}N`} />
        <Stat label="Adv. rating moy." value={avgOppRating || '—'} />
      </div>

      <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-4">
        <h3 className="font-semibold mb-3 text-sm">Forme récente <span className="text-neutral-500 text-xs">(plus récent à gauche)</span></h3>
        <div className="flex gap-1 flex-wrap">
          {profile.recentForm.map((r, i) => (
            <span
              key={i}
              className={`px-2 py-1 rounded text-xs font-mono font-bold ${
                r === 'W' ? 'bg-green-900/50 text-green-300' :
                r === 'L' ? 'bg-red-900/50 text-red-300' :
                'bg-neutral-800 text-neutral-300'
              }`}
            >{r}</span>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <ColorPanel title="Avec les Blancs" split={profile.whiteSide} />
        <ColorPanel title="Avec les Noirs" split={profile.blackSide} />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-4">
          <h3 className="font-semibold mb-2 text-sm">⚠️ Ouvertures faibles <span className="text-xs text-neutral-500">(≥3 parties)</span></h3>
          <OpeningTable openings={profile.worstOpenings} highlightLow />
        </div>
        <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-4">
          <h3 className="font-semibold mb-2 text-sm">💪 Ouvertures fortes <span className="text-xs text-neutral-500">(≥3 parties)</span></h3>
          <OpeningTable openings={profile.bestOpenings} />
        </div>
      </div>

      <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-4">
        <h3 className="font-semibold mb-2 text-sm">Cadences jouées</h3>
        <div className="space-y-2">
          {profile.timeClassBreakdown.map(({ tc, games: n, winRate }) => (
            <div key={tc} className="flex items-center gap-3 text-sm">
              <span className="w-24 text-neutral-400 capitalize">{tc}</span>
              <span className="font-mono text-neutral-300 w-10">{n}</span>
              <div className="flex-1 h-1.5 bg-neutral-900 rounded overflow-hidden">
                <div
                  className="h-full bg-green-500"
                  style={{ width: `${winRate * 100}%` }}
                />
              </div>
              <span className="font-mono text-neutral-400 w-12 text-right">{(winRate * 100).toFixed(0)}%</span>
            </div>
          ))}
        </div>
      </div>

      <div className="text-xs text-neutral-500">
        Astuce préparation : prépare une réponse contre ses ouvertures principales (à gauche), et anticipe qu'il
        évitera celles où il a un mauvais score. Ses ouvertures faibles sont des angles d'attaque pour toi.
      </div>
    </div>
  )
}

function ColorPanel({ title, split }: { title: string; split: ColorSplit }) {
  return (
    <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-4">
      <h3 className="font-semibold mb-2 text-sm">{title}</h3>
      <div className="text-xs text-neutral-400 mb-3">
        {split.games} parties · {split.wins}V/{split.losses}D/{split.draws}N · {(split.winRate * 100).toFixed(0)}%
      </div>
      <OpeningTable openings={split.openings.slice(0, 6)} />
    </div>
  )
}

function OpeningTable({ openings, highlightLow }: { openings: OpeningStat[]; highlightLow?: boolean }) {
  if (openings.length === 0) {
    return <p className="text-xs text-neutral-500">Pas assez de données.</p>
  }
  return (
    <table className="w-full text-sm">
      <thead className="text-neutral-500 text-xs">
        <tr><th className="text-left font-normal pb-1">Ouverture</th><th className="text-right font-normal">N</th><th className="text-right font-normal">%</th></tr>
      </thead>
      <tbody>
        {openings.map(o => {
          const pct = o.winRate * 100
          const color = highlightLow
            ? (pct < 30 ? 'text-red-400' : pct < 50 ? 'text-orange-300' : 'text-neutral-300')
            : (pct >= 60 ? 'text-green-400' : pct >= 40 ? 'text-neutral-300' : 'text-red-400')
          return (
            <tr key={o.name} className="border-t border-[var(--color-border)]/40">
              <td className="py-1 truncate">{o.name}</td>
              <td className="py-1 text-right text-neutral-400 font-mono text-xs">{o.played}</td>
              <td className={`py-1 text-right font-mono text-xs ${color}`}>{pct.toFixed(0)}%</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-3 text-center">
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-neutral-500">{label}</div>
    </div>
  )
}
