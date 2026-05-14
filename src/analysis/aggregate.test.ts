import { describe, expect, it } from 'vitest'
import { aggregate, deriveInsights, PHASE_LABELS } from './aggregate'
import { sampleCorpus, buildGame } from './__fixtures__'

describe('aggregate', () => {
  it('returns zeros on empty input', () => {
    const s = aggregate([])
    expect(s.gamesAnalyzed).toBe(0)
    expect(s.totalMoves).toBe(0)
    expect(s.avgCpLossUser).toBe(0)
  })

  it('counts games and totals user moves only', () => {
    const games = sampleCorpus()
    const s = aggregate(games)
    expect(s.gamesAnalyzed).toBe(games.length)
    // User-side move count = number of moves whose ply matches userColor.
    let expected = 0
    for (const g of games) {
      const userIsWhite = g.userColor === 'white'
      for (const mv of g.moves) {
        if ((mv.ply % 2 === 1) === userIsWhite) expected++
      }
    }
    expect(s.totalMoves).toBe(expected)
  })

  it('builds opening groups sorted by played desc', () => {
    const s = aggregate(sampleCorpus())
    expect(s.openingGroups.length).toBeGreaterThan(0)
    for (let i = 1; i < s.openingGroups.length; i++) {
      expect(s.openingGroups[i - 1].played).toBeGreaterThanOrEqual(s.openingGroups[i].played)
    }
  })

  it('counts blunders by phase', () => {
    const s = aggregate(sampleCorpus())
    const totalUserBlunders = s.blundersByPhase.opening + s.blundersByPhase.middlegame + s.blundersByPhase.endgame
    expect(totalUserBlunders).toBe(s.byClass.blunder)
  })

  it('tracks user moves and cpLossSum per phase', () => {
    const s = aggregate(sampleCorpus())
    const totalMoves = s.phases.opening.userMoves + s.phases.middlegame.userMoves + s.phases.endgame.userMoves
    expect(totalMoves).toBe(s.totalMoves)
  })

  it('computes resultsByColor', () => {
    const s = aggregate(sampleCorpus())
    const white = s.resultsByColor.white
    const black = s.resultsByColor.black
    expect(white.w + white.l + white.d + black.w + black.l + black.d).toBe(sampleCorpus().length)
  })

  it('exposes a French label for every phase', () => {
    expect(PHASE_LABELS.opening).toBe('Ouverture')
    expect(PHASE_LABELS.middlegame).toBe('Milieu')
    expect(PHASE_LABELS.endgame).toBe('Finale')
  })
})

describe('deriveInsights', () => {
  it('returns no insights when there are no games', () => {
    expect(deriveInsights(aggregate([]))).toEqual([])
  })

  it('produces at least one insight for the sample corpus', () => {
    const lines = deriveInsights(aggregate(sampleCorpus()))
    expect(lines.length).toBeGreaterThan(0)
  })

  it('flags a clear color advantage when present', () => {
    // 4 white wins, 0 black wins → expect a "tu joues mieux avec les Blancs" line.
    const games = [
      buildGame({ userColor: 'white', result: 'win',  moves: [{ ply: 1, san: 'e4', cpLoss: 0, classification: 'best' }] }),
      buildGame({ userColor: 'white', result: 'win',  moves: [{ ply: 1, san: 'e4', cpLoss: 0, classification: 'best' }] }),
      buildGame({ userColor: 'black', result: 'loss', moves: [{ ply: 1, san: 'e5', cpLoss: 0, classification: 'best' }] }),
      buildGame({ userColor: 'black', result: 'loss', moves: [{ ply: 1, san: 'e5', cpLoss: 0, classification: 'best' }] }),
    ]
    const lines = deriveInsights(aggregate(games))
    expect(lines.some(l => l.text.includes('Blancs') || l.text.includes('Noirs'))).toBe(true)
  })
})
