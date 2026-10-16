import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockLocalStorage } from '../test-utils/mockLocalStorage'
import type { ChessComGame } from '../types'

vi.mock('./db', () => import('./db.native'))
const { dbTx, dbGetAllByPrefix } = await import('./db.native')
const { addGames, clearGames, loadGame, loadGameRows, loadGames, loadGamesMeta, monthOf, resetGamesMigration } = await import('./games')

const side = (username: string, result: string) => ({ username, result, rating: 1500, '@id': '' })
const game = (url: string, day: string, extra: Partial<ChessComGame> = {}) =>
  ({ url, end_time: Date.parse(day) / 1000, pgn: '', time_class: 'blitz', rules: 'chess', rated: true,
    white: side('Alice', 'win'), black: side('opp', 'resigned'), ...extra }) as ChessComGame

beforeEach(() => {
  vi.stubGlobal('localStorage', mockLocalStorage())
  resetGamesMigration()
})

describe('games by month', () => {
  it('stores each month apart and lists every game newest first', async () => {
    const added = await addGames('Alice', [game('a', '2024-05-02'), game('b', '2024-06-10'), game('c', '2024-05-20')])
    expect(added.map(g => g.url).sort()).toEqual(['a', 'b', 'c'])
    const months = await dbGetAllByPrefix<{ key: string; month: string }>('gameMonths', 'alice|')
    expect(months.map(m => m.month).sort()).toEqual(['2024-05', '2024-06'])
    expect((await loadGames('alice')).map(g => g.url)).toEqual(['b', 'c', 'a'])
    expect(loadGamesMeta('alice')).toEqual({ newest: Date.parse('2024-06-10') / 1000, count: 3 })
  })

  it('returns only the new games, the incoming copy replacing a stored one', async () => {
    await addGames('alice', [game('a', '2024-05-02', { time_class: 'rapid' })])
    const added = await addGames('alice', [game('a', '2024-05-02', { time_class: 'blitz' }), game('d', '2024-05-03')])
    expect(added.map(g => g.url)).toEqual(['d'])
    const all = await loadGames('alice')
    expect(all).toHaveLength(2)
    expect(all.find(g => g.url === 'a')!.time_class).toBe('blitz')
    expect(loadGamesMeta('alice').count).toBe(2)
  })

  it('keeps concurrent writes to the same month', async () => {
    await Promise.all([addGames('alice', [game('a', '2024-05-02')]), addGames('alice', [game('b', '2024-05-03')])])
    expect((await loadGames('alice')).map(g => g.url).sort()).toEqual(['a', 'b'])
  })

  it('moves the older one-record layout to months', async () => {
    await dbTx('games', 'readwrite', s => s.put({ username: 'alice', games: [game('a', '2024-05-02'), game('b', '2023-01-02')] }))
    expect((await loadGames('alice')).map(g => g.url)).toEqual(['a', 'b'])
    expect(await dbTx('games', 'readonly', s => s.get('alice'))).toBeUndefined()
    expect(loadGamesMeta('alice').count).toBe(2)
  })

  it('clears one user only', async () => {
    await addGames('alice', [game('a', '2024-05-02')])
    await addGames('bob', [game('b', '2024-05-02')])
    await clearGames('alice')
    expect(await loadGames('alice')).toEqual([])
    expect(await loadGames('bob')).toHaveLength(1)
  })

  it('keeps a row per game, rewritten with its month', async () => {
    await addGames('alice', [game('a', '2024-05-02'), game('b', '2024-06-10', { rules: 'chess960' })])
    await addGames('alice', [game('c', '2024-05-03', { white: side('opp', 'win'), black: side('Alice', 'timeout') })])
    const rows = await loadGameRows('alice')
    expect(rows.map(r => [r.url, r.result, r.rules])).toEqual([['b', 'win', 'chess960'], ['c', 'loss', 'chess'], ['a', 'win', 'chess']])
    expect(rows[1]).toMatchObject({ color: 'black', opponent: 'opp', ending: 'time' })
  })

  it('reads one game from its month', async () => {
    await addGames('alice', [game('a', '2024-05-02'), game('b', '2024-05-09')])
    expect((await loadGame('alice', 'b', Date.parse('2024-05-09') / 1000))?.url).toBe('b')
    expect(await loadGame('alice', 'b', Date.parse('2024-04-09') / 1000)).toBeUndefined()
  })

  it('names months in UTC', () => {
    expect(monthOf(game('a', '2024-05-31T23:30:00Z'))).toBe('2024-05')
  })
})
