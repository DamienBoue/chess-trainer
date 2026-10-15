// The Expo app on the web (Metro): Stockfish served from its public folder.
import type { EngineTransport } from './transportTypes'
import { workerTransport } from './workerTransport'

export type { EngineTransport }

export function createTransport(): EngineTransport {
  return workerTransport('/stockfish.js')
}
