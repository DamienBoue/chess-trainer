import { describe, expect, it } from 'vitest'
import type { ChessComGame } from '../types'
import {
  clearGap,
  computeResults,
  expectedScore,
  formatCount,
  historyRows,
  moveCount,
  ratingsBefore,
  resultsInsights,
  scoreOf,
  toRow,
  type GameRow,
} from './results'

const PGN = `[Event "Live Chess"]
[ECO "B22"]
[ECOUrl "https://www.chess.com/openings/Sicilian-Defense-Alapin-Variation-2...d5"]

1. e4 {[%clk 0:02:59.9]} 1... c5 {[%clk 0:02:58.1]} 2. c3 {[%clk 0:02:57.2]} 2... d5 {[%clk 0:02:50.0]} 3. exd5 1-0`

function game(over: Partial<ChessComGame> & { me?: 'white' | 'black'; mine?: string; theirs?: string; myRating?: number; oppRating?: number }): ChessComGame {
  const me = over.me ?? 'white'
  const side = (name: string, result: string, rating: number) => ({ username: name, result, rating, '@id': '' })
  const mine = side('Me', over.mine ?? 'win', over.myRating ?? 1500)
  const theirs = side('opp', over.theirs ?? 'resigned', over.oppRating ?? 1500)
  return {
    url: over.url ?? `https://chess.com/g/${Math.round(Math.random() * 1e9)}`,
    pgn: over.pgn ?? PGN,
    time_control: '180',
    end_time: over.end_time ?? 1_700_000_000,
    rated: over.rated ?? true,
    time_class: over.time_class ?? 'blitz',
    rules: over.rules ?? 'chess',
    white: me === 'white' ? mine : theirs,
    black: me === 'white' ? theirs : mine,
    eco: over.eco,
  }
}

const row = (over: Partial<GameRow> = {}): GameRow => ({
  url: 'u', end: 0, timeClass: 'blitz', rated: true, color: 'white', result: 'win', ending: 'resign',
  rating: 1500, oppRating: 1500, opponent: 'opp', rules: 'chess', opening: 'Italian Game', variation: 'Italian Game', moves: 30, ...over,
})

describe('formatCount', () => {
  it('groups thousands the French way', () => {
    expect(formatCount(21061)).toBe('21\u202f061')
    expect(formatCount(1234567)).toBe('1\u202f234\u202f567')
    expect(formatCount(999)).toBe('999')
  })
})

describe('moveCount', () => {
  it('reads the last move number, ignoring clocks and headers', () => {
    expect(moveCount(PGN)).toBe(3)
    expect(moveCount('[Event "x"]\n\n1-0')).toBe(0)
  })
})

describe('toRow', () => {
  it('reads the side, result, ending and opening from the user side', () => {
    const r = toRow(game({ me: 'black', mine: 'timeout', theirs: 'win', myRating: 1400, oppRating: 1600 }), 'me')!
    expect(r).toMatchObject({ color: 'black', result: 'loss', ending: 'time', rating: 1400, oppRating: 1600, moves: 3 })
    expect(r.opening).toBe('Sicilienne (Alapin / Smith-Morra)')
    expect(r.variation).toBe('Sicilian Defense Alapin Variation')
  })

  it('takes the ending from the loser on a win, and the draw kind on a draw', () => {
    expect(toRow(game({ mine: 'win', theirs: 'checkmated' }), 'Me')!.ending).toBe('checkmate')
    expect(toRow(game({ mine: 'repetition', theirs: 'repetition' }), 'me')).toMatchObject({ result: 'draw', ending: 'repetition' })
  })

  it('cuts the line name where the moves start', () => {
    const eco = 'https://www.chess.com/openings/Reti-Opening-Nimzo-Larsen-Variation...5.Be2-d6'
    expect(toRow(game({ eco }), 'me')!.variation).toBe('Reti Opening Nimzo Larsen Variation')
  })

  it('keeps the variant name, skips games of someone else', () => {
    expect(toRow(game({ rules: 'chess960' }), 'me')).toMatchObject({ rules: 'chess960', opponent: 'opp' })
    expect(toRow(game({}), 'someone')).toBeNull()
  })

  it('sorts the rows oldest first', () => {
    const rows = historyRows([game({ end_time: 30 }), game({ end_time: 10 }), game({ rules: 'bughouse' })], 'me')
    expect(rows.map(r => r.end)).toEqual([10_000, 30_000])
  })
})

