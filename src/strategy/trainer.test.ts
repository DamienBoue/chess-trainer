import { describe, expect, it } from 'vitest'
import { buildDrillSet, drillIsLegal, isCorrectSquare, planDrills, sampleStructureDrills, squareDrills } from './trainer'
import { reviewGameStrategy } from './game'
import { analysedGame } from './__fixtures__'

const NAJDORF = 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be2 e5 Nb3 Be7 O-O O-O a4 Be6'
// A longer Najdorf where White keeps the d5 square available for a while.
const NAJDORF_LONG = NAJDORF + ' f4 Qc7 Kh1 Nbd7 f5 Bc4 a5 Rac8 Be3 Bxe2 Qxe2 h6 g4 Nh7 h4'

describe('strategy trainer', () => {
  it('turns a missed plan into a multiple-choice drill', () => {
    const g = analysedGame(NAJDORF, { costs: { 17: { cpLoss: 90, best: 'Nd5' } } })
    const drills = planDrills(g, reviewGameStrategy(g))
    expect(drills).toHaveLength(1)
    const d = drills[0]
    expect(d.kind).toBe('plan')
    expect(d.choices!.length).toBeGreaterThanOrEqual(3)
    expect(d.answer).toEqual(['outpost'])
    expect(d.choices!.find(c => c.id === 'outpost')!.label).toBe('Installer un cavalier sur un avant-poste')
    // Choices never give the answer away with concrete squares; the explanation does.
    expect(d.choices!.every(c => !/[a-h][1-8]/.test(c.label))).toBe(true)
    expect(new Set(d.choices!.map(c => c.id)).size).toBe(d.choices!.length)
    expect(d.explanation).toContain('d5')
    expect(d.source).toMatchObject({ ply: 16 })
    expect(drillIsLegal(d)).toBe(true)
  })

  it('finds strong-square drills in middlegame positions', () => {
    const drills = squareDrills(analysedGame(NAJDORF_LONG))
    expect(drills.length).toBeGreaterThan(0)
    const d = drills[0]
    expect(isCorrectSquare(d, d.answer[0])).toBe(true)
    expect(isCorrectSquare(d, 'a1')).toBe(false)
  })

  it('has a structure drill for every reference structure', () => {
    const drills = sampleStructureDrills()
    expect(drills.length).toBeGreaterThanOrEqual(15)
    for (const d of drills) {
      expect(d.choices!.filter(c => d.answer.includes(c.id))).toHaveLength(1)
      expect(new Set(d.choices!.map(c => c.id)).size).toBe(d.choices!.length)
    }
  })

  it('builds a deterministic mixed session, falling back to reference positions', () => {
    const g = analysedGame(NAJDORF, { costs: { 17: { cpLoss: 90, best: 'Nd5' } } })
    const reviews = new Map([[g.url, reviewGameStrategy(g)]])
    const a = buildDrillSet([g], reviews, { size: 6, seed: 3 })
    const b = buildDrillSet([g], reviews, { size: 6, seed: 3 })
    expect(a.map(d => d.id)).toEqual(b.map(d => d.id))
    expect(a).toHaveLength(6)
    expect(new Set(a.map(d => d.kind))).toContain('plan')
    expect(new Set(a.map(d => d.kind))).toContain('structure')
    expect(buildDrillSet([], new Map(), { size: 4 }).every(d => d.kind === 'structure')).toBe(true)
  })

  it('restricts a session to one kind', () => {
    expect(buildDrillSet([], new Map(), { kinds: ['plan'] })).toEqual([])
  })
})
