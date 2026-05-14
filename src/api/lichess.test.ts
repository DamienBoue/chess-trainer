import { describe, expect, it } from 'vitest'
import { classifyTableMove, tableCategoryLabel } from './lichess'

describe('classifyTableMove', () => {
  it('keeps the win when both positions are winning', () => {
    expect(classifyTableMove('win', 'loss')).toBe('optimal')
  })

  it('throws the win when winning → draw', () => {
    expect(classifyTableMove('win', 'draw')).toBe('bad')
  })

  it('throws the win when winning → still win for the opponent', () => {
    expect(classifyTableMove('win', 'win')).toBe('bad')
  })

  it('keeps the draw', () => {
    expect(classifyTableMove('draw', 'draw')).toBe('optimal')
  })

  it('improves a draw into a win', () => {
    expect(classifyTableMove('draw', 'loss')).toBe('optimal')
  })

  it('throws the draw when drawing → losing', () => {
    expect(classifyTableMove('draw', 'win')).toBe('bad')
  })

  it('saves a lost position by reaching a draw', () => {
    expect(classifyTableMove('loss', 'draw')).toBe('good')
  })

  it('treats every move from a lost position as optimal/imprecise — never "bad"', () => {
    expect(classifyTableMove('loss', 'win')).toBe('optimal')
    expect(classifyTableMove('loss', 'loss')).toBe('imprecise')
  })
})

describe('tableCategoryLabel', () => {
  it('labels the major categories with a French phrase + tone', () => {
    expect(tableCategoryLabel('win').tone).toBe('win')
    expect(tableCategoryLabel('draw').tone).toBe('draw')
    expect(tableCategoryLabel('loss').tone).toBe('loss')
    expect(tableCategoryLabel('cursed-win').tone).toBe('win')
    expect(tableCategoryLabel('blessed-loss').tone).toBe('draw')
  })
})
