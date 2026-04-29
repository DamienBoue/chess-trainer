// Tiny synthesized chess sounds via Web Audio. Kept inline so we don't need
// to ship audio files in the bundle.

let ctx: AudioContext | null = null
function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    try { ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)() } catch { ctx = null }
  }
  return ctx
}

interface Tone {
  freq: number
  attack: number
  decay: number
  type?: OscillatorType
  vol?: number
}

function play(t: Tone) {
  const c = getCtx()
  if (!c) return
  if (!soundsEnabled()) return
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = t.type ?? 'triangle'
  osc.frequency.value = t.freq
  const now = c.currentTime
  const peak = t.vol ?? 0.15
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(peak, now + t.attack)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + t.attack + t.decay)
  osc.connect(gain).connect(c.destination)
  osc.start(now)
  osc.stop(now + t.attack + t.decay + 0.05)
}

export function soundsEnabled(): boolean {
  try { return localStorage.getItem('chess.sounds') !== 'off' } catch { return true }
}
export function setSoundsEnabled(on: boolean): void {
  try { localStorage.setItem('chess.sounds', on ? 'on' : 'off') } catch { /* noop */ }
}

export function playMove(): void  { play({ freq: 520, attack: 0.005, decay: 0.06, type: 'triangle', vol: 0.10 }) }
export function playCapture(): void { play({ freq: 280, attack: 0.005, decay: 0.10, type: 'square',   vol: 0.12 }) }
export function playCheck(): void   { play({ freq: 880, attack: 0.005, decay: 0.18, type: 'sawtooth', vol: 0.12 }) }
export function playSuccess(): void {
  play({ freq: 660, attack: 0.005, decay: 0.06, vol: 0.10 })
  setTimeout(() => play({ freq: 990, attack: 0.005, decay: 0.10, vol: 0.10 }), 80)
}
export function playWrong(): void   { play({ freq: 180, attack: 0.005, decay: 0.20, type: 'sawtooth', vol: 0.10 }) }

// Heuristic: derive the right sound from a chess.js move object's flags.
export function playForMove(flags: string | undefined): void {
  if (!flags) return playMove()
  if (flags.includes('c') || flags.includes('e')) return playCapture()
  return playMove()
}
