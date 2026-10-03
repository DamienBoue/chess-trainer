// Minimal, allocation-light board model for positional analysis.
//
// chess.js is great for legality, but the strategy layer evaluates every
// position of every analysed game (thousands of FENs for the profile), and
// it only needs piece placement + attack maps. So we parse the FEN once
// into a 64-entry array and generate pseudo-legal attacks ourselves.
//
// Square indexing: a1 = 0, b1 = 1, …, h1 = 7, a2 = 8, …, h8 = 63.
// file = sq & 7, rank = sq >> 3 (both 0-based).

export type Side = 'w' | 'b'
export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k'

export interface Piece {
  color: Side
  type: PieceType
}

export interface Board {
  squares: (Piece | null)[]
  turn: Side
  /** Raw FEN castling field ("KQkq", "-", …). */
  castling: string
  fullmove: number
}

export const FILES = 'abcdefgh'

export const PIECE_VALUE: Record<PieceType, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 }

export const fileOf = (sq: number) => sq & 7
export const rankOf = (sq: number) => sq >> 3
export const sqAt = (file: number, rank: number) => rank * 8 + file
export const onBoard = (file: number, rank: number) => file >= 0 && file < 8 && rank >= 0 && rank < 8
export const opp = (s: Side): Side => (s === 'w' ? 'b' : 'w')
/** +1 for white (towards rank 8), -1 for black. */
export const forward = (s: Side) => (s === 'w' ? 1 : -1)
/** Rank as seen from `side`, 1..8 (a white pawn on e2 and a black pawn on e7 are both on relative rank 2). */
export const relRank = (side: Side, sq: number) => (side === 'w' ? rankOf(sq) + 1 : 8 - rankOf(sq))
/** a1 is dark. */
export const isLightSquare = (sq: number) => (fileOf(sq) + rankOf(sq)) % 2 === 1

export function sqName(sq: number): string {
  return FILES[fileOf(sq)] + (rankOf(sq) + 1)
}

export function sqIndex(name: string): number {
  const f = FILES.indexOf(name[0])
  const r = Number(name[1]) - 1
  if (f < 0 || !(r >= 0 && r < 8)) throw new Error(`bad square ${name}`)
  return sqAt(f, r)
}

export const SIDE_LABEL: Record<Side, string> = { w: 'Blancs', b: 'Noirs' }

const PIECE_CHARS = 'pnbrqk'

export function parseFen(fen: string): Board {
  const [placement, turn = 'w', castling = '-', , , fullmove = '1'] = fen.trim().split(/\s+/)
  const squares: (Piece | null)[] = new Array(64).fill(null)
  const rows = placement.split('/')
  if (rows.length !== 8) throw new Error(`bad FEN placement: ${fen}`)
  for (let i = 0; i < 8; i++) {
    const rank = 7 - i
    let file = 0
    for (const ch of rows[i]) {
      if (ch >= '1' && ch <= '8') { file += Number(ch); continue }
      const lower = ch.toLowerCase()
      if (!PIECE_CHARS.includes(lower) || file > 7) throw new Error(`bad FEN placement: ${fen}`)
      squares[sqAt(file, rank)] = { color: ch === lower ? 'b' : 'w', type: lower as PieceType }
      file++
    }
  }
  return { squares, turn: turn === 'b' ? 'b' : 'w', castling, fullmove: Number(fullmove) || 1 }
}

export function pieceAt(b: Board, sq: number): Piece | null {
  return b.squares[sq]
}

export function isPiece(b: Board, sq: number, color: Side, type: PieceType): boolean {
  const p = b.squares[sq]
  return !!p && p.color === color && p.type === type
}

/** Squares holding pieces of `color` (optionally of one type). */
export function piecesOf(b: Board, color: Side, type?: PieceType): number[] {
  const out: number[] = []
  for (let sq = 0; sq < 64; sq++) {
    const p = b.squares[sq]
    if (p && p.color === color && (!type || p.type === type)) out.push(sq)
  }
  return out
}

export function kingSquare(b: Board, color: Side): number {
  for (let sq = 0; sq < 64; sq++) {
    const p = b.squares[sq]
    if (p && p.color === color && p.type === 'k') return sq
  }
  return -1
}

const KNIGHT_DELTAS: [number, number][] = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]]
const KING_DELTAS: [number, number][] = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]]
const ROOK_DIRS: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]]
const BISHOP_DIRS: [number, number][] = [[1, 1], [1, -1], [-1, 1], [-1, -1]]

function leaper(sq: number, deltas: [number, number][]): number[] {
  const f = fileOf(sq), r = rankOf(sq)
  const out: number[] = []
  for (const [df, dr] of deltas) if (onBoard(f + df, r + dr)) out.push(sqAt(f + df, r + dr))
  return out
}

