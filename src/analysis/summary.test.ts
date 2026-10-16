import { describe, expect, it } from 'vitest'
import { generateGameSummary, summarizeMoves } from './summary'
import type { GameAnalysis } from '../types'
import { buildGame } from './__fixtures__'

describe('generateGameSummary', () => {
  it('mentions the opening when present', () => {
    const g = buildGame({ opening: 'Italian Game', moves: [{ ply: 1, san: 'e4', cpLoss: 0, classification: 'best' }] })
    expect(generateGameSummary(g)).toContain('Italian Game')
  })

  it('uses the French outcome word', () => {
    const w = buildGame({ result: 'win',  moves: [{ ply: 1, san: 'e4', cpLoss: 0, classification: 'best' }] })
    const l = buildGame({ result: 'loss', moves: [{ ply: 1, san: 'e4', cpLoss: 0, classification: 'best' }] })
    const d = buildGame({ result: 'draw', moves: [{ ply: 1, san: 'e4', cpLoss: 0, classification: 'best' }] })
    expect(generateGameSummary(w)).toContain('Victoire')
    expect(generateGameSummary(l)).toContain('Défaite')
    expect(generateGameSummary(d)).toContain('Nulle')
  })

  it('names the opponent', () => {
    const g = buildGame({ opponent: 'kasparov', moves: [{ ply: 1, san: 'e4', cpLoss: 0, classification: 'best' }] })
    expect(generateGameSummary(g)).toContain('kasparov')
  })

  it('reports the pivotal blunder when there is one', () => {
    const g = buildGame({
      userColor: 'white',
      moves: [
        { ply: 9, san: 'Bxh6', cpLoss: 350, classification: 'blunder', bestMoveSan: 'Nf3' },
      ],
    })
    const s = generateGameSummary(g)
    expect(s).toContain('Bxh6')
    expect(s).toContain('Nf3')
    expect(s).toMatch(/coup.pivot/i)
  })

  it('says "pas d\'erreur grave" when the user played cleanly', () => {
    const g = buildGame({
      moves: [{ ply: 1, san: 'e4', cpLoss: 0, classification: 'best' }],
    })
    expect(generateGameSummary(g)).toMatch(/pas d.erreur/i)
  })

  it('grades precision based on avg cpLoss', () => {
    const clean = buildGame({ moves: [{ ply: 1, san: 'e4', cpLoss: 0, classification: 'best' }] })
    const sloppy = buildGame({
      moves: Array.from({ length: 4 }, (_, i) => ({
        ply: i * 2 + 1, san: 'X', cpLoss: 150,
        classification: 'mistake' as const, bestMoveSan: 'Y',
      })),
    })
    expect(generateGameSummary(clean)).toContain('excellente')
    expect(generateGameSummary(sloppy)).toMatch(/à améliorer|correcte/)
  })
})

describe('summarizeMoves', () => {
  it('counts each side\'s errors and average loss, from the player\'s colour', () => {
    const moves = [
      { ply: 1, classification: 'blunder', cpLoss: 300 },
      { ply: 2, classification: 'best', cpLoss: 0 },
      { ply: 3, classification: 'mistake', cpLoss: 120 },
      { ply: 4, classification: 'inaccuracy', cpLoss: 60 },
      { ply: 5, classification: 'inaccuracy', cpLoss: 40 },
    ] as GameAnalysis['moves']
    const asWhite = summarizeMoves({ userColor: 'white', moves } as GameAnalysis)
    expect(asWhite.user).toMatchObject({ blunders: 1, mistakes: 1, inaccuracies: 1, moves: 3, avgCpLoss: 460 / 3 })
    expect(asWhite.opp).toMatchObject({ blunders: 0, inaccuracies: 1, moves: 2, avgCpLoss: 30 })
    const asBlack = summarizeMoves({ userColor: 'black', moves: [] } as unknown as GameAnalysis)
    expect(asBlack.user.avgCpLoss).toBe(0)
  })
})
