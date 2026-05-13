import { useState } from 'react'
import type { ChessComGame } from '../types'
import { getRecentGames } from '../api/chesscom'
import { scoutingProfile, type ScoutingProfile, type OpeningStat, type ColorSplit } from '../analysis/scouting'

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
    </div>
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
