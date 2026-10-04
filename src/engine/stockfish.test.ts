import { describe, expect, it, vi } from 'vitest'
import { StockfishEngine, parseInfoScore, toWhitePerspective } from './stockfish'

describe('parseInfoScore', () => {
  it('reads centipawns and mates from the side to move', () => {
    expect(parseInfoScore('info depth 12 seldepth 18 score cp -34 nodes 1000 pv e2e4')).toEqual({ scoreCp: -34, isMate: false })
    expect(parseInfoScore('info depth 9 score mate 3 pv d1h5')).toEqual({ scoreCp: 99997, isMate: true })
    expect(parseInfoScore('info depth 9 score mate -2 pv g8f6')).toEqual({ scoreCp: -99998, isMate: true })
    expect(parseInfoScore('info string NNUE evaluation enabled')).toBeNull()
  })

  it('scores a checkmate on the board as lost for the side to move', () => {
    // Stockfish answers "score mate 0" + "bestmove (none)" on a mated position.
    const mated = parseInfoScore('info depth 0 score mate 0')!
    expect(mated.scoreCp).toBe(-100000)
    // Fool's mate: White to move and mated, so Black is winning.
    const fen = 'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3'
    expect(toWhitePerspective(mated.scoreCp, fen)).toBe(-100000)
  })
})

// A UCI worker that answers instantly, recording what it was sent.
class FakeWorker {
  sent: string[] = []
  onmessage: ((e: MessageEvent) => void) | null = null
  onerror: ((e: ErrorEvent) => void) | null = null
  private listeners: ((e: MessageEvent) => void)[] = []
  addEventListener(_type: string, l: (e: MessageEvent) => void) { this.listeners.push(l) }
  removeEventListener(_type: string, l: (e: MessageEvent) => void) { this.listeners = this.listeners.filter(x => x !== l) }
  postMessage(cmd: string) {
    this.sent.push(cmd)
    const reply = (line: string) => queueMicrotask(() => {
      const e = { data: line } as MessageEvent
      this.onmessage?.(e)
      for (const l of [...this.listeners]) l(e)
    })
    if (cmd === 'uci') reply('uciok')
    else if (cmd === 'isready') reply('readyok')
    else if (cmd.startsWith('go')) { reply('info depth 1 score cp 10 pv e2e4'); reply('bestmove e2e4') }
  }
  terminate() {}
}

describe('StockfishEngine strength', () => {
  it('caps a bot search only, and gives the next search full strength back', async () => {
    vi.stubGlobal('Worker', FakeWorker)
    const engine = new StockfishEngine()
    const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    // A bot move and an analysis queued together, as when a batch analysis
    // runs during a game against the engine.
    await Promise.all([engine.evaluate(START, 1, 10, 1500), engine.evaluate(START, 1, 10), engine.evaluate(START, 1, 10, 900)])
    const worker = (engine as unknown as { worker: FakeWorker }).worker
    const searches = worker.sent.filter(c => c.startsWith('setoption') || c.startsWith('go'))
    expect(searches).toEqual([
      'setoption name UCI_LimitStrength value true', 'setoption name UCI_Elo value 1500', 'go depth 1 movetime 10',
      'setoption name UCI_LimitStrength value false', 'go depth 1 movetime 10',
      'setoption name UCI_LimitStrength value true', 'setoption name UCI_Elo value 1320', 'go depth 1 movetime 10',
    ])
    vi.unstubAllGlobals()
  })
})
