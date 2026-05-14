// Opening Lab: side-by-side comparison of "what I play" vs "what masters
// play" for one of the user's habitual openings.
//
// For each ply of the user's most-played line:
//   - Show the user's move + win record at this position
//   - Fetch Lichess Masters explorer for the same position
//   - Show masters' top 5 moves with frequencies and white/draws/black %
//   - Flag when the user's move is NOT in masters' top 3 (likely book deviation)

import { useEffect, useMemo, useState } from 'react'
import type { GameAnalysis } from '../types'
import { buildRepertoire, type RepertoireRoot } from '../analysis/repertoire'
import { mostPlayedLine, type OpeningLineStep } from '../analysis/openingLine'
import { fetchExplorer, type ExplorerMove, type ExplorerResponse } from '../api/lichess'
import PositionExplorer from './PositionExplorer'

interface Props {
  analyses: GameAnalysis[]
  /** Optional pre-selection (parent opening + color). When unset, the user
   *  picks one from the list. */
  initialKey?: { parent: string; color: 'white' | 'black' }
  onBack?: () => void
}

export default function OpeningLabView({ analyses, initialKey, onBack }: Props) {
  const roots = useMemo(() => buildRepertoire(analyses), [analyses])
  const [selected, setSelected] = useState<RepertoireRoot | null>(() => {
    if (!initialKey) return roots[0] ?? null
    return roots.find(r => r.parent === initialKey.parent && r.color === initialKey.color) ?? null
  })

  if (roots.length === 0) {
    return (
      <div className="p-6 max-w-3xl mx-auto text-sm text-neutral-400">
        Pas encore de répertoire à explorer — analyse quelques parties d'abord.
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto space-y-4">
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-2xl font-semibold">Lab d'ouverture</h2>
          <p className="text-sm text-neutral-400">
            Ce que tu joues vs ce que les maîtres jouent. Repère les déviations théoriques.
          </p>
        </div>
        {onBack && (
          <button onClick={onBack} className="text-xs text-neutral-400 hover:text-white underline">
            ← Retour
          </button>
        )}
      </div>

      <div className="flex gap-2 flex-wrap">
        {roots.map(r => {
          const key = `${r.parent}-${r.color}`
          const active = selected && selected.parent === r.parent && selected.color === r.color
          return (
            <button
              key={key}
              onClick={() => setSelected(r)}
              className={`text-xs px-3 py-1.5 rounded-md transition-colors ${
                active
                  ? 'bg-[var(--color-accent)] text-white'
                  : 'bg-neutral-900 text-neutral-300 hover:bg-neutral-800 border border-[var(--color-border)]'
              }`}
            >
              {r.parent} <span className="opacity-60">· {r.color === 'white' ? '♙' : '♟'} {r.total}</span>
            </button>
          )
        })}
      </div>

      {selected && <LabBody root={selected} />}
    </div>
  )
}

function LabBody({ root }: { root: RepertoireRoot }) {
  const line = useMemo(() => mostPlayedLine(root, { maxPlies: 8 }), [root])
  const [explore, setExplore] = useState<{ fen: string; played?: string; best?: string } | null>(null)

  if (line.length === 0) {
    return <p className="text-sm text-neutral-500">Pas assez de données pour reconstruire une ligne — peu de plies enregistrés.</p>
  }

  return (
    <div className="space-y-3">
      <div className="bg-neutral-900 border border-[var(--color-border)] rounded p-3 text-sm">
        <div className="text-xs uppercase tracking-wider text-neutral-500 mb-1">Ta ligne la plus jouée</div>
        <div className="font-mono text-neutral-200 break-words">
          {line.map((s, i) => (
            <span key={i}>
              {i > 0 && ' '}
              {s.oppPrev !== '<start>' && <span className="text-neutral-400">{s.oppPrev} </span>}
              <span className="text-white">{s.userSan}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {line.map((step, i) => (
          <PlyComparison
            key={i}
            step={step}
            plyNumber={i + 1}
            onExplore={(opts) => setExplore({ fen: step.fenBefore, ...opts })}
          />
        ))}
      </div>

      {explore && (
        <PositionExplorer
          fen={explore.fen}
          playedSan={explore.played}
          bestSan={explore.best}
          onClose={() => setExplore(null)}
          title={explore.best ? `Drill : ${explore.best}` : 'Explorer la position'}
        />
      )}
    </div>
  )
}

function PlyComparison({
  step, plyNumber, onExplore,
}: {
  step: OpeningLineStep
  plyNumber: number
  onExplore: (opts: { played?: string; best?: string }) => void
}) {
  const [masters, setMasters] = useState<ExplorerResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(false)

  useEffect(() => {
    let aborted = false
    const ctrl = new AbortController()
    setLoading(true); setErr(false)
    fetchExplorer({ source: 'masters', fen: step.fenBefore, moves: 6 }, ctrl.signal).then(r => {
      if (aborted) return
      if (!r) setErr(true)
      else setMasters(r)
      setLoading(false)
    })
    return () => { aborted = true; ctrl.abort() }
  }, [step.fenBefore])

  const userMoveInMasters = masters?.moves.find(m => m.san === step.userSan)
  const isBookDeviation = !!masters && masters.moves.length > 0
    && !masters.moves.slice(0, 3).some(m => m.san === step.userSan)

  return (
    <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-3">
      <div className="flex items-baseline justify-between mb-2 flex-wrap gap-2">
        <div className="flex items-baseline gap-2">
          <span className="text-xs text-neutral-500">Ply {plyNumber}</span>
          {step.oppPrev !== '<start>' && (
            <span className="text-sm text-neutral-400 font-mono">{step.oppPrev}</span>
          )}
        </div>
        <div className="flex gap-1.5">
          {isBookDeviation && masters?.moves[0] && (
            <button
              onClick={() => onExplore({ played: step.userSan, best: masters.moves[0].san })}
              className="text-xs px-2 py-0.5 rounded bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 border border-purple-500/30"
              title={`Drill : trouve le coup des maîtres (${masters.moves[0].san})`}
            >🎯 Drill</button>
          )}
          <button
            onClick={() => onExplore({})}
            className="text-xs px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300"
          >Ouvrir l'échiquier →</button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        {/* User side */}
        <div className="bg-neutral-900 rounded p-2.5">
          <div className="text-[11px] uppercase tracking-wider text-neutral-500 mb-1">Toi</div>
          <div className="flex items-baseline gap-2 mb-1.5 flex-wrap">
            <span className={`font-mono text-lg ${isBookDeviation ? 'text-amber-300' : 'text-neutral-100'}`}>
              {step.userSan}
            </span>
            <span className="text-xs text-neutral-500">
              {step.count}/{step.totalAtNode} fois ({Math.round(100 * step.count / Math.max(1, step.totalAtNode))}%)
            </span>
          </div>
          <div className="text-[11px] text-neutral-500">
            Score : {step.wins}V / {step.losses}D / {step.draws}N
            {step.avgCpLoss > 0 && ` · ${step.avgCpLoss.toFixed(0)} cp/coup`}
          </div>
          {isBookDeviation && (
            <div className="mt-1.5 text-[11px] text-amber-200/80">
              ⚠ Coup hors du top-3 masters — déviation théorique possible.
            </div>
          )}
        </div>

        {/* Masters side */}
        <div className="bg-neutral-900 rounded p-2.5">
          <div className="text-[11px] uppercase tracking-wider text-neutral-500 mb-1">Masters DB</div>
          {loading && <p className="text-xs text-neutral-500">Chargement…</p>}
          {err && (
            <p className="text-xs text-neutral-500">
              API indisponible. Lichess Explorer demande désormais un token —
              colle-le dans <span className="text-neutral-300">Préférences → Token Lichess</span>.
            </p>
          )}
          {masters && masters.moves.length === 0 && (
            <p className="text-xs text-neutral-500">Hors base — position rare en masters.</p>
          )}
          {masters && masters.moves.length > 0 && (
            <ul className="space-y-1">
              {masters.moves.slice(0, 5).map(m => (
                <MasterRow key={m.uci} m={m} highlight={m.san === step.userSan} />
              ))}
            </ul>
          )}
          {userMoveInMasters && (
            <p className="mt-1.5 text-[10px] text-neutral-500">
              Ton coup en masters : ${' '}
              <span className="font-mono">{Math.round(100 * totalGames(userMoveInMasters) / totalGames(masters!))}%</span>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function MasterRow({ m, highlight }: { m: ExplorerMove; highlight: boolean }) {
  const total = totalGames(m)
  const wPct = Math.round((m.white / total) * 100)
  const dPct = Math.round((m.draws / total) * 100)
  const bPct = 100 - wPct - dPct
  return (
    <li className={`text-xs flex items-center gap-2 ${highlight ? 'text-amber-200' : 'text-neutral-300'}`}>
      <span className="font-mono w-14">{m.san}</span>
      <span className="text-neutral-500 w-12 text-right">{total}</span>
      <div className="flex-1 flex h-1.5 rounded overflow-hidden bg-neutral-800 min-w-[60px]">
        <div className="bg-green-500" style={{ width: `${wPct}%` }} />
        <div className="bg-neutral-500" style={{ width: `${dPct}%` }} />
        <div className="bg-red-500" style={{ width: `${bPct}%` }} />
      </div>
      {m.averageRating && (
        <span className="text-[10px] text-neutral-600 w-10 text-right">{m.averageRating}</span>
      )}
    </li>
  )
}

function totalGames(m: ExplorerMove | ExplorerResponse): number {
  return m.white + m.draws + m.black
}
