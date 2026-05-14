import { describe, expect, it } from 'vitest'
import { classifyByCpLoss, CLASSIFICATION_COLORS, CLASSIFICATION_LABELS } from './classify'

describe('classifyByCpLoss', () => {
  it('returns "book" for any book move regardless of cpLoss', () => {
    expect(classifyByCpLoss(0,    false, true)).toBe('book')
    expect(classifyByCpLoss(500,  false, true)).toBe('book')
    expect(classifyByCpLoss(9999, true,  true)).toBe('book')
  })

  it('returns "best" when isBest=true', () => {
    expect(classifyByCpLoss(0,    true, false)).toBe('best')
    expect(classifyByCpLoss(50,   true, false)).toBe('best')
  })

  it.each([
    [0,    'best'],
    [10,   'best'],
    [11,   'great'],
    [25,   'great'],
    [26,   'good'],
    [60,   'good'],
    [61,   'inaccuracy'],
    [120,  'inaccuracy'],
    [121,  'mistake'],
    [250,  'mistake'],
    [251,  'blunder'],
    [9999, 'blunder'],
  ])('cpLoss %d → %s', (cp, expected) => {
    expect(classifyByCpLoss(cp, false, false)).toBe(expected)
  })

  it('has a color + label for every classification', () => {
    const all = ['best', 'great', 'good', 'inaccuracy', 'mistake', 'blunder', 'book'] as const
    for (const c of all) {
      expect(CLASSIFICATION_COLORS[c]).toMatch(/^#[0-9a-f]{6}$/i)
      expect(CLASSIFICATION_LABELS[c].length).toBeGreaterThan(0)
    }
  })
})
