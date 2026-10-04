// Wraps Stockfish (single-threaded WASM build served from /public/stockfish.js)
// in a Promise-friendly API. The engine is a long-lived Worker that processes
// one evaluation at a time via a small queue.

export interface EvalResult {
  scoreCp: number       // centipawns from the side to move's perspective (see toWhitePerspective); mate -> ±(100000 - mateInPliesAbs)
  bestMoveUci?: string
  pvUci: string[]       // principal variation in UCI
  depth: number
  isMate: boolean
}

interface PendingEval {
  fen: string
  depth: number
  movetimeMs?: number
  /** Capped strength for this search (bot games), null = full strength. */
  elo: number | null
  resolve: (r: EvalResult) => void
  reject: (e: Error) => void
}

const MATE_BASE = 100000

/** The score of a UCI `info` line, from the side to move's point of view.
 *  `mate N`: the side to move mates in N (N > 0) or is mated in |N|; `mate 0`
 *  is a checkmate on the board, so the side to move has lost. */
export function parseInfoScore(line: string): { scoreCp: number; isMate: boolean } | null {
  const mate = line.match(/\bscore mate (-?\d+)/)
  if (mate) {
    const mateIn = parseInt(mate[1], 10)
    return { scoreCp: (mateIn > 0 ? 1 : -1) * (MATE_BASE - Math.abs(mateIn)), isMate: true }
  }
  const cp = line.match(/\bscore cp (-?\d+)/)
  return cp ? { scoreCp: parseInt(cp[1], 10), isMate: false } : null
}

export class StockfishEngine {
  private worker: Worker
  private readyPromise: Promise<void>
  private current: PendingEval | null = null
  private queue: PendingEval[] = []
  private latest: { scoreCp: number; depth: number; pvUci: string[]; isMate: boolean } | null = null
  // The strength last sent to the worker. It is engine-wide UCI state, so it
  // is set per search: a bot move and an analysis can share the queue.
  private appliedElo: number | null = null

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
      const pvMatch = line.match(/\bpv (.+?)(?:\s(?:bmc|tbhits|hashfull|nps|nodes|time|currmove|currmovenumber|multipv|score|seldepth|depth)\b|$)/)
      // Simpler: take everything after " pv "
      const pvIdx = line.indexOf(' pv ')
      let pv: string[] = []
      if (pvIdx !== -1) {
        pv = line.slice(pvIdx + 4).trim().split(/\s+/)
      } else if (pvMatch) {
        pv = pvMatch[1].split(/\s+/)
      }
      // From the side to move's perspective; callers flip with toWhitePerspective.
      const score = parseInfoScore(line)
      const depth = depthMatch ? parseInt(depthMatch[1], 10) : 0
      if (score) {
        this.latest = { scoreCp: score.scoreCp, depth, pvUci: pv, isMate: score.isMate }
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
    this.applyStrength(next.elo)
    this.send('ucinewgame')
    this.send(`position fen ${next.fen}`)
    const goCmd = next.movetimeMs
      ? `go depth ${next.depth} movetime ${next.movetimeMs}`
      : `go depth ${next.depth}`
    this.send(goCmd)
  }

  /** Evaluates `fen`, at full strength unless `elo` caps it (the bot mode).
   *  Stockfish plays 1320..3190: lower targets are accepted and clamped. */
  async evaluate(fen: string, depth = 12, movetimeMs = 600, elo: number | null = null): Promise<EvalResult> {
    await this.readyPromise
    const capped = elo === null ? null : Math.max(1320, Math.min(3190, Math.round(elo)))
    return new Promise<EvalResult>((resolve, reject) => {
      const item: PendingEval = { fen, depth, movetimeMs, elo: capped, resolve, reject }
      this.queue.push(item)
      this.processNext()
    })
  }

  // Only between searches (processNext runs when the engine is idle).
  private applyStrength(elo: number | null) {
    if (elo === this.appliedElo) return
    this.appliedElo = elo
    if (elo === null) {
      this.send('setoption name UCI_LimitStrength value false')
      return
    }
    this.send('setoption name UCI_LimitStrength value true')
    this.send(`setoption name UCI_Elo value ${elo}`)
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
