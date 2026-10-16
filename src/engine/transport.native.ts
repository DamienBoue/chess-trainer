// Phones: React Native has no Web Workers, so each engine is a Worker inside
// one hidden WebView (EngineHost, mounted once at the app root) running the
// same WASM Stockfish as the website. Messages wait until the page is ready.
import type { EngineTransport } from './transportTypes'

export type { EngineTransport }

export type ToEnginePage =
  | { type: 'create' | 'terminate'; id: number }
  | { type: 'cmd'; id: number; cmd: string }

interface Host { send(msg: ToEnginePage): void }

interface Channel {
  lines: Set<(line: string) => void>
  resets: Set<() => void>
}

let host: Host | null = null
let everAttached = false
const pending: ToEnginePage[] = []
const channels = new Map<number, Channel>()
let nextId = 1

function send(msg: ToEnginePage) {
  if (host) host.send(msg)
  else pending.push(msg)
}

/** EngineHost attaches once its page is ready, and detaches when the page
 *  is lost (unmount, or its process killed by the OS). */
export function attachEngineHost(h: Host | null): void {
  host = h
  if (!h) return
  if (everAttached) {
    // A reloaded page: its workers died with the old one. One fresh worker
    // per live engine, what was queued for the dead ones dropped, and each
    // engine told to start over.
    pending.length = 0
    for (const id of channels.keys()) h.send({ type: 'create', id })
    for (const c of channels.values()) for (const reset of [...c.resets]) reset()
    return
  }
  everAttached = true
  for (const msg of pending.splice(0)) h.send(msg)
}

/** EngineHost forwards each message of its page here. */
export function receiveFromEngineHost(data: string): void {
  let m: { id?: number; line?: string; error?: string }
  try { m = JSON.parse(data) } catch { return }
  if (m.error) console.error('[stockfish] worker error', m.error)
  if (m.id === undefined || m.line === undefined) return
  for (const listener of [...(channels.get(m.id)?.lines ?? [])]) listener(m.line)
}

export function createTransport(): EngineTransport {
  const id = nextId++
  const channel: Channel = { lines: new Set(), resets: new Set() }
  channels.set(id, channel)
  send({ type: 'create', id })
  return {
    post: cmd => send({ type: 'cmd', id, cmd }),
    onLine: listener => {
      channel.lines.add(listener)
      return () => { channel.lines.delete(listener) }
    },
    onReset: listener => {
      channel.resets.add(listener)
      return () => { channel.resets.delete(listener) }
    },
    terminate: () => {
      send({ type: 'terminate', id })
      channels.delete(id)
    },
  }
}