describe('computeResults', () => {
  const opts = { hourOf: () => 20, dayOf: (ms: number) => String(Math.floor(ms / 86_400_000)) }

  it('counts results, colours, endings and short losses', () => {
    const s = computeResults([
      row({ result: 'win', ending: 'time' }),
      row({ result: 'loss', ending: 'checkmate', moves: 18, color: 'black' }),
      row({ result: 'draw', ending: 'agreed', color: 'black' }),
    ], opts)
    expect(s.all).toEqual({ w: 1, d: 1, l: 1 })
    expect(scoreOf(s.all)).toBeCloseTo(0.5)
    expect(s.byColor.black).toEqual({ w: 0, d: 1, l: 1 })
    expect(s.winsBy).toEqual({ time: 1 })
    expect(s.lossesBy).toEqual({ checkmate: 1 })
    expect(s.drawsBy).toEqual({ agreed: 1 })
    expect(s.shortLosses).toBe(1)
    expect(s.avgMoves).toBeCloseTo((30 + 18 + 30) / 3)
  })

  it('tracks the rating from the last game before the window', () => {
    const s = computeResults([row({ rating: 1510 }), row({ rating: 1540 }), row({ rating: 1530, rated: false })], { ...opts, before: { blitz: 1500 } })
    expect(s.ratings).toEqual([{ timeClass: 'blitz', games: 2, start: 1500, end: 1540, delta: 40, peak: 1540, series: [1500, 1510, 1540] }])
  })

  it('downsamples a long rating series', () => {
    const rows = Array.from({ length: 200 }, (_, i) => row({ rating: 1000 + i }))
    const t = computeResults(rows, opts).ratings[0]
    expect(t.series).toHaveLength(40)
    expect(t.series[t.series.length - 1]).toBe(1199)
  })

  it('buckets by rating gap with the expected score', () => {
    const s = computeResults([row({ oppRating: 1800 }), row({ oppRating: 1520, result: 'loss' })], opts)
    const strong = s.gaps.find(g => g.id === 'much-stronger')!
    expect(strong).toMatchObject({ w: 1, d: 0, l: 0 })
    expect(strong.expected).toBeCloseTo(expectedScore(300))
    expect(strong.expected).toBeLessThan(0.2)
    expect(s.gaps.find(g => g.id === 'even')!.l).toBe(1)
  })

  it('splits live games played right after a loss', () => {
    const min = 60_000
    const s = computeResults([
      row({ end: 0, result: 'loss' }),
      row({ end: 10 * min, result: 'loss' }),
      row({ end: 20 * min, result: 'win' }),
      row({ end: 200 * min, result: 'draw' }),
      row({ end: 201 * min, result: 'win', timeClass: 'daily' }),
    ], opts)
    expect(s.afterLoss).toEqual({ w: 1, d: 0, l: 1 })
    expect(s.otherwise).toEqual({ w: 0, d: 1, l: 1 })
    expect(s.dayParts.find(p => p.id === 'evening')).toMatchObject({ w: 1, d: 1, l: 2 })
  })

  it('groups openings by colour and family, variations inside', () => {
    const s = computeResults([
      row({ opening: 'Italian Game', variation: 'Italian Game Two Knights' }),
      row({ opening: 'Italian Game', variation: 'Giuoco Piano', result: 'loss' }),
      row({ opening: 'Italian Game', variation: 'Giuoco Piano' }),
      row({ opening: 'Italian Game', color: 'black' }),
    ], opts)
    expect(s.openings[0]).toMatchObject({ name: 'Italian Game', color: 'white', w: 2, l: 1 })
    expect(s.openings[0].variations[0]).toMatchObject({ name: 'Giuoco Piano', w: 1, l: 1 })
    expect(s.openings[1].color).toBe('black')
  })

  it('counts active days', () => {
    expect(computeResults([row({ end: 0 }), row({ end: 1000 }), row({ end: 2 * 86_400_000 })], opts).activeDays).toBe(2)
  })
})

describe('ratingsBefore', () => {
  it('keeps the last rated rating of each time control before the start', () => {
    const rows = [row({ end: 1, rating: 1400 }), row({ end: 2, rating: 1450 }), row({ end: 3, rating: 1300, timeClass: 'rapid' }), row({ end: 9, rating: 1600 })]
    expect(ratingsBefore(rows, 5)).toEqual({ blitz: 1450, rapid: 1300 })
    expect(ratingsBefore(rows, null)).toEqual({})
  })
})

