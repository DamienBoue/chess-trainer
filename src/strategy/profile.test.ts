import { describe, expect, it } from 'vitest'
import { Chess } from 'chess.js'
import { buildStrategyProfile } from './profile'
import { reviewGameStrategy } from './game'
import { analysedGame } from './__fixtures__'
import type { GameAnalysis } from '../types'

const QGD = 'd4 d5 c4 e6 Nc3 Nf6 cxd5 exd5 Bg5 Be7 e3 c6 Bd3 O-O Qc2 Nbd7 Nf3 Re8 O-O Nf8 Rab1 Ne4'
const NAJDORF = 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be2 e5 Nb3 Be7 O-O O-O a4 Be6'

function withResult(g: GameAnalysis, result: GameAnalysis['result'], url: string): GameAnalysis {
  return { ...g, result, url }
}

/** Deterministic pseudo-random legal game, for performance budgets. */
function randomGame(seed: number, plies: number): GameAnalysis {
  let x = seed
  const rnd = () => { x = (x * 1103515245 + 12345) % 2147483648; return x / 2147483648 }
  const c = new Chess()
  const sans: string[] = []
  for (let i = 0; i < plies && !c.isGameOver(); i++) {
    const moves = c.moves()
    const san = moves[Math.floor(rnd() * moves.length)]
    c.move(san); sans.push(san)
  }
  const g = analysedGame(sans.join(' '))
  g.moves.forEach((m, i) => { if (i % 7 === 3) { m.cpLoss = 120; m.bestMoveSan = new Chess(m.fenBefore).moves()[0] } })
  return { ...g, url: `rand-${seed}` }
}

describe('buildStrategyProfile', () => {
  it('aggregates structures with score and role', () => {
    const games = [
      withResult(analysedGame(QGD, { userColor: 'white' }), 'win', 'a'),
      withResult(analysedGame(QGD, { userColor: 'white' }), 'loss', 'b'),
      withResult(analysedGame(QGD, { userColor: 'black' }), 'draw', 'c'),
    ]
    const p = buildStrategyProfile(games)
    const asA = p.structures.find(s => s.id === 'carlsbad' && s.role === 'A')!
    expect(asA.games).toBe(2)
    expect(asA.score).toBe(0.5)
    expect(asA.roleLabel).toContain('minorité')
    const asB = p.structures.find(s => s.id === 'carlsbad' && s.role === 'B')!
    expect(asB.games).toBe(1)
    expect(p.centers.length).toBeGreaterThan(0)
  })

  it('counts missed plans by kind and keeps examples', () => {
    const g = analysedGame(NAJDORF, { costs: { 17: { cpLoss: 90, best: 'Nd5' } } })
    const p = buildStrategyProfile([withResult(g, 'loss', 'x'), withResult(g, 'loss', 'y')])
    const outpost = p.missed.find(m => m.kind === 'outpost')!
    expect(outpost.count).toBe(2)
    expect(outpost.totalCp).toBe(180)
    expect(outpost.examples[0]).toMatchObject({ url: 'x', ply: 16 })
    expect(p.headlines.some(h => h.includes('avant-postes'))).toBe(true)
  })

  it('compares the user\'s structural concessions with the opponents\'', () => {
    const ruy = analysedGame('e4 e5 Nf3 Nc6 Bb5 a6 Bxc6 dxc6 O-O f6', { userColor: 'black' })
    const p = buildStrategyProfile([ruy])
    const doubled = p.habits.find(h => h.kind === 'doubled')!
    expect(doubled.count).toBe(1)
    const pair = p.habits.find(h => h.kind === 'bishop-pair')!
    expect(pair.oppCount).toBe(1)
  })

  it('reviews a long game fast enough for a whole history (budget)', () => {
    const games = [1, 2, 3, 4, 5].map(s => randomGame(s, 100))
    const t0 = performance.now()
    for (const g of games) reviewGameStrategy(g)
    const perGame = (performance.now() - t0) / games.length
    expect(perGame).toBeLessThan(250)
  })
})
