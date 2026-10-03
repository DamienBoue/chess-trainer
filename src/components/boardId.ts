// react-chessboard builds `#${id}-square-e4` CSS selectors when it animates
// a piece. Callers pass game URLs or card keys as board ids ("https://…#12",
// "Italian Game::white::…"), which are invalid selectors: querySelector
// throws in an effect and takes the whole screen down. Keep ids CSS-safe.

export function cssSafeBoardId(id: string | undefined): string | undefined {
  if (!id) return id
  const safe = id.replace(/[^A-Za-z0-9_-]/g, '_')
  return /^[A-Za-z_]/.test(safe) ? safe : `b_${safe}`
}
