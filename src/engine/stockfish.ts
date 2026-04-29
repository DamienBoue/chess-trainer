// Wraps Stockfish (single-threaded WASM build served from /public/stockfish.js)
// in a Promise-friendly API. The engine is a long-lived Worker that processes
// one evaluation at a time via a small queue.

export interface EvalResult {
  scoreCp: number       // centipawns from White's perspective; mate -> ±(100000 - mateInPliesAbs)
  bestMoveUci?: string
  pvUci: string[]       // principal variation in UCI
  depth: number
  isMate: boolean
}

interface PendingEval {
  fen: string
  depth: number
  movetimeMs?: number
  resolve: (r: EvalResult) => void
  reject: (e: Error) => void
}

const MATE_BASE = 100000

export class StockfishEngine {
  private worker: Worker
  private readyPromise: Promise<void>
  private current: PendingEval | null = null
  private queue: PendingEval[] = []
  private latest: { scoreCp: number; depth: number; pvUci: string[]; isMate: boolean } | null = null

  private debug = (() => {
    try { return localStorage.getItem('sf.debug') === '1' } catch { return false }
  })()

  constructor() {
    // Use Vite's BASE_URL so the worker resolves correctly both in dev (/) and
    // when deployed under a sub-path (e.g. GitHub Pages /chess-trainer/).
    this.worker = new Worker(`${import.meta.env.BASE_URL}stockfish.js`)
    this.worker.onerror = (e) => {
      console.error('[stockfish] worker error', e.message || e.type, e)
    }
    this.worker.onmessage = (e) => {
      const line = typeof e.data === 'string' ? e.data : String(e.data)
      if (this.debug) console.log('[sf <]', line)
      this.onMessage(line)
    }
    this.readyPromise = new Promise((resolve, reject) => {
      let booted = false
      const timeout = setTimeout(() => {
        if (!booted) {
          console.error('[stockfish] timeout: engine did not reply to "uci" within 15s')
          reject(new Error('Stockfish ne répond pas. Ouvre /sf-test.html pour diagnostiquer.'))
        }
      }, 15000)
      const handler = (e: MessageEvent) => {
        const line = typeof e.data === 'string' ? e.data : String(e.data)
        if (line === 'uciok') {
          this.send('isready')
        } else if (line === 'readyok') {
          booted = true
          clearTimeout(timeout)
          this.worker.removeEventListener('message', handler)
          resolve()
        }
      }
      this.worker.addEventListener('message', handler)
      this.send('uci')
    })
  }

  ready$(): Promise<void> {
    return this.readyPromise
  }

  private send(cmd: string) {
    if (this.debug) console.log('[sf >]', cmd)
    this.worker.postMessage(cmd)
  }

  private onMessage(line: string) {
    if (!this.current) return
    if (line.startsWith('info')) {
      // Parse depth, score, pv
      const depthMatch = line.match(/\bdepth (\d+)/)
      const scoreCpMatch = line.match(/\bscore cp (-?\d+)/)
      const scoreMateMatch = line.match(/\bscore mate (-?\d+)/)
      const pvMatch = line.match(/\bpv (.+?)(?:\s(?:bmc|tbhits|hashfull|nps|nodes|time|currmove|currmovenumber|multipv|score|seldepth|depth)\b|$)/)
      // Simpler: take everything after " pv "
      const pvIdx = line.indexOf(' pv ')
      let pv: string[] = []
      if (pvIdx !== -1) {
        pv = line.slice(pvIdx + 4).trim().split(/\s+/)
      } else if (pvMatch) {
        pv = pvMatch[1].split(/\s+/)
      }
      let scoreCp: number | null = null
      let isMate = false
      if (scoreMateMatch) {
        const mateIn = parseInt(scoreMateMatch[1], 10)
        // Sign: + means side-to-move mates; we'll invert in caller via sideToMove logic
        // We store from side-to-move perspective; caller flips for white-perspective.
        const abs = Math.abs(mateIn)
        scoreCp = (mateIn >= 0 ? 1 : -1) * (MATE_BASE - abs)
        isMate = true
      } else if (scoreCpMatch) {
        scoreCp = parseInt(scoreCpMatch[1], 10)
      }
      const depth = depthMatch ? parseInt(depthMatch[1], 10) : 0
      if (scoreCp !== null) {
        this.latest = { scoreCp, depth, pvUci: pv, isMate }
      }
    } else if (line.startsWith('bestmove')) {
      const parts = line.split(/\s+/)
      const bestMoveUci = parts[1] !== '(none)' ? parts[1] : undefined
      const result: EvalResult = {
        scoreCp: this.latest?.scoreCp ?? 0,
        bestMoveUci,
        pvUci: this.latest?.pvUci ?? (bestMoveUci ? [bestMoveUci] : []),
        depth: this.latest?.depth ?? 0,
        isMate: this.latest?.isMate ?? false,
      }
      const cur = this.current
      this.current = null
      this.latest = null
      cur.resolve(result)
      this.processNext()
    }
  }

  private processNext() {
    if (this.current) return
    const next = this.queue.shift()
    if (!next) return
    this.current = next
    this.latest = null
    this.send('ucinewgame')
    this.send(`position fen ${next.fen}`)
    const goCmd = next.movetimeMs
      ? `go depth ${next.depth} movetime ${next.movetimeMs}`
      : `go depth ${next.depth}`
    this.send(goCmd)
  }

  async evaluate(fen: string, depth = 12, movetimeMs = 600): Promise<EvalResult> {
    await this.readyPromise
    return new Promise<EvalResult>((resolve, reject) => {
      const item: PendingEval = { fen, depth, movetimeMs, resolve, reject }
      this.queue.push(item)
      this.processNext()
    })
  }

  destroy() {
    this.worker.terminate()
  }
}

// Score returned by stockfish is from the side-to-move perspective.
// Convert to white's perspective using the FEN side-to-move.
export function toWhitePerspective(scoreCpFromStm: number, fen: string): number {
  const stm = fen.split(' ')[1]
  return stm === 'w' ? scoreCpFromStm : -scoreCpFromStm
}