describe('clearGap', () => {
  it('tells a real gap from noise', () => {
    expect(clearGap(0.73, 15, 0.9, 15)).toBe(false)
    expect(clearGap(0.73, 300, 0.9, 300)).toBe(true)
    expect(clearGap(0.4, 10, 0.15, null)).toBe(true)
    expect(clearGap(0.5, 0, 0.1, 10)).toBe(false)
  })
})

describe('resultsInsights', () => {
  const opts = { hourOf: () => 20, dayOf: () => 'd' }
  const many = (n: number, over: Partial<GameRow>) => Array.from({ length: n }, () => row(over))

  it('says nothing on a tiny sample', () => {
    expect(resultsInsights(computeResults(many(5, { result: 'loss', ending: 'time' }), opts), null)).toEqual([])
  })

  it('compares time losses with the usual share', () => {
    const cur = computeResults([...many(6, { result: 'loss', ending: 'time' }), ...many(6, { result: 'loss', ending: 'resign' }), ...many(8, {})], opts)
    const base = computeResults([...many(5, { result: 'loss', ending: 'time' }), ...many(20, { result: 'loss', ending: 'resign' }), ...many(20, {})], opts)
    const texts = resultsInsights(cur, base).map(i => i.text)
    expect(texts.some(t => t.startsWith('50\u00a0% de tes défaites sont au temps, contre 20\u00a0% d\'habitude'))).toBe(true)
  })

  it('flags a weak colour, a weak opening and tilt', () => {
    const min = 60_000
    const rows: GameRow[] = []
    // White: 20 wins. Black: losses in the Caro-Kann, each followed by a loss.
    for (let i = 0; i < 20; i++) rows.push(row({ end: i * 1000 * min }))
    for (let i = 0; i < 20; i++) {
      rows.push(row({ end: (100 + i) * 1000 * min, color: 'black', result: 'loss', opening: 'Caro-Kann Defense' }))
      rows.push(row({ end: (100 + i) * 1000 * min + 5 * min, color: 'black', result: i % 2 ? 'loss' : 'draw', opening: 'Caro-Kann Defense', ending: 'agreed' }))
    }
    const kinds = resultsInsights(computeResults(rows, opts), null)
    const texts = kinds.map(i => i.text).join('\n')
    expect(texts).toContain('Avec les Noirs tu marques')
    expect(texts).toContain('Caro-Kann Defense avec les Noirs')
    expect(texts).toContain('Juste après une défaite')
    expect(kinds.length).toBeLessThanOrEqual(5)
  })

  it('reports a rating gain and a good run against the usual score', () => {
    const cur = computeResults(Array.from({ length: 12 }, (_, i) => row({ rating: 1500 + i * 5 })), { ...opts, before: { blitz: 1490 } })
    const base = computeResults(many(40, { result: 'loss' }).concat(many(40, {})), opts)
    const out = resultsInsights(cur, base)
    expect(out.find(i => i.text.startsWith('+65 Elo en blitz'))?.kind).toBe('strength')
    expect(out.find(i => i.text.startsWith('Bonne période'))?.kind).toBe('strength')
  })

  it('notices over- and under-performance against the rating gap', () => {
    const rows = [...many(10, { oppRating: 1800 }), ...many(10, { oppRating: 1200, result: 'loss' })]
    const texts = resultsInsights(computeResults(rows, opts), null).map(i => i.text).join('\n')
    expect(texts).toContain('Contre plus fort que toi')
    expect(texts).toContain('Contre plus faible que toi')
  })

  it('keeps quiet on a gap a small sample can explain', () => {
    const rows = [...many(4, { end: 1, result: 'loss' }), ...many(11, { end: 1 }), ...many(2, { end: 2, result: 'loss' }), ...many(13, { end: 2 })]
    const hourOf = (ms: number) => (ms === 1 ? 20 : 14)
    expect(resultsInsights(computeResults(rows, { hourOf, dayOf: () => 'd' }), null)).toEqual([])
  })

  it('flags a weak time of day', () => {
    const rows = [...many(15, { end: 1, result: 'loss' }), ...many(15, { end: 2 })]
    const hourOf = (ms: number) => (ms === 1 ? 2 : 14)
    const texts = resultsInsights(computeResults(rows, { hourOf, dayOf: () => 'd' }), null).map(i => i.text)
    expect(texts.some(t => t.startsWith('La nuit tu marques 0\u00a0%'))).toBe(true)
  })
})
