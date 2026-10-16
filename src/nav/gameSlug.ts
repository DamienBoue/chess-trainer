// Short, stable id of a game for routes (/partie/<slug>): "live-123456789"
// for a chess.com game, an encoded URL otherwise.

export function gameSlug(url: string): string {
  const m = url.match(/chess\.com\/game\/(live|daily)\/(\d+)/)
  return m ? `${m[1]}-${m[2]}` : `u-${encodeURIComponent(url)}`
}

export function findGameBySlug<T extends { url: string }>(games: T[], slug: string): T | undefined {
  return games.find(g => gameSlug(g.url) === slug)
}
