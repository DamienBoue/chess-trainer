import { afterEach, describe, expect, it, vi } from 'vitest'
import { getGamesSince } from './chesscom'

const ARCHIVES = 'https://api.chess.com/pub/player/alice/games/archives'
const month = (m: string) => `https://api.chess.com/pub/player/alice/games/${m}`
const game = (id: number, endTime: number) => ({ url: `https://www.chess.com/game/live/${id}`, end_time: endTime })
const t = (iso: string) => Date.parse(iso) / 1000

function serve(routes: Record<string, unknown>) {
  const calls: string[] = []
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    calls.push(url)
    return new Response(JSON.stringify(routes[url]), { status: url in routes ? 200 : 404 })
  }))
  return calls
}

afterEach(() => { vi.unstubAllGlobals() })

describe('getGamesSince', () => {
  it('returns the games finished after the last known one, newest first, reading only the months since', async () => {
    const calls = serve({
      [ARCHIVES]: { archives: [month('2026/08'), month('2026/09'), month('2026/10')] },
      [month('2026/09')]: { games: [game(1, t('2026-09-02')), game(2, t('2026-09-28'))] },
      [month('2026/10')]: { games: [game(3, t('2026-10-03')), game(4, t('2026-10-15'))] },
    })
    const games = await getGamesSince('alice', t('2026-09-20'))
    expect(games.map(g => g.url.split('/').pop())).toEqual(['4', '3', '2'])
    expect(calls).not.toContain(month('2026/08'))
  })

  it('returns nothing when no game was played since', async () => {
    serve({ [ARCHIVES]: { archives: [month('2026/10')] }, [month('2026/10')]: { games: [game(1, t('2026-10-01'))] } })
    expect(await getGamesSince('alice', t('2026-10-01'))).toEqual([])
  })
})
