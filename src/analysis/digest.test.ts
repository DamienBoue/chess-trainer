import { describe, expect, it } from 'vitest'
import { sampleCorpus, buildGame } from './__fixtures__'
import { aggregate } from './aggregate'
import { extractExercises } from './exercises'
import { emptyIndex, homeSummary, indexExercises, indexStamp, withAnalyses } from './digest'

describe('digest index', () => {
  it('gives the same exercises as extracting them all at once', () => {
    const corpus = sampleCorpus()
    expect(indexExercises(withAnalyses(emptyIndex(), corpus))).toEqual(extractExercises(corpus))
  })

  it('builds the same index game by game as all at once', () => {
    const corpus = sampleCorpus()
    let index = emptyIndex()
    for (const a of corpus) index = withAnalyses(index, [a])
    expect(index).toEqual(withAnalyses(emptyIndex(), corpus))
  })

  it('keeps the same object when nothing is new, replaces a game analysed again', () => {
    const corpus = sampleCorpus()
    const index = withAnalyses(emptyIndex(), corpus)
    expect(withAnalyses(index, [corpus[0]])).toBe(index)
    const again = { ...corpus[0], moves: corpus[0].moves.map(m => ({ ...m, cpLoss: m.cpLoss + 1 })) }
    const next = withAnalyses(index, [again])
    expect(next).not.toBe(index)
    expect(next.games[again.url].stamp).not.toBe(index.games[again.url].stamp)
    expect(indexStamp(next)).not.toBe(indexStamp(index))
  })

  it('sums up the home screen like the full aggregate', () => {
    const corpus = sampleCorpus()
    const home = homeSummary(withAnalyses(emptyIndex(), corpus))
    expect(home.analysed).toBe(corpus.length)
    expect(home.avgCpLossUser).toBeCloseTo(aggregate(corpus).avgCpLossUser)
    const last = [...corpus].sort((a, b) => b.endTime - a.endTime)[0]
    expect(home.last).toMatchObject({ url: last.url, opponent: last.opponent, result: last.result })
    const errors = last.moves.filter(m => (m.ply % 2 === 1) === (last.userColor === 'white') && (m.classification === 'blunder' || m.classification === 'mistake')).length
    expect(home.last!.userErrors).toBe(errors)
  })

  it('has an empty home without games', () => {
    expect(homeSummary(emptyIndex())).toEqual({ analysed: 0, avgCpLossUser: 0, last: null, ratings: [] })
    expect(withAnalyses(emptyIndex(), [buildGame({ moves: [] })]).games).toBeTruthy()
  })
})
