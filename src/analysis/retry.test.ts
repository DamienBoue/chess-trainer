import { describe, expect, it } from 'vitest'
import { attemptLossCp, buildRetryItems, judgeAttempt, winningChances, type RetryItem } from './retry'
import { analysedGame } from '../strategy/__fixtures__'
import { reviewGameStrategy } from '../strategy/game'

const NAJDORF = 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be2 e5 Nb3 Be7 O-O O-O a4 Be6'

function najdorf() {
  // 15. O-O was a "mistake" (engine wanted a4), 17. a4 missed the d5 outpost
  // (an inaccuracy, but a strategic one), 18...Be6 is the opponent's error.
  return analysedGame(NAJDORF, {
    costs: {
      15: { cpLoss: 150, best: 'a4' },
      17: { cpLoss: 90, best: 'Nd5' },
      18: { cpLoss: 300, best: 'Nc6' },
    },
  })
}

describe('buildRetryItems', () => {
  it('keeps the player\'s mistakes and strategic misses, in game order', () => {
    const g = najdorf()
    const items = buildRetryItems(g, reviewGameStrategy(g).events)
    expect(items.map(i => i.ply)).toEqual([15, 17])
    expect(items.every(i => i.side === 'w')).toBe(true)
  })

  it('without the strategic review, only mistakes and blunders remain', () => {
    expect(buildRetryItems(najdorf()).map(i => i.ply)).toEqual([15])
  })

  it('gives a strategic hint first when the engine was starting a plan', () => {
    const g = najdorf()
    const item = buildRetryItems(g, reviewGameStrategy(g).events).find(i => i.ply === 17)!
    expect(item.plan?.title).toContain('d5')
    expect(item.hints[0]).toMatch(/^Indice stratégique : pense au plan/)
    expect(item.hints[1]).toBe('Joue ton cavalier de c3.')
    expect([item.bestFrom, item.bestTo]).toEqual(['c3', 'd5'])
  })

  it('falls back to a tactical or "quiet move" hint', () => {
    const item = buildRetryItems(najdorf()).find(i => i.ply === 15)!
    expect(item.plan).toBeUndefined()
    expect(item.hints[0]).toBe('Indice : un coup calme, sans prise ni échec.')
  })

  it('ignores moves where the player already found the engine move', () => {
    const g = analysedGame('e4 e5', { costs: { 1: { cpLoss: 150, best: 'e4' } } })
    expect(buildRetryItems(g)).toEqual([])
  })
})

describe('judgeAttempt', () => {
  const item: RetryItem = {
    ply: 21, fen: '', side: 'b', playedSan: 'Qd7', bestSan: 'Nxe4', bestFrom: 'f6', bestTo: 'e4',
    cpLoss: 180, classification: 'mistake', evalBest: -40, evalPlayed: 140, hints: [],
  }

  it('recognises the engine move and the game move without the engine', () => {
    expect(judgeAttempt(item, 'Nxe4+')).toBe('best')
    expect(judgeAttempt(item, 'Qd7')).toBe('same')
    expect(judgeAttempt(item, 'h6')).toBe('pending')
  })

  it('accepts alternatives within the winning-chances tolerance', () => {
    expect(judgeAttempt(item, 'h6', -25)).toBe('good')   // 15 cp worse for Black near equality
    expect(judgeAttempt(item, 'h6', 60)).toBe('wrong')   // 100 cp worse
  })

  it('never accepts an alternative that is not better than the game move', () => {
    const lost: RetryItem = { ...item, evalBest: -900, evalPlayed: -880 }
    // Both are lost-for-White positions; within tolerance, but not better than the game move.
    expect(judgeAttempt(lost, 'h6', -870)).toBe('wrong')
  })

  it('measures the loss of an attempt from the mover\'s point of view', () => {
    expect(attemptLossCp(item, 60)).toBe(100)
    expect(attemptLossCp(item, -100)).toBe(0)
  })
})

describe('winningChances', () => {
  it('is symmetric and saturates on mates', () => {
    expect(winningChances(0, 'w')).toBeCloseTo(0)
    expect(winningChances(300, 'w')).toBeCloseTo(-winningChances(300, 'b'))
    expect(winningChances(100000 - 3, 'w')).toBeCloseTo(winningChances(1000, 'w'))
  })
})
