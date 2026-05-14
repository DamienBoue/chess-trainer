import { describe, expect, it } from 'vitest'
import { computeMotifRadar } from './motifRadar'
import type { Exercise } from './exercises'

function ex(category: 'missed' | 'punishment' | 'defense', motifs: Exercise['motifs']): Exercise {
  return {
    id: 'x', category, fen: '', userColor: 'white', sideToMove: 'w',
    bestMoveSan: 'X', playedMoveSan: 'Y', playedClassification: 'blunder',
    cpSwing: 0, evalBeforeWhite: 0, evalAfterPlayedWhite: 0,
    motifs, difficulty: 'medium',
    context: { gameUrl: '', opponent: 'a', ply: 1, moveLabel: '', endTime: 0 },
  }
}

describe('computeMotifRadar', () => {
  it('returns empty array when no exercises', () => {
    expect(computeMotifRadar([])).toEqual([])
  })

  it('counts found vs missed for each motif', () => {
    const exercises = [
      ex('missed',     ['fork']),
      ex('missed',     ['fork']),
      ex('missed',     ['fork']),
      ex('punishment', ['fork']),
      ex('missed',     ['pin']),
      ex('punishment', ['pin']),
      ex('punishment', ['pin']),
    ]
    const radar = computeMotifRadar(exercises)
    const fork = radar.find(r => r.motif === 'fork')!
    const pin  = radar.find(r => r.motif === 'pin')!
    expect(fork.missed).toBe(3)
    expect(fork.found).toBe(1)
    expect(fork.total).toBe(4)
    expect(fork.missRate).toBeCloseTo(0.75, 4)
    expect(pin.missed).toBe(1)
    expect(pin.found).toBe(2)
  })

  it('sorts most actionable first (high miss rate with meaningful sample)', () => {
    const exercises = [
      ex('missed', ['fork']), ex('missed', ['fork']), ex('missed', ['fork']),
      ex('missed', ['pin']),                                   // tiny sample
    ]
    const radar = computeMotifRadar(exercises)
    expect(radar[0].motif).toBe('fork')
  })
})
