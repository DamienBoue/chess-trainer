import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockLocalStorage } from '../test-utils/mockLocalStorage'
import { buildGame } from '../analysis/__fixtures__'

vi.mock('./db', () => import('./db.native'))
const { dbTx } = await import('./db.native')
const { clearAnalyses, loadAnalyses, loadAnalysesOf, resetAnalysesMigration, saveAnalyses } = await import('./analyses')

beforeEach(() => {
  vi.stubGlobal('localStorage', mockLocalStorage())
  resetAnalysesMigration()
})

describe('analyses, one record per game', () => {
  it('saves, reads all, reads some, replaces', async () => {
    const a = buildGame({ url: 'g1', moves: [] })
    const b = buildGame({ url: 'g2', moves: [] })
    await saveAnalyses('Alice', [a, b])
    expect(Object.keys(await loadAnalyses('alice')).sort()).toEqual(['g1', 'g2'])
    expect((await loadAnalysesOf('alice', ['g2', 'nope'])).map(x => x.url)).toEqual(['g2'])
    await saveAnalyses('alice', [{ ...a, opponent: 'again' }])
    expect((await loadAnalyses('alice')).g1.opponent).toBe('again')
  })

  it('moves the older one-record layout, once', async () => {
    const a = buildGame({ url: 'g1', moves: [] })
    await dbTx('analyses', 'readwrite', s => s.put({ username: 'alice', analyses: { g1: a } }))
    expect(Object.keys(await loadAnalyses('alice'))).toEqual(['g1'])
    expect(await dbTx('analyses', 'readonly', s => s.get('alice'))).toBeUndefined()
  })

  it('clears one user only', async () => {
    await saveAnalyses('alice', [buildGame({ url: 'g1', moves: [] })])
    await saveAnalyses('bob', [buildGame({ url: 'g2', moves: [] })])
    await clearAnalyses('alice')
    expect(await loadAnalyses('alice')).toEqual({})
    expect(Object.keys(await loadAnalyses('bob'))).toEqual(['g2'])
  })
})
