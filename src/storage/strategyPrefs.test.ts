import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_STRATEGY_OVERLAYS, loadStrategyOverlays, loadTrainerScore, recordTrainerAnswer, saveStrategyOverlays } from './strategyPrefs'
import { mockLocalStorage } from '../test-utils/mockLocalStorage'

beforeEach(() => { vi.stubGlobal('localStorage', mockLocalStorage()) })

describe('strategy preferences', () => {
  it('remembers the board overlays, defaults filling the gaps', () => {
    expect(loadStrategyOverlays()).toEqual(DEFAULT_STRATEGY_OVERLAYS)
    saveStrategyOverlays({ ...DEFAULT_STRATEGY_OVERLAYS, pawns: true, engineArrow: false })
    expect(loadStrategyOverlays()).toMatchObject({ pawns: true, engineArrow: false, strong: true })
  })

  it('keeps the trainer score overall and per kind of question', () => {
    expect(loadTrainerScore()).toEqual({ answered: 0, correct: 0, byKind: {} })
    recordTrainerAnswer('plan', true)
    recordTrainerAnswer('plan', false)
    const s = recordTrainerAnswer('square', true)
    expect(s).toEqual({ answered: 3, correct: 2, byKind: { plan: { answered: 2, correct: 1 }, square: { answered: 1, correct: 1 } } })
    expect(loadTrainerScore()).toEqual(s)
  })
})
