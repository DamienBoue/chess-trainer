// Phones: React Native has no Web Workers, so each engine is a Worker inside
// one hidden WebView (EngineHost, mounted once at the app root) running the
// same WASM Stockfish as the website. Messages wait until the page is ready.
import type { EngineTransport } from './transportTypes'

export type { EngineTransport }

export type ToEnginePage =
  | { type: 'create' | 'terminate'; id: number }
  | { type: 'cmd'; id: number; cmd: string }

interface Host { send(msg: ToEnginePage): void }

let host: Host | null = null
const pending: ToEnginePage[] = []
const channels = new Map<number, Set<(line: string) => void>>()
let nextId = 1

function send(msg: ToEnginePage) {
  if (host) host.send(msg)
  else pending.push(msg)
}

/** EngineHost attaches once its page has loaded, and detaches on unmount. */
export function attachEngineHost(h: Host | null): void {
  host = h
  if (h) for (const msg of pending.splice(0)) h.send(msg)
}

/** EngineHost forwards each message of its page here. */
export function receiveFromEngineHost(data: string): void {
  let m: { id?: number; line?: string; error?: string }
  try { m = JSON.parse(data) } catch { return }
  if (m.error) console.error('[stockfish] worker error', m.error)
  if (m.id === undefined || m.line === undefined) return
  for (const listener of [...(channels.get(m.id) ?? [])]) listener(m.line)
}

export function createTransport(): EngineTransport {
  const id = nextId++
  const listeners = new Set<(line: string) => void>()
  channels.set(id, listeners)
  send({ type: 'create', id })
  return {
    post: cmd => send({ type: 'cmd', id, cmd }),
    onLine: listener => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    terminate: () => {
      send({ type: 'terminate', id })
      channels.delete(id)
    },
  }
}
