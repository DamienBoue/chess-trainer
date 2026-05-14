import { describe, expect, it } from 'vitest'
import { exportAnnotatedPgn } from './pgnExport'
import { buildGame } from './__fixtures__'

describe('exportAnnotatedPgn', () => {
  it('emits NAG glyphs by classification', () => {
    const g = buildGame({
      pgn: '', moves: [
        { ply: 1, san: 'e4',   cpLoss: 0,   classification: 'best'      },
        { ply: 2, san: 'e5',   cpLoss: 30,  classification: 'great'     },
        { ply: 3, san: 'Nf3',  cpLoss: 80,  classification: 'inaccuracy', bestMoveSan: 'd4' },
        { ply: 4, san: 'Nc6',  cpLoss: 200, classification: 'mistake',    bestMoveSan: 'Nf6' },
        { ply: 5, san: '??',   cpLoss: 800, classification: 'blunder',    bestMoveSan: 'd4' },
      ],
    } as Parameters<typeof buildGame>[0])
    const text = exportAnnotatedPgn(g)
    expect(text).toContain(' $1') // best
    expect(text).toContain(' $5') // great
    expect(text).toContain(' $6') // inaccuracy
    expect(text).toContain(' $2') // mistake
    expect(text).toContain(' $4') // blunder
  })

  it('adds a best-move comment for mistakes and blunders', () => {
    const g = buildGame({
      moves: [
        { ply: 1, san: '??', cpLoss: 800, classification: 'blunder', bestMoveSan: 'Nf3', bestLineSan: 'Nf3 Nc6' },
      ],
    })
    const text = exportAnnotatedPgn(g)
    expect(text).toContain('best Nf3')
    expect(text).toContain('-8.00') // 800cp = -8.00
    expect(text).toContain('Nf3 Nc6')
  })

  it('annotator header is always set to Chess Trainer + Stockfish', () => {
    const g = buildGame({ moves: [{ ply: 1, san: 'e4', cpLoss: 0, classification: 'best' }] })
    const text = exportAnnotatedPgn(g)
    expect(text).toContain('[Annotator "Chess Trainer + Stockfish"]')
  })

  it('emits a result tag matching the game outcome + user color', () => {
    const w = buildGame({ userColor: 'white', result: 'win',  moves: [{ ply: 1, san: 'e4', cpLoss: 0, classification: 'best' }] })
    const b = buildGame({ userColor: 'black', result: 'win',  moves: [{ ply: 1, san: 'e4', cpLoss: 0, classification: 'best' }] })
    const d = buildGame({ userColor: 'white', result: 'draw', moves: [{ ply: 1, san: 'e4', cpLoss: 0, classification: 'best' }] })
    expect(exportAnnotatedPgn(w)).toContain('1-0')
    expect(exportAnnotatedPgn(b)).toContain('0-1')
    expect(exportAnnotatedPgn(d)).toContain('1/2-1/2')
  })

  it('numbers moves correctly (1. for white, ... for black response)', () => {
    const g = buildGame({
      moves: [
        { ply: 1, san: 'e4', cpLoss: 0, classification: 'best' },
        { ply: 2, san: 'e5', cpLoss: 0, classification: 'best' },
        { ply: 3, san: 'Nf3', cpLoss: 0, classification: 'best' },
      ],
    })
    const text = exportAnnotatedPgn(g)
    expect(text).toContain('1.')
    expect(text).toContain('2.')
  })
})
