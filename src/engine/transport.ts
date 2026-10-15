// The website (Vite): Stockfish served from /public, under Vite's BASE_URL
// (/ in dev, /chess-trainer/ on GitHub Pages). The Expo app picks
// transport.web.ts or transport.native.ts instead.
import type { EngineTransport } from './transportTypes'
import { workerTransport } from './workerTransport'

export type { EngineTransport }

export function createTransport(): EngineTransport {
  return workerTransport(`${import.meta.env.BASE_URL}stockfish.js`)
}
