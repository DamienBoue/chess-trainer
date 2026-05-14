// User settings persisted in localStorage. Read inline anywhere; write via
// the Settings view. A 'settings-changed' window event is dispatched on each
// write so passive consumers (TrainingBoard, …) can refresh.

export type BoardTheme = 'green' | 'brown' | 'blue' | 'gray'

export interface BoardColors { dark: string; light: string }

const BOARD_PALETTES: Record<BoardTheme, BoardColors> = {
  green: { dark: '#769656', light: '#eeeed2' },   // chess.com
  brown: { dark: '#b58863', light: '#f0d9b5' },   // Lichess
  blue:  { dark: '#5b88ba', light: '#c9d6e3' },
  gray:  { dark: '#5e6266', light: '#cfd2d4' },
}

export function getBoardTheme(): BoardTheme {
  const v = (localStorage.getItem('chess.board.theme') ?? 'green') as BoardTheme
  return BOARD_PALETTES[v] ? v : 'green'
}

export function setBoardTheme(t: BoardTheme): void {
  localStorage.setItem('chess.board.theme', t)
  window.dispatchEvent(new CustomEvent('settings-changed', { detail: { key: 'board.theme' } }))
}

export function getBoardColors(): BoardColors {
  return BOARD_PALETTES[getBoardTheme()]
}

// Stockfish: target depth applied to the next batch analysis. Stored as the
// number to pass to UCI `go depth N`. Default 12 = the historical default.
export function getEngineDepth(): number {
  const n = parseInt(localStorage.getItem('chess.engine.depth') ?? '12', 10)
  return Number.isFinite(n) && n >= 8 && n <= 30 ? n : 12
}

export function setEngineDepth(n: number): void {
  const clamped = Math.max(8, Math.min(30, Math.round(n)))
  localStorage.setItem('chess.engine.depth', String(clamped))
  window.dispatchEvent(new CustomEvent('settings-changed', { detail: { key: 'engine.depth' } }))
}

// Lichess Personal Access Token: required since Lichess gated the
// opening explorer endpoints behind auth. The user generates a
// scope-less token at lichess.org/account/oauth/token and pastes it
// in Settings; we send it as `Authorization: Bearer <token>` on the
// explorer (and tablebase) calls.
export function getLichessToken(): string {
  try { return localStorage.getItem('chess.lichess.token') ?? '' } catch { return '' }
}

export function setLichessToken(t: string): void {
  try {
    if (t.trim()) localStorage.setItem('chess.lichess.token', t.trim())
    else localStorage.removeItem('chess.lichess.token')
    window.dispatchEvent(new CustomEvent('settings-changed', { detail: { key: 'lichess.token' } }))
  } catch { /* noop */ }
}
