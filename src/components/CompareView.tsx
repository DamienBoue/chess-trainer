import { useMemo, useState } from 'react'
import type { ChessComGame } from '../types'
import { getRecentGames } from '../api/chesscom'
import { profileFromGames, type ProfileStats } from '../analysis/profile'

interface Props {
  username: string
  games: ChessComGame[]
}

export default function CompareView({ username, games }: Props) {
  const me = useMemo(() => profileFromGames(username, games), [username, games])

  const [friendName, setFriendName] = useState('')
  const [count, setCount] = useState(30)
  const [friendGames, setFriendGames] = useState<ChessComGame[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const friend = useMemo(
    () => (friendGames && friendName ? profileFromGames(friendName, friendGames) : null),
    [friendName, friendGames],
  )

  async function handleCompare(e: React.FormEvent) {
    e.preventDefault()
    if (!friendName.trim()) return
    setLoading(true)
    setError(null)
    try {
      const fg = await getRecentGames(friendName.trim(), count)
      if (fg.length === 0) {
        setError('Aucune partie publique trouvée pour ce pseudo.')
        setFriendGames(null)
      } else {
        setFriendGames(fg)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur réseau')
      setFriendGames(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-1">Comparer avec un autre joueur</h2>
        <p className="text-sm text-neutral-400">Statistiques tirées des parties publiques chess.com (pas d'analyse Stockfish nécessaire).</p>
      </div>

      <form onSubmit={handleCompare} className="flex gap-3 items-end flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs text-neutral-400 mb-1">Pseudo chess.com de l'ami</label>
          <input
            type="text"
            value={friendName}
            onChange={(e) => setFriendName(e.target.value)}
            placeholder="ex: hikaru"
            className="w-full px-3 py-2 bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md focus:outline-none focus:border-[var(--color-accent)]"
          />
        </div>
        <div>
          <label className="block text-xs text-neutral-400 mb-1">Parties à charger</label>
          <input
            type="number"
            min={5}
            max={100}
            value={count}
            onChange={(e) => setCount(parseInt(e.target.value, 10) || 30)}
            className="w-24 px-3 py-2 bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md focus:outline-none focus:border-[var(--color-accent)]"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !friendName.trim()}
          className="px-4 py-2 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white rounded-md disabled:opacity-50"
        >
          {loading ? 'Chargement…' : 'Comparer'}
        </button>
      </form>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <div className="grid md:grid-cols-2 gap-4">
        <ProfileCard profile={me} highlight="me" />
        {friend ? (
          <ProfileCard profile={friend} highlight="friend" />
        ) : (
          <div className="bg-[var(--color-panel)] border border-[var(--color-border)] border-dashed rounded-md p-6 text-center text-neutral-500 text-sm">
            Entre un pseudo pour afficher son profil ici.
          </div>
        )}
      </div>

      {friend && (
        <ComparisonTable me={me} friend={friend} />
      )}
    </div>
  )
}

function ProfileCard({ profile, highlight }: { profile: ProfileStats; highlight: 'me' | 'friend' }) {
  const accentClass = highlight === 'me' ? 'border-[var(--color-accent)]' : 'border-blue-500'
  return (
    <div className={`bg-[var(--color-panel)] border rounded-md p-4 ${accentClass}`}>
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="font-semibold text-lg">@{profile.username}</h3>
        <span className="text-xs text-neutral-500">{profile.games} parties</span>
      </div>
      <div className="grid grid-cols-3 gap-2 mb-3">
        <Stat label="Victoires" value={profile.wins} color="text-green-400" />
        <Stat label="Défaites" value={profile.losses} color="text-red-400" />
        <Stat label="Nulles" value={profile.draws} color="text-neutral-300" />
      </div>
      <div className="space-y-1 text-sm">
        <Row label="Win rate" value={`${(profile.winRate * 100).toFixed(0)}%`} />
        <Row label="Elo moyen" value={profile.avgRating ? profile.avgRating.toFixed(0) : '—'} />
        <Row label="Adv. moyen" value={profile.avgOppRating ? profile.avgOppRating.toFixed(0) : '—'} />
        <Row label="WR Blancs" value={`${(profile.whiteWinRate * 100).toFixed(0)}%`} />
        <Row label="WR Noirs" value={`${(profile.blackWinRate * 100).toFixed(0)}%`} />
      </div>
      <div className="mt-3">
        <div className="text-xs text-neutral-400 mb-1">Top ouvertures</div>
        <ul className="text-sm space-y-0.5">
          {profile.topOpenings.map(o => (
            <li key={o.name} className="flex justify-between">
              <span>{o.name}</span>
              <span className="text-neutral-500">{o.played}×</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function ComparisonTable({ me, friend }: { me: ProfileStats; friend: ProfileStats }) {
  const rows: Array<{ label: string; me: number; friend: number; better: 'high' | 'low'; format: (v: number) => string }> = [
    { label: 'Win rate', me: me.winRate * 100, friend: friend.winRate * 100, better: 'high', format: v => `${v.toFixed(0)}%` },
    { label: 'Elo moyen', me: me.avgRating, friend: friend.avgRating, better: 'high', format: v => v ? v.toFixed(0) : '—' },
    { label: 'Adv. moyen', me: me.avgOppRating, friend: friend.avgOppRating, better: 'high', format: v => v ? v.toFixed(0) : '—' },
    { label: 'WR Blancs', me: me.whiteWinRate * 100, friend: friend.whiteWinRate * 100, better: 'high', format: v => `${v.toFixed(0)}%` },
    { label: 'WR Noirs', me: me.blackWinRate * 100, friend: friend.blackWinRate * 100, better: 'high', format: v => `${v.toFixed(0)}%` },
  ]
  return (
    <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-4">
      <h3 className="font-semibold mb-3">Comparaison directe</h3>
      <table className="w-full text-sm">
        <thead className="text-neutral-500 text-xs">
          <tr>
            <th className="text-left font-normal py-1">Métrique</th>
            <th className="text-right font-normal py-1">@{me.username}</th>
            <th className="text-right font-normal py-1">@{friend.username}</th>
            <th className="text-right font-normal py-1">Δ</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => {
            const delta = r.me - r.friend
            const meWins = r.better === 'high' ? delta > 0 : delta < 0
            const tied = Math.abs(delta) < 0.5
            return (
              <tr key={r.label} className="border-t border-[var(--color-border)]">
                <td className="py-1">{r.label}</td>
                <td className={`text-right ${tied ? '' : meWins ? 'text-green-400 font-medium' : 'text-neutral-300'}`}>
                  {r.format(r.me)}
                </td>
                <td className={`text-right ${tied ? '' : !meWins ? 'text-green-400 font-medium' : 'text-neutral-300'}`}>
                  {r.format(r.friend)}
                </td>
                <td className="text-right text-neutral-500">{(delta > 0 ? '+' : '') + r.format(delta).replace('%', '') + (r.label.includes('rate') || r.label.startsWith('WR') ? '%' : '')}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-neutral-900 rounded p-2 text-center">
      <div className={`text-xl font-bold ${color}`}>{value}</div>
      <div className="text-[10px] text-neutral-500">{label}</div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-neutral-400">{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  )
}
