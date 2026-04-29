// Standalone MultiPV evaluation: spawns a one-shot Stockfish worker to fetch
// the top-N principal variations from a position. Used to flag "only-move"
// puzzles (positions where the best move dominates the second-best by a wide
// margin). Runs in parallel with the main engine without interfering with its
// queue.

export interface EvalLine {
  scoreCp: number       // raw stockfish score from the side-to-move perspective
  isMate: boolean
  moveUci: string
  pvUci: string[]
  depth: number
}

const MATE_BASE = 100000
const TIMEOUT_MS = 12000

export function evaluateMultiPV(
  fen: string,
  n: number = 2,
  depth: number = 10,
  movetimeMs: number = 400,
): Promise<EvalLine[]> {
  return new Promise((resolve, reject) => {
    let worker: Worker
    try {
      worker = new Worker(`${import.meta.env.BASE_URL}stockfish.js`)
    } catch (e) {
      reject(e instanceof Error ? e : new Error(String(e)))
      return
    }

    const lines = new Map<number, EvalLine>()
    let phase: 'init' | 'searching' = 'init'
    const cleanup = () => { try { worker.terminate() } catch { /* */ } }
    const timeout = window.setTimeout(() => { cleanup(); reject(new Error('multipv timeout')) }, TIMEOUT_MS)

    worker.onerror = (e) => {
      window.clearTimeout(timeout); cleanup()
      reject(new Error(e.message || 'multipv worker error'))
    }
    worker.onmessage = (e) => {
      const line = typeof e.data === 'string' ? e.data : String(e.data)
      if (phase === 'init') {
        if (line === 'uciok') worker.postMessage('isready')
        else if (line === 'readyok') {
          worker.postMessage(`setoption name MultiPV value ${n}`)
          worker.postMessage('ucinewgame')
          worker.postMessage(`position fen ${fen}`)
          worker.postMessage(`go depth ${depth} movetime ${movetimeMs}`)
          phase = 'searching'
        }
        return
      }
      if (line.startsWith('info')) {
        const mpvMatch = line.match(/\bmultipv (\d+)/)
        if (!mpvMatch) return
        const idx = parseInt(mpvMatch[1], 10)
        const depthMatch = line.match(/\bdepth (\d+)/)
        const cpMatch = line.match(/\bscore cp (-?\d+)/)
        const mateMatch = line.match(/\bscore mate (-?\d+)/)
        const pvIdx = line.indexOf(' pv ')
        if (pvIdx === -1) return
        const pv = line.slice(pvIdx + 4).trim().split(/\s+/)
        let scoreCp = 0
        let isMate = false
        if (mateMatch) {
          const m = parseInt(mateMatch[1], 10)
          scoreCp = (m >= 0 ? 1 : -1) * (MATE_BASE - Math.abs(m))
          isMate = true
        } else if (cpMatch) {
          scoreCp = parseInt(cpMatch[1], 10)
        }
        lines.set(idx, {
          scoreCp, isMate,
          moveUci: pv[0],
          pvUci: pv,
          depth: depthMatch ? parseInt(depthMatch[1], 10) : 0,
        })
      } else if (line.startsWith('bestmove')) {
        window.clearTimeout(timeout)
        cleanup()
        const sorted = Array.from(lines.entries()).sort((a, b) => a[0] - b[0]).map(([, v]) => v)
        resolve(sorted)
      }
    }
    worker.postMessage('uci')
  })
}

// Convenience: how big is the gap between top and 2nd-best, from the side-to-
// move perspective? Returned in centipawns, clamped at 1000 to avoid mate-
// score pollution.
export function topGapCp(lines: EvalLine[]): number {
  if (lines.length < 2) return 0
  const clamp = (v: number) => Math.max(-1000, Math.min(1000, v))
  // scoreCp is from side-to-move POV, so positive = good for the mover. The
  // gap is just first minus second (positive when top is better).
  return clamp(lines[0].scoreCp) - clamp(lines[1].scoreCp)
}
