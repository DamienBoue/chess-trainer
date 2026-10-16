// The app on the web (Expo/Metro): Stockfish's WASM build in a Web Worker,
// served from the site's public folder under its base URL (/chess-trainer
// on GitHub Pages, inlined by Expo at build time). Phones use
// transport.native.ts instead.
import type { EngineTransport } from './transportTypes'
import { workerTransport } from './workerTransport'

export type { EngineTransport }

export function createTransport(): EngineTransport {
  return workerTransport(`${process.env.EXPO_BASE_URL ?? ''}/stockfish.js`)
}
