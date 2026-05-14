// Variation Explorer: walk any position with on-the-fly Stockfish
// multi-PV candidates. Click a candidate move to play it on the board
// and re-query. Extracted from RepertoireView.

import { useEffect, useMemo, useState } from 'react'
import { Chess } from 'chess.js'
import TrainingBoard from './TrainingBoard'
import type { RepertoireRoot } from '../analysis/repertoire'
import { evaluateMultiPV, type EvalLine } from '../engine/multipv'

interface Props {
  roots: RepertoireRoot[]
}

interface ExplorerCandidate {
  san: string
  uci: string
  scoreCp: number      // from side-to-move POV
  isMate: boolean
  pvSan: string        // first ~5 plies of the PV in SAN
}

export default function ExplorerPanel({ roots }: Props) {
  // Default starts: one button per root + a "From scratch" button.
  const startOptions = useMemo(() => {
    const list: { label: string; fen: string; orientation: 'white' | 'black' }[] = [
      { label: 'Position de départ (Blancs)', fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', orientation: 'white' },
      { label: 'Position de départ (Noirs)', fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', orientation: 'black' },
    ]
    for (const r of roots.slice(0, 6)) {
      const arr = Array.from(r.children.values())
      const top = arr.reduce<typeof arr[number] | null>(
        (a, b) => (!a || b.count > a.count ? b : a), null,
      )
      if (top?.fenBeforeSamples[0]) {
        list.push({
          label: `${r.parent} (${r.color === 'white' ? 'B' : 'N'})`,
          fen: top.fenBeforeSamples[0],
          orientation: r.color,
        })
      }
    }
    return list
  }, [roots])

  const [history, setHistory] = useState<{ fen: string; san?: string }[]>(
    [{ fen: startOptions[0].fen }],
  )
  const [orientation, setOrientation] = useState<'white' | 'black'>(startOptions[0].orientation)
  const [candidates, setCandidates] = useState<ExplorerCandidate[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [n, setN] = useState(4)
  const currentFen = history[history.length - 1].fen

  // Fetch top-N candidates whenever the current position changes.
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setCandidates(null)
    evaluateMultiPV(currentFen, n, 12, 600)
      .then(lines => {
        if (cancelled) return
        setCandidates(lines.map(l => toCandidate(l, currentFen)).filter((c): c is ExplorerCandidate => !!c))
        setLoading(false)
      })
      .catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [currentFen, n])

  function reset(fen: string, orient: 'white' | 'black') {
    setHistory([{ fen }])
    setOrientation(orient)
  }

  function playUci(uci: string) {
    const c = new Chess(currentFen)
    let mv
    try {
      mv = c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci.length > 4 ? uci.slice(4, 5) : undefined })
    } catch { return }
    if (!mv) return
    setHistory(h => [...h, { fen: c.fen(), san: mv.san }])
  }

  function back() {
    setHistory(h => h.length > 1 ? h.slice(0, -1) : h)
  }

  function manualMove(from: string, to: string): boolean {
    const c = new Chess(currentFen)
    let mv
    try { mv = c.move({ from, to, promotion: 'q' }) } catch { return false }
    if (!mv) return false
    setHistory(h => [...h, { fen: c.fen(), san: mv.san }])
    return true
  }

  return (
    <div className="space-y-4">
      <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-3">
        <p className="text-sm text-neutral-300 mb-2">
          Explore n'importe quelle position : Stockfish te propose ses {n} meilleurs coups avec leurs évals. Clique pour les jouer et continuer la variation. Idéal pour étudier les options théoriques après un coup spécifique de l'adversaire.
        </p>
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-neutral-500 mr-1">Démarrer depuis :</span>
          {startOptions.map((o, i) => (
            <button
              key={i}
              onClick={() => reset(o.fen, o.orientation)}
              className="px-2 py-1 text-xs rounded border border-[var(--color-border)] hover:bg-neutral-800"
            >
              {o.label}
            </button>
          ))}
          <span className="text-xs text-neutral-500 ml-3">Candidats :</span>
          <select
            value={n}
            onChange={e => setN(parseInt(e.target.value, 10))}
            className="bg-neutral-900 border border-[var(--color-border)] rounded px-2 py-1 text-xs"
          >
            <option value={2}>2</option>
            <option value={3}>3</option>
            <option value={4}>4</option>
            <option value={5}>5</option>
          </select>
        </div>
      </div>

      <div className="grid lg:grid-cols-[auto_1fr] gap-4">
        <div className="mx-auto w-full max-w-[440px]">
          <TrainingBoard
            position={currentFen}
            orientation={orientation}
            allowDragging={true}
            maxWidth={440}
            onPieceDrop={({ sourceSquare, targetSquare }) => {
              if (!targetSquare) return false
              return manualMove(sourceSquare, targetSquare)
            }}
          />
          <div className="flex items-center gap-2 mt-2 text-xs">
            <button onClick={back} disabled={history.length <= 1} className="px-2 py-1 bg-neutral-800 rounded disabled:opacity-30">← Retour</button>
            <button onClick={() => setOrientation(o => o === 'white' ? 'black' : 'white')} className="px-2 py-1 bg-neutral-800 rounded">⇅ Flip</button>
            <span className="text-neutral-500 ml-auto">
              {history.length > 1 ? `${history.length - 1} coup${history.length - 1 > 1 ? 's' : ''} joué${history.length - 1 > 1 ? 's' : ''}` : 'Position initiale'}
            </span>
          </div>
        </div>

        <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-3">
          <h4 className="font-semibold text-sm mb-2">Top {n} coups selon Stockfish</h4>
          {loading && !candidates && (
            <p className="text-sm text-neutral-500">Calcul en cours…</p>
          )}
          {candidates && (
            <ul className="space-y-1">
              {candidates.map((c, i) => {
                const evalLabel = formatScore(c.scoreCp, c.isMate)
                const tone = scoreToneFromStm(c.scoreCp, currentFen)
                return (
                  <li key={i}>
                    <button
                      onClick={() => playUci(c.uci)}
                      className="w-full text-left flex items-center gap-2 hover:bg-neutral-800 rounded px-2 py-1.5"
                    >
                      <span className="text-neutral-500 text-xs w-6">#{i + 1}</span>
                      <span className="font-mono text-base">{c.san}</span>
                      <span className={`text-xs font-mono ${tone}`}>{evalLabel}</span>
                      <span className="text-xs text-neutral-500 ml-2 truncate">{c.pvSan}</span>
                    </button>
                  </li>
                )
              })}
              {candidates.length === 0 && (
                <li className="text-sm text-neutral-500">Pas de candidats (position terminale ?)</li>
              )}
            </ul>
          )}

          {history.length > 1 && (
            <>
              <h4 className="font-semibold text-sm mt-4 mb-1">Ligne jouée</h4>
              <div className="text-xs font-mono text-neutral-300">
                {history.slice(1).map((h, i) => (
                  <span key={i}>{i % 2 === 0 ? `${Math.floor(i / 2) + 1}. ` : ''}{h.san} </span>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function toCandidate(line: EvalLine, fen: string): ExplorerCandidate | null {
  if (!line.moveUci) return null
  const c = new Chess(fen)
  let san: string | undefined
  try {
    const mv = c.move({
      from: line.moveUci.slice(0, 2),
      to: line.moveUci.slice(2, 4),
      promotion: line.moveUci.length > 4 ? line.moveUci.slice(4, 5) : undefined,
    })
    san = mv?.san
  } catch { return null }
  if (!san) return null
  // Build SAN PV (best-effort, up to 5 plies)
  let pvSan = ''
  try {
    const c2 = new Chess(fen)
    const sans: string[] = []
    for (const uci of line.pvUci.slice(0, 5)) {
      if (!uci || uci.length < 4) break
      try {
        const mv = c2.move({
          from: uci.slice(0, 2),
          to: uci.slice(2, 4),
          promotion: uci.length > 4 ? uci.slice(4, 5) : undefined,
        })
        if (!mv) break
        sans.push(mv.san)
      } catch { break }
    }
    pvSan = sans.join(' ')
  } catch { /* noop */ }
  return {
    san,
    uci: line.moveUci,
    scoreCp: line.scoreCp,
    isMate: line.isMate,
    pvSan,
  }
}

// Score from side-to-move's POV → human-readable string.
function formatScore(cpStm: number, isMate: boolean): string {
  if (isMate) {
    const mateIn = 100000 - Math.abs(cpStm)
    return cpStm > 0 ? `+M${mateIn}` : `-M${mateIn}`
  }
  const pawns = cpStm / 100
  return (pawns >= 0 ? '+' : '') + pawns.toFixed(2)
}

function scoreToneFromStm(cpStm: number, fen: string): string {
  // Convert STM → white's perspective for the colour scale (positive = white better)
  const stm = fen.split(' ')[1]
  const whitePov = stm === 'w' ? cpStm : -cpStm
  if (Math.abs(whitePov) > 50000) return whitePov > 0 ? 'text-green-400' : 'text-red-400'
  if (whitePov >= 100) return 'text-green-400'
  if (whitePov >= 30) return 'text-green-300'
  if (whitePov >= -30) return 'text-neutral-300'
  if (whitePov >= -100) return 'text-orange-300'
  return 'text-red-400'
}