function slider(b: Board, sq: number, dirs: [number, number][]): number[] {
  const f0 = fileOf(sq), r0 = rankOf(sq)
  const out: number[] = []
  for (const [df, dr] of dirs) {
    let f = f0 + df, r = r0 + dr
    while (onBoard(f, r)) {
      const t = sqAt(f, r)
      out.push(t)
      if (b.squares[t]) break
      f += df; r += dr
    }
  }
  return out
}

/** Squares a pawn of `side` standing on `sq` attacks (diagonally forward). */
export function pawnAttackSquares(side: Side, sq: number): number[] {
  const f = fileOf(sq), r = rankOf(sq) + forward(side)
  const out: number[] = []
  if (r < 0 || r > 7) return out
  if (f > 0) out.push(sqAt(f - 1, r))
  if (f < 7) out.push(sqAt(f + 1, r))
  return out
}

/** Knight jumps from a square (board-independent). */
export function knightSquares(sq: number): number[] {
  return leaper(sq, KNIGHT_DELTAS)
}

export function kingSquares(sq: number): number[] {
  return leaper(sq, KING_DELTAS)
}

/** Pseudo-legal attacks of the piece on `sq` (sliders stop on the first occupied square, included). */
export function attacksFrom(b: Board, sq: number): number[] {
  const p = b.squares[sq]
  if (!p) return []
  switch (p.type) {
    case 'p': return pawnAttackSquares(p.color, sq)
    case 'n': return leaper(sq, KNIGHT_DELTAS)
    case 'k': return leaper(sq, KING_DELTAS)
    case 'b': return slider(b, sq, BISHOP_DIRS)
    case 'r': return slider(b, sq, ROOK_DIRS)
    case 'q': return slider(b, sq, [...ROOK_DIRS, ...BISHOP_DIRS])
  }
}

export interface AttackMaps {
  /** Number of pieces of each side attacking each square. */
  count: Record<Side, Uint8Array>
  /** Squares attacked by at least one pawn of the side. */
  byPawn: Record<Side, Uint8Array>
  /** Value of the cheapest attacker (pawn = 1 … king = 100), 0 when unattacked. */
  cheapest: Record<Side, Uint8Array>
}

export function computeAttacks(b: Board): AttackMaps {
  const maps: AttackMaps = {
    count: { w: new Uint8Array(64), b: new Uint8Array(64) },
    byPawn: { w: new Uint8Array(64), b: new Uint8Array(64) },
    cheapest: { w: new Uint8Array(64), b: new Uint8Array(64) },
  }
  for (let sq = 0; sq < 64; sq++) {
    const p = b.squares[sq]
    if (!p) continue
    const v = p.type === 'k' ? 100 : PIECE_VALUE[p.type]
    for (const t of attacksFrom(b, sq)) {
      maps.count[p.color][t]++
      if (p.type === 'p') maps.byPawn[p.color][t] = 1
      const c = maps.cheapest[p.color][t]
      if (c === 0 || v < c) maps.cheapest[p.color][t] = v
    }
  }
  return maps
}

export interface Material {
  pawns: number
  knights: number
  bishops: number
  rooks: number
  queens: number
  /** Non-pawn material in pawn units (N=B=3, R=5, Q=9). */
  npm: number
  /** Total material in pawn units. */
  total: number
  lightBishops: number
  darkBishops: number
}

export function materialOf(b: Board, side: Side): Material {
  const m: Material = { pawns: 0, knights: 0, bishops: 0, rooks: 0, queens: 0, npm: 0, total: 0, lightBishops: 0, darkBishops: 0 }
  for (let sq = 0; sq < 64; sq++) {
    const p = b.squares[sq]
    if (!p || p.color !== side) continue
    switch (p.type) {
      case 'p': m.pawns++; break
      case 'n': m.knights++; break
      case 'b':
        m.bishops++
        if (isLightSquare(sq)) m.lightBishops++
        else m.darkBishops++
        break
      case 'r': m.rooks++; break
      case 'q': m.queens++; break
    }
  }
  m.npm = 3 * (m.knights + m.bishops) + 5 * m.rooks + 9 * m.queens
  m.total = m.npm + m.pawns
  return m
}

/** Shortest knight path (list of squares, start excluded) from `from` to
 *  `to`, avoiding squares in `blocked` (except the target). Max depth 4.
 *  Returns null when unreachable within the depth. */
export function knightRoute(from: number, to: number, blocked: (sq: number) => boolean, maxDepth = 4): number[] | null {
  if (from === to) return []
  const prev = new Int16Array(64).fill(-1)
  const depth = new Int8Array(64).fill(-1)
  depth[from] = 0
  const queue = [from]
  while (queue.length) {
    const cur = queue.shift()!
    if (depth[cur] >= maxDepth) continue
    for (const nx of knightSquares(cur)) {
      if (depth[nx] !== -1) continue
      if (nx !== to && blocked(nx)) continue
      depth[nx] = depth[cur] + 1
      prev[nx] = cur
      if (nx === to) {
        const path: number[] = []
        let s = to
        while (s !== from) { path.unshift(s); s = prev[s] }
        return path
      }
      queue.push(nx)
    }
  }
  return null
}
