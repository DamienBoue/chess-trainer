import { describe, expect, it } from 'vitest'
import { extractExercises, DIFFICULTIES_FOR_BRACKET, DIFFICULTY_LABELS } from './exercises'
import { buildGame } from './__fixtures__'

describe('extractExercises', () => {
  it('produces no exercises from an empty corpus', () => {
    expect(extractExercises([])).toEqual([])
  })

  it('extracts "missed" entries for user blunders meeting the cpLoss threshold', () => {
    const g = buildGame({
      userColor: 'white',
      moves: [
        // Ply 9 (white move) blunder, cpLoss 300 ≥ 120 → counted.
        { ply: 9, san: 'Bxh6', cpLoss: 300, classification: 'blunder', bestMoveSan: 'Nf3' },
        // Ply 11 (white move) tiny mistake, cpLoss 50 < 120 → ignored.
        { ply: 11, san: 'a3',   cpLoss: 50,  classification: 'mistake', bestMoveSan: 'Nf3' },
      ],
    })
    const list = extractExercises([g])
    expect(list.length).toBe(1)
    expect(list[0].category).toBe('missed')
    expect(list[0].bestMoveSan).toBe('Nf3')
    expect(list[0].playedMoveSan).toBe('Bxh6')
  })

  it('extracts "punishment" when user finds best right after opponent blunders', () => {
    const g = buildGame({
      userColor: 'white',
      moves: [
        { ply: 9, san: '??',     cpLoss: 0,   classification: 'best'    }, // user prep move
        { ply: 10, san: '...??', cpLoss: 200, classification: 'blunder', bestMoveSan: 'Be7' }, // opp blunder
        { ply: 11, san: 'Qxh7+', cpLoss: 0,   classification: 'best',    bestMoveSan: 'Qxh7+' }, // user punishes
      ],
    })
    const list = extractExercises([g])
    const punishments = list.filter(e => e.category === 'punishment')
    expect(punishments.length).toBe(1)
    expect(punishments[0].bestMoveSan).toBe('Qxh7+')
  })

  it('caps exercises per game (default 6) by cpSwing', () => {
    const g = buildGame({
      userColor: 'white',
      moves: Array.from({ length: 20 }, (_, i) => ({
        ply: 9 + i * 2, san: `m${i}`, cpLoss: 200 + i,
        classification: 'blunder' as const, bestMoveSan: 'X',
      })),
    })
    const list = extractExercises([g])
    expect(list.length).toBeLessThanOrEqual(6)
  })

  it('assigns a difficulty grade to every exercise', () => {
    const g = buildGame({
      userColor: 'white',
      moves: [
        { ply: 9, san: '??', cpLoss: 300, classification: 'blunder', bestMoveSan: 'Qxh7#' }, // mate-in-1 → easy
        { ply: 11, san: '?', cpLoss: 300, classification: 'blunder', bestMoveSan: 'Nd5',
          bestLineSan: 'Nd5 Bxd5 exd5 Qxd5 Bg5' }, // long PV → hard
        { ply: 13, san: '?', cpLoss: 300, classification: 'blunder', bestMoveSan: 'Kg2',
          bestLineSan: 'Kg2 Rd8' }, // quiet 2-ply → medium
      ],
    })
    const list = extractExercises([g])
    const byMove = new Map(list.map(e => [e.bestMoveSan, e.difficulty]))
    expect(byMove.get('Qxh7#')).toBe('easy')
    expect(byMove.get('Nd5')).toBe('hard')
    expect(byMove.get('Kg2')).toBe('medium')
  })

  it('global ordering: most recent games first', () => {
    const old   = buildGame({ url: 'old',   endTime: 100, moves: [{ ply: 9, san: '?', cpLoss: 200, classification: 'blunder', bestMoveSan: 'X' }] })
    const fresh = buildGame({ url: 'fresh', endTime: 999, moves: [{ ply: 9, san: '?', cpLoss: 200, classification: 'blunder', bestMoveSan: 'X' }] })
    const list = extractExercises([old, fresh])
    expect(list[0].context.gameUrl).toBe('fresh')
  })
})

describe('DIFFICULTIES_FOR_BRACKET', () => {
  it('defines a difficulty band for each bracket', () => {
    expect(DIFFICULTIES_FOR_BRACKET.beginner).toContain('easy')
    expect(DIFFICULTIES_FOR_BRACKET.master).toContain('hard')
  })
})

describe('DIFFICULTY_LABELS', () => {
  it('has a French label for each difficulty', () => {
    expect(DIFFICULTY_LABELS.easy).toBe('Facile')
    expect(DIFFICULTY_LABELS.medium).toBe('Moyen')
    expect(DIFFICULTY_LABELS.hard).toBe('Difficile')
  })
})
