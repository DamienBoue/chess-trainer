// Lichess opening explorer for the currently-displayed position. Tries the
// community DB first; the API can be rate-limited or auth-restricted, so we
// silently hide the section when unreachable. Extracted from AnalysisView.

import { useEffect, useState } from 'react'
import { fetchExplorer, type ExplorerResponse } from '../api/lichess'

interface Props {
  fen: string
  /** SAN actually played from this position — used to highlight that row. */
  currentSan?: string
}

export default function ExplorerSection({ fen, currentSan }: Props) {
  const [data, setData] = useState<ExplorerResponse | null>(null)
  const [source, setSource] = useState<'lichess' | 'masters'>('lichess')
  const [unavailable, setUnavailable] = useState(false)

  useEffect(() => {
    let aborted = false
    const ctrl = new AbortController()
    setUnavailable(false)
    setData(null)
    fetchExplorer({
      source,
      fen,
      speeds: ['blitz', 'rapid', 'classical'],
      ratings: [1600, 1800, 2000, 2200, 2500],
      moves: 8,
    }, ctrl.signal).then(r => {
      if (aborted) return
      if (!r) { setUnavailable(true); return }
      setData(r)
    })
    return () => { aborted = true; ctrl.abort() }
  }, [fen, source])

  if (unavailable && !data) return null     // hide gracefully
  if (!data) {
    return (
      <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-4 text-sm text-neutral-500">
        Chargement de l'explorateur d'ouvertures…
      </div>
    )
  }
  const total = data.white + data.draws + data.black
  return (
    <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-4">
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <h3 className="font-semibold">Explorateur d'ouvertures</h3>
        <div className="inline-flex rounded-md border border-[var(--color-border)] bg-neutral-900 p-0.5 text-xs">
          <button
            onClick={() => setSource('lichess')}
            className={`px-2 py-1 rounded ${source === 'lichess' ? 'bg-[var(--color-accent)] text-white' : 'text-neutral-300 hover:bg-neutral-800'}`}
          >Community</button>
          <button
            onClick={() => setSource('masters')}
            className={`px-2 py-1 rounded ${source === 'masters' ? 'bg-[var(--color-accent)] text-white' : 'text-neutral-300 hover:bg-neutral-800'}`}
          >Masters</button>
        </div>
      </div>
      {data.opening?.name && (
        <p className="text-xs text-neutral-400 mb-2">{data.opening.eco} · {data.opening.name}</p>
      )}
      <div className="text-xs text-neutral-500 mb-2">{total.toLocaleString()} parties à cette position</div>
      {data.moves.length === 0 ? (
        <p className="text-sm text-neutral-500">Position hors livre — plus de coups répertoriés.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-neutral-500 text-xs">
            <tr>
              <th className="text-left font-normal pb-1">Coup</th>
              <th className="text-right font-normal">Parties</th>
              <th className="text-right font-normal">B / N / =</th>
            </tr>
          </thead>
          <tbody>
            {data.moves.slice(0, 6).map(m => {
              const moveTotal = m.white + m.draws + m.black
              const freq = total > 0 ? moveTotal / total : 0
              const w = moveTotal > 0 ? m.white / moveTotal : 0
              const d = moveTotal > 0 ? m.draws / moveTotal : 0
              const l = moveTotal > 0 ? m.black / moveTotal : 0
              const matchesPlayed = currentSan && currentSan.replace(/[!?+#]+$/, '') === m.san.replace(/[!?+#]+$/, '')
              return (
                <tr key={m.uci} className={`border-t border-[var(--color-border)]/40 ${matchesPlayed ? 'bg-[var(--color-accent)]/10' : ''}`}>
                  <td className="py-1 font-mono">
                    {m.san}
                    {matchesPlayed && <span className="ml-2 text-xs text-[var(--color-accent)]">← joué</span>}
                    <span className="text-neutral-600 ml-2 text-xs">{(freq * 100).toFixed(0)}%</span>
                  </td>
                  <td className="py-1 text-right text-neutral-400 font-mono text-xs">{moveTotal.toLocaleString()}</td>
                  <td className="py-1 text-right text-xs">
                    <span className="text-neutral-100">{(w * 100).toFixed(0)}</span>
                    <span className="text-neutral-500"> / </span>
                    <span className="text-neutral-100">{(l * 100).toFixed(0)}</span>
                    <span className="text-neutral-500"> / </span>
                    <span className="text-neutral-500">{(d * 100).toFixed(0)}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
