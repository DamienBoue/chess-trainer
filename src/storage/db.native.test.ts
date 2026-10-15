import { beforeEach, describe, expect, it, vi } from 'vitest'
import { dbTx } from './db.native'
import { mockLocalStorage } from '../test-utils/mockLocalStorage'

beforeEach(() => { vi.stubGlobal('localStorage', mockLocalStorage()) })

describe('dbTx on phones (localStorage-backed)', () => {
  it('puts, gets, lists and deletes records by their key path', async () => {
    await dbTx('analyses', 'readwrite', s => s.put({ username: 'alice', analyses: { g1: 1 } }))
    await dbTx('analyses', 'readwrite', s => s.put({ username: 'bob', analyses: {} }))
    await dbTx('analyses', 'readwrite', s => s.put({ username: 'alice', analyses: { g1: 2 } }))
    expect(await dbTx('analyses', 'readonly', s => s.get('alice'))).toEqual({ username: 'alice', analyses: { g1: 2 } })
    expect(await dbTx('analyses', 'readonly', s => s.getAll())).toHaveLength(2)
    await dbTx('analyses', 'readwrite', s => s.delete('alice'))
    expect(await dbTx('analyses', 'readonly', s => s.get('alice'))).toBeUndefined()
    expect(await dbTx('analyses', 'readonly', s => s.getAll())).toEqual([{ username: 'bob', analyses: {} }])
  })
})
