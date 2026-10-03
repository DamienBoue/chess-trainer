import { describe, expect, it } from 'vitest'
import { STRUCTURE_SAMPLES, sampleFen } from './samples'
import { STRUCTURES, detectStructures } from './structures'
import { parseFen } from './board'
import { Chess } from 'chess.js'

describe('structure samples', () => {
  it('covers every named structure', () => {
    const covered = new Set(STRUCTURE_SAMPLES.map(s => s.structureId))
    for (const p of STRUCTURES) expect(covered.has(p.id), `no sample for ${p.id}`).toBe(true)
  })

  it.each(STRUCTURE_SAMPLES.map(s => [s.structureId, s] as const))('%s sample is legal and recognised', (id, s) => {
    expect(() => new Chess(sampleFen(s))).not.toThrow()
    const ids = detectStructures(parseFen(sampleFen(s))).map(m => m.pattern.id)
    expect(ids).toContain(id)
  })
})
