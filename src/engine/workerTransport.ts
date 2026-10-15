import type { EngineTransport } from './transportTypes'

/** Stockfish's WASM build in a Web Worker, loaded from `url`. */
export function workerTransport(url: string): EngineTransport {
  const worker = new Worker(url)
  const listeners = new Set<(line: string) => void>()
  worker.onerror = e => console.error('[stockfish] worker error', e.message || e.type, e)
  worker.onmessage = e => {
    const line = typeof e.data === 'string' ? e.data : String(e.data)
    for (const listener of [...listeners]) listener(line)
  }
  return {
    post: cmd => worker.postMessage(cmd),
    onLine: listener => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    terminate: () => worker.terminate(),
  }
}
