import { describe, expect, it } from 'vitest'
import { attachEngineHost, createTransport, receiveFromEngineHost, type ToEnginePage } from './transport.native'

describe('phone engine transport (WebView bridge)', () => {
  it('queues until the page is ready, routes lines, and restarts engines when the page is reloaded', () => {
    const engine = createTransport()
    const lines: string[] = []
    let resets = 0
    engine.onLine(l => lines.push(l))
    engine.onReset!(() => { resets++ })
    engine.post('uci')

    // First page: everything queued so far goes through, in order.
    const first: ToEnginePage[] = []
    attachEngineHost({ send: m => first.push(m) })
    expect(first).toEqual([{ type: 'create', id: 1 }, { type: 'cmd', id: 1, cmd: 'uci' }])
    receiveFromEngineHost(JSON.stringify({ id: 1, line: 'uciok' }))
    receiveFromEngineHost(JSON.stringify({ id: 2, line: 'not mine' }))
    expect(lines).toEqual(['uciok'])

    // The OS kills the page: commands wait, then the reloaded page gets a
    // fresh worker, the stale commands are dropped and the engine restarts.
    attachEngineHost(null)
    engine.post('go depth 12')
    const second: ToEnginePage[] = []
    attachEngineHost({ send: m => second.push(m) })
    expect(second).toEqual([{ type: 'create', id: 1 }])
    expect(resets).toBe(1)
  })
})
