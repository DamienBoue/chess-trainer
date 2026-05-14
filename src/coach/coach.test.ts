import { beforeEach, describe, expect, it, vi } from 'vitest'
import { explainBlunder, reviewGame, summariseDailyPlan, llmAvailable } from './coach'
import { saveLlmConfig } from './config'
import { buildGame } from '../analysis/__fixtures__'
import { BRACKETS } from '../skill/elo'

function mockLocalStorage() {
  const store = new Map<string, string>()
  return {
    getItem: (k: string) => store.has(k) ? store.get(k)! : null,
    setItem: (k: string, v: string) => { store.set(k, v) },
    removeItem: (k: string) => { store.delete(k) },
    clear: () => store.clear(),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() { return store.size },
  } as Storage
}

describe('llmAvailable', () => {
  beforeEach(() => { vi.stubGlobal('localStorage', mockLocalStorage()) })

  it('false until a key is configured', () => {
    expect(llmAvailable()).toBe(false)
  })

  it('true once a provider + key are set', () => {
    saveLlmConfig({ provider: 'anthropic', apiKey: 'sk-x', model: '' })
    expect(llmAvailable()).toBe(true)
  })
})

describe('explainBlunder prompt', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', mockLocalStorage())
    saveLlmConfig({ provider: 'anthropic', apiKey: 'sk-x', model: '' })
  })

  it('includes the FEN, played move, classification, best move and PV in the prompt', async () => {
    const seen: { system?: string; user?: string } = {}
    vi.stubGlobal('fetch', vi.fn(async (_url, init: { body: string }) => {
      const body = JSON.parse(init.body) as { system: string; messages: Array<{ content: string }> }
      seen.system = body.system
      seen.user   = body.messages[0].content
      return new Response(JSON.stringify({ content: [{ type: 'text', text: 'mock' }] }), { status: 200 })
    }))

    const g = buildGame({
      opening: 'Italian Game',
      moves: [{
        ply: 9, san: 'Bxh6', cpLoss: 350, classification: 'blunder',
        bestMoveSan: 'Nf3', bestLineSan: 'Nf3 Nc6 Bb5',
        fenBefore: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1',
      }],
    })
    await explainBlunder(g, g.moves[0])

    expect(seen.user).toContain('Bxh6')
    expect(seen.user).toContain('Nf3')
    expect(seen.user).toContain('Nf3 Nc6 Bb5')
    expect(seen.user).toContain('blunder')
    expect(seen.user).toContain('cpLoss 350')
    expect(seen.user).toContain('rnbqkbnr')
    expect(seen.user).toContain('Italian Game')
  })
})

describe('reviewGame prompt', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', mockLocalStorage())
    saveLlmConfig({ provider: 'anthropic', apiKey: 'sk-x', model: '' })
  })

  it('includes the top user mistakes in the prompt', async () => {
    let prompt = ''
    vi.stubGlobal('fetch', vi.fn(async (_url, init: { body: string }) => {
      const body = JSON.parse(init.body) as { messages: Array<{ content: string }> }
      prompt = body.messages[0].content
      return new Response(JSON.stringify({ content: [{ type: 'text', text: 'mock' }] }), { status: 200 })
    }))

    const g = buildGame({
      userColor: 'white', result: 'loss', opponent: 'kasparov',
      moves: [
        { ply: 9,  san: 'h3',   cpLoss: 200, classification: 'mistake', bestMoveSan: 'Nf3' },
        { ply: 11, san: 'Qxh7', cpLoss: 600, classification: 'blunder', bestMoveSan: 'Be3' },
        { ply: 13, san: 'Kf2',  cpLoss: 50,  classification: 'good' }, // shouldn't appear
      ],
    })
    await reviewGame(g)

    expect(prompt).toContain('Qxh7')   // top blunder
    expect(prompt).toContain('h3')     // mistake
    expect(prompt).toContain('kasparov')
    expect(prompt).not.toContain('Kf2') // good move excluded
  })
})

describe('summariseDailyPlan prompt', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', mockLocalStorage())
    saveLlmConfig({ provider: 'anthropic', apiKey: 'sk-x', model: '' })
  })

  it('includes every plan item in the prompt', async () => {
    let prompt = ''
    vi.stubGlobal('fetch', vi.fn(async (_url, init: { body: string }) => {
      const body = JSON.parse(init.body) as { messages: Array<{ content: string }> }
      prompt = body.messages[0].content
      return new Response(JSON.stringify({ content: [{ type: 'text', text: 'mock' }] }), { status: 200 })
    }))

    const items = [
      { id: '1', kind: 'daily',          title: 'Quotidien',          subtitle: 'sub', estMinutes: 2, priority: 80, target: 'daily' as const },
      { id: '2', kind: 'srs-exercises',  title: 'SRS · 5',            subtitle: 'sub', estMinutes: 5, priority: 100, target: 'exercises' as const },
    ]
    const bracket = BRACKETS.find(b => b.id === 'casual')!
    await summariseDailyPlan(items, bracket)

    expect(prompt).toContain('Quotidien')
    expect(prompt).toContain('SRS · 5')
    expect(prompt).toContain('Joueur loisir') // bracket.label, not id
  })
})
