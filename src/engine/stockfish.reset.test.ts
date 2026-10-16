import { describe, expect, it, vi } from 'vitest'

// A transport whose engine can be "restarted" like the phone's WebView.
const sent: string[] = []
const lineListeners = new Set<(l: string) => void>()
const resetListeners = new Set<() => void>()
const emit = (l: string) => queueMicrotask(() => { for (const f of [...lineListeners]) f(l) })
vi.mock('./transport', () => ({
  createTransport: () => ({
    post: (cmd: string) => {
      sent.push(cmd)
      if (cmd === 'uci') emit('uciok')
      else if (cmd === 'isready') emit('readyok')
    },
    onLine: (f: (l: string) => void) => { lineListeners.add(f); return () => { lineListeners.delete(f) } },
    onReset: (f: () => void) => { resetListeners.add(f); return () => { resetListeners.delete(f) } },
    terminate: () => {},
  }),
}))

describe('StockfishEngine after an engine restart', () => {
  it('replays the search that was running and resolves it', async () => {
    const { StockfishEngine } = await import('./stockfish')
    const engine = new StockfishEngine()
    await engine.ready$()
    const result = engine.evaluate('8/8/8/8/8/8/8/K6k w - - 0 1', 5, 50, 1500)
    await new Promise(r => setTimeout(r, 0))
    const before = sent.length
    // The page dies mid-search; the fresh engine never saw the search.
    for (const f of [...resetListeners]) f()
    const replay = sent.slice(before)
    expect(replay).toEqual([
      'setoption name UCI_LimitStrength value true', 'setoption name UCI_Elo value 1500',
      'ucinewgame', 'position fen 8/8/8/8/8/8/8/K6k w - - 0 1', 'go depth 5 movetime 50',
    ])
    emit('info depth 5 score cp 0 pv a1b1')
    emit('bestmove a1b1')
    await expect(result).resolves.toMatchObject({ bestMoveUci: 'a1b1', scoreCp: 0 })
  })
})
