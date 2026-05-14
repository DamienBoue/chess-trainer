import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getBoardTheme, setBoardTheme, getBoardColors, getEngineDepth, setEngineDepth } from './settings'
import { mockLocalStorage } from '../test-utils/mockLocalStorage'


describe('board theme', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', mockLocalStorage())
    vi.stubGlobal('window', { dispatchEvent: vi.fn(), addEventListener: vi.fn() })
    vi.stubGlobal('CustomEvent', class { constructor(public type: string, public init?: object) {} })
  })

  it('defaults to green', () => {
    expect(getBoardTheme()).toBe('green')
  })

  it('reads back what was set', () => {
    setBoardTheme('brown')
    expect(getBoardTheme()).toBe('brown')
  })

  it('falls back to green when stored value is corrupt', () => {
    localStorage.setItem('chess.board.theme', 'rainbow')
    expect(getBoardTheme()).toBe('green')
  })

  it('returns a palette per theme', () => {
    setBoardTheme('blue')
    const c = getBoardColors()
    expect(c.dark).toMatch(/^#[0-9a-f]{6}$/i)
    expect(c.light).toMatch(/^#[0-9a-f]{6}$/i)
  })
})

describe('engine depth', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', mockLocalStorage())
    vi.stubGlobal('window', { dispatchEvent: vi.fn() })
    vi.stubGlobal('CustomEvent', class { constructor(public type: string, public init?: object) {} })
  })

  it('defaults to 12', () => {
    expect(getEngineDepth()).toBe(12)
  })

  it('rejects out-of-range stored values', () => {
    localStorage.setItem('chess.engine.depth', '99')
    expect(getEngineDepth()).toBe(12)
    localStorage.setItem('chess.engine.depth', 'pizza')
    expect(getEngineDepth()).toBe(12)
  })

  it('clamps writes to [8, 30]', () => {
    setEngineDepth(2)
    expect(getEngineDepth()).toBe(8)
    setEngineDepth(100)
    expect(getEngineDepth()).toBe(30)
    setEngineDepth(14.7)
    expect(getEngineDepth()).toBe(15)
  })
})
