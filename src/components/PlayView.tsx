import { useEffect, useMemo, useRef, useState } from 'react'
import { Chess } from 'chess.js'
import { Chessboard } from 'react-chessboard'
import type { StockfishEngine } from '../engine/stockfish'
import { playMove, playCapture, playSuccess } from '../audio/sounds'

interface Props {
  engine: StockfishEngine
}

type Phase = 'setup' | 'playing' | 'finished'

interface Outcome {
  result: '1-0' | '0-1' | '1/2-1/2'
  reason: string
}

// Approximate strength → average movetime (ms). Lower Elo = faster moves (and
// less skilful). Engine's own UCI_Elo handles strength; movetime affects how
// "thoughtful" each reply feels.
function movetimeForElo(elo: number): number {
  if (elo < 1000) return 250
  if (elo < 1400) return 400
  if (elo < 1800) return 600
  if (elo < 2200) return 900
  return 1200
}

export default function PlayView({ engine }: Props) {
  const [phase, setPhase] = useState<Phase>('setup')
  const [elo, setElo] = useState<number>(1400)
  const [userColor, setUserColor] = useState<'white' | 'black'>('white')
  const [game, setGame] = useState<Chess>(() => new Chess())
  const [position, setPosition] = useState<string>(() => new Chess().fen())
  const [pgn, setPgn] = useState<string[]>([])  // accumulated SAN
  const [thinking, setThinking] = useState(false)
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const [error, setError] = useState<string | null>(null)
  const cancelRef = useRef(false)

  const userIsWhite = userColor === 'white'
  const engineColor = userIsWhite ? 'b' : 'w'

  useEffect(() => {
    if (phase !== 'playing') return
    // If engine plays first, kick it off.
    if (game.turn() === engineColor && !thinking && !outcome) {
      void askEngine()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, position])

  async function start() {
    cancelRef.current = false
    try {
      await engine.setStrength(elo)
      const c = new Chess()
      setGame(c)
      setPosition(c.fen())
      setPgn([])
      setOutcome(null)
      setError(null)
      setPhase('playing')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  function checkTermination(c: Chess): Outcome | null {
    if (c.isCheckmate()) {
      return { result: c.turn() === 'w' ? '0-1' : '1-0', reason: 'Échec et mat' }
    }
    if (c.isStalemate()) return { result: '1/2-1/2', reason: 'Pat' }
    if (c.isInsufficientMaterial()) return { result: '1/2-1/2', reason: 'Matériel insuffisant' }
    if (c.isThreefoldRepetition()) return { result: '1/2-1/2', reason: 'Triple répétition' }
    if (c.isDraw()) return { result: '1/2-1/2', reason: 'Nulle (règle 50 coups ou matériel)' }
    return null
  }

  async function askEngine() {
    if (thinking || outcome) return
    setThinking(true)
    try {
      const r = await engine.evaluate(game.fen(), 18, movetimeForElo(elo))
      if (cancelRef.current) return
      if (!r.bestMoveUci) {
        setOutcome(checkTermination(game))
        return
      }
      const uci = r.bestMoveUci
      const from = uci.slice(0, 2)
      const to = uci.slice(2, 4)
      const promotion = uci.length === 5 ? uci.slice(4) : undefined
      const c = new Chess(game.fen())
      const mv = c.move({ from, to, promotion })
      if (!mv) return
      setGame(c)
      setPosition(c.fen())
      setPgn(prev => [...prev, mv.san])
      if (mv.captured) playCapture(); else playMove()
      const term = checkTermination(c)
      if (term) {
        setOutcome(term)
        playSuccess()
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setThinking(false)
    }
  }

  function onPieceDrop({ sourceSquare, targetSquare, piece }: {
    sourceSquare: string; targetSquare: string | null; piece: { pieceType: string }
  }): boolean {
    if (outcome || thinking) return false
    if (!targetSquare) return false
    if (game.turn() !== userColor[0]) return false

    const promotion = piece.pieceType.endsWith('P') &&
      (targetSquare[1] === '1' || targetSquare[1] === '8') ? 'q' : undefined
    let mv
    try {
      mv = game.move({ from: sourceSquare, to: targetSquare, promotion })
    } catch { return false }
    if (!mv) return false

    const c = new Chess(game.fen())
    setGame(c)
    setPosition(c.fen())
    setPgn(prev => [...prev, mv.san])
    if (mv.captured) playCapture(); else playMove()
    const term = checkTermination(c)
    if (term) {
      setOutcome(term)
      return true
    }
    // Engine reply triggered by the useEffect on position change.
    return true
  }

  function resign() {
    if (outcome) return
    setOutcome({
      result: userIsWhite ? '0-1' : '1-0',
      reason: 'Abandon',
    })
  }

  function backToSetup() {
    cancelRef.current = true
    setPhase('setup')
    setOutcome(null)
  }

  function downloadPgn() {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '.')
    const result = outcome?.result ?? '*'
    const lines: string[] = [
      `[Event "Vs Stockfish ${elo}"]`,
      `[Site "chess-trainer (local)"]`,
      `[Date "${date}"]`,
      `[White "${userIsWhite ? 'You' : `Stockfish ${elo}`}"]`,
      `[Black "${userIsWhite ? `Stockfish ${elo}` : 'You'}"]`,
      `[Result "${result}"]`,
      '',
    ]
    let body = ''
    for (let i = 0; i < pgn.length; i++) {
      if (i % 2 === 0) body += `${(i / 2) + 1}. `
      body += pgn[i] + ' '
    }
    body += result
    lines.push(body.trim())
    const blob = new Blob([lines.join('\n')], { type: 'application/x-chess-pgn' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `vs-stockfish-${elo}-${date.replace(/\./g, '-')}.pgn`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (phase === 'setup') {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-5">
        <div>
          <h2 className="text-2xl font-semibold mb-1">Jouer contre Stockfish</h2>
          <p className="text-sm text-neutral-400">
            Stockfish 17 lite, force ajustable via <code className="text-xs">UCI_LimitStrength</code>.
            La partie se sauvegarde en PGN à la fin pour rejouer/analyser dans l'onglet Parties.
          </p>
        </div>

        <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded p-4 space-y-3">
          <label className="block">
            <span className="text-sm text-neutral-300">Force estimée : <span className="font-mono text-neutral-100">{elo}</span> Elo</span>
            <input
              type="range"
              min={1320}
              max={2850}
              step={50}
              value={elo}
              onChange={e => setElo(parseInt(e.target.value, 10))}
              className="w-full mt-2"
            />
            <div className="flex justify-between text-[10px] text-neutral-500 mt-1">
              <span>1320 (débutant fort)</span>
              <span>1800 (club)</span>
              <span>2400 (maître)</span>
              <span>2850 (max)</span>
            </div>
          </label>

          <div>
            <span className="text-sm text-neutral-300 block mb-1">Tu joues</span>
            <div className="inline-flex rounded-md border border-[var(--color-border)] bg-neutral-900 p-0.5">
              <button
                onClick={() => setUserColor('white')}
                className={`px-3 py-1.5 rounded text-sm ${userColor === 'white' ? 'bg-[var(--color-accent)] text-white' : 'text-neutral-300 hover:bg-neutral-800'}`}
              >⚪ Blancs</button>
              <button
                onClick={() => setUserColor('black')}
                className={`px-3 py-1.5 rounded text-sm ${userColor === 'black' ? 'bg-[var(--color-accent)] text-white' : 'text-neutral-300 hover:bg-neutral-800'}`}
              >⚫ Noirs</button>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-700/50 rounded p-3 text-sm text-red-300">{error}</div>
        )}

        <button
          onClick={start}
          className="w-full px-4 py-3 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white rounded-md font-semibold"
        >
          Lancer la partie
        </button>
      </div>
    )
  }

  // Playing / finished UI share the board.
  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <button onClick={backToSetup} className="text-neutral-400 hover:text-white text-sm">← Nouvelle partie</button>
        <div className="text-sm text-neutral-300">
          Toi (⚪{userIsWhite ? '' : ' Noirs'}) vs Stockfish {elo}
          {thinking && <span className="text-neutral-500 ml-2">· réfléchit…</span>}
        </div>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_280px] gap-4">
        <div className="w-[min(85vw,560px)] mx-auto">
          <Chessboard
            options={{
              position,
              boardOrientation: userColor,
              allowDragging: !outcome && !thinking && game.turn() === userColor[0],
              animationDurationInMs: 200,
              onPieceDrop,
              darkSquareStyle: { backgroundColor: '#769656' },
              lightSquareStyle: { backgroundColor: '#eeeed2' },
            }}
          />
          <div className="mt-3 flex gap-2">
            {!outcome && (
              <button
                onClick={resign}
                className="px-3 py-1.5 text-sm rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300"
              >Abandonner</button>
            )}
            {outcome && (
              <button
                onClick={downloadPgn}
                className="px-3 py-1.5 text-sm rounded bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white"
              >Télécharger la PGN</button>
            )}
          </div>
        </div>

        <aside className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-3 max-h-[80vh] overflow-auto">
          <h3 className="text-sm font-semibold mb-2">Coups</h3>
          <PgnList moves={pgn} />
          {outcome && (
            <div className={`mt-4 p-3 rounded text-sm ${
              outcome.result === '1-0' && userIsWhite || outcome.result === '0-1' && !userIsWhite
                ? 'bg-green-900/30 border border-green-700/50 text-green-200'
                : outcome.result === '1/2-1/2'
                  ? 'bg-neutral-800 border border-neutral-700 text-neutral-200'
                  : 'bg-red-900/30 border border-red-700/50 text-red-200'
            }`}>
              <div className="font-bold">{outcome.result}</div>
              <div className="text-xs mt-1">{outcome.reason}</div>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}

function PgnList({ moves }: { moves: string[] }) {
  const pairs = useMemo(() => {
    const out: { num: number; white?: string; black?: string }[] = []
    for (let i = 0; i < moves.length; i++) {
      const num = Math.floor(i / 2) + 1
      if (i % 2 === 0) out.push({ num, white: moves[i] })
      else out[out.length - 1].black = moves[i]
    }
    return out
  }, [moves])

  if (pairs.length === 0) return <p className="text-xs text-neutral-500">Aucun coup joué.</p>
  return (
    <div className="text-sm space-y-0.5">
      {pairs.map(p => (
        <div key={p.num} className="font-mono text-xs flex">
          <span className="text-neutral-500 w-8">{p.num}.</span>
          <span className="text-neutral-200 w-16">{p.white ?? ''}</span>
          <span className="text-neutral-300 w-16">{p.black ?? ''}</span>
        </div>
      ))}
    </div>
  )
}
