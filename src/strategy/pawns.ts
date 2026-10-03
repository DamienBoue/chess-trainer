// Pawn-structure facts for both sides.
//
// Definitions follow Stockfish's classical (pre-NNUE) evaluation, which is
// the most battle-tested codification of the textbook terms:
//   * isolated  — no friendly pawn on an adjacent file
//   * backward  — not isolated, no friendly pawn on an adjacent file level
//                 with or behind it, and its stop square is hit by an enemy
//                 pawn (or an enemy pawn sits right in front of it)
//   * passed    — no enemy pawn in front on the same or adjacent files
//   * attack span — squares this side's pawns can still attack one day
//                 (a pawn can't jump over an opposing pawn, and a backward
//                 pawn can't safely advance), used to find holes/outposts
//
// Everything here is pure and cheap: it runs on every ply of every game
// when the strategic profile is built.

import { type Board, type Side, fileOf, rankOf, sqAt, onBoard, forward, opp, pawnAttackSquares } from './board'

export interface PawnFacts {
  sq: number
  side: Side
  isolated: boolean
  doubled: boolean
  backward: boolean
  passed: boolean
  protectedPassed: boolean
  /** Passed pawn at least 3 files away from every enemy pawn. */
  outsidePassed: boolean
  /** Unopposed, not yet passed, but with enough friendly helpers to force through. */
  candidate: boolean
  supported: boolean
  phalanx: boolean
  connected: boolean
  /** An enemy pawn stands somewhere in front on the same file. */
  opposed: boolean
  /** An enemy pawn stands directly in front. */
  blocked: boolean
}

export interface SidePawns {
  side: Side
  pawns: PawnFacts[]
  fileCounts: number[]
  /** Groups of adjacent files holding this side's pawns. */
  islands: number[][]
  /** Files where this side has no pawn but the opponent has (good files for this side's rooks). */
  halfOpenFiles: number[]
  /** Squares attacked by this side's pawns right now. */
  attacks: Uint8Array
  /** Squares this side's pawns can still attack in the future (Stockfish 12 "pawnAttacksSpan"). */
  attackSpan: Uint8Array
  /** Pawn counts per wing: queenside a–c, center d–e, kingside f–h. */
  wings: { queenside: number; center: number; kingside: number }
}

export interface PawnChain {
  side: Side
  /** From base (rearmost) to head (most advanced). */
  squares: number[]
  base: number
  head: number
  /** Direction the chain points to — Nimzowitsch: attack on that wing. */
  pointsTo: 'kingside' | 'queenside'
  /** Head blocked by an enemy pawn → a locked chain. */
  locked: boolean
}

export interface Lever {
  side: Side
  /** Pawn that can capture. */
  from: number
  /** Enemy pawn it attacks. */
  target: number
}

export interface PawnStructure {
  w: SidePawns
  b: SidePawns
  openFiles: number[]
  /** Pawn tensions on the board right now (each attacking pawn listed). */
  levers: Lever[]
  chains: PawnChain[]
}

const relRankOf = (side: Side, sq: number) => (side === 'w' ? rankOf(sq) + 1 : 8 - rankOf(sq))

const isPawn = (b: Board, f: number, r: number, side: Side) => {
  if (!onBoard(f, r)) return false
  const p = b.squares[sqAt(f, r)]
  return !!p && p.type === 'p' && p.color === side
}

/** Ranks strictly in front of `r` for `side`, as an inclusive [from, to] range in absolute ranks. */
function aheadRange(side: Side, r: number): [number, number] {
  return side === 'w' ? [r + 1, 7] : [0, r - 1]
}

function pawnsOnFileInRange(b: Board, side: Side, f: number, lo: number, hi: number): number[] {
  const out: number[] = []
  if (f < 0 || f > 7) return out
  for (let r = lo; r <= hi; r++) if (isPawn(b, f, r, side)) out.push(r)
  return out
}

function analyzeSide(b: Board, side: Side): SidePawns {
  const them = opp(side)
  const fwd = forward(side)
  const fileCounts = new Array(8).fill(0)
  const theirFileCounts = new Array(8).fill(0)
  const own: number[] = []
  const enemyFiles: number[] = []
  for (let sq = 0; sq < 64; sq++) {
    const p = b.squares[sq]
    if (!p || p.type !== 'p') continue
    if (p.color === side) { fileCounts[fileOf(sq)]++; own.push(sq) }
    else { theirFileCounts[fileOf(sq)]++; enemyFiles.push(fileOf(sq)) }
  }

  const attacks = new Uint8Array(64)
  const attackSpan = new Uint8Array(64)
  const pawns: PawnFacts[] = []

  for (const sq of own) {
    const f = fileOf(sq), r = rankOf(sq)
    const [lo, hi] = aheadRange(side, r)
    const neighbours = (fileCounts[f - 1] ?? 0) + (fileCounts[f + 1] ?? 0)
    const isolated = neighbours === 0
    const doubled = fileCounts[f] > 1
    const opposedRanks = pawnsOnFileInRange(b, them, f, lo, hi)
    const opposed = opposedRanks.length > 0
    const stoppers = opposedRanks.length
      + pawnsOnFileInRange(b, them, f - 1, lo, hi).length
      + pawnsOnFileInRange(b, them, f + 1, lo, hi).length
    const passed = stoppers === 0
    const blocked = isPawn(b, f, r + fwd, them)
    const phalanx = isPawn(b, f - 1, r, side) || isPawn(b, f + 1, r, side)
    const supported = isPawn(b, f - 1, r - fwd, side) || isPawn(b, f + 1, r - fwd, side)

    // Friendly pawns on adjacent files level with or behind this one.
    let helpersBehind = 0
    for (const af of [f - 1, f + 1]) {
      if (af < 0 || af > 7) continue
      for (let rr = 0; rr < 8; rr++) {
        if (!isPawn(b, af, rr, side)) continue
        if (side === 'w' ? rr <= r : rr >= r) helpersBehind++
      }
    }
    const stopAttacked = isPawn(b, f - 1, r + 2 * fwd, them) || isPawn(b, f + 1, r + 2 * fwd, them)
    const backward = !isolated && helpersBehind === 0 && (stopAttacked || blocked)

    const sentries = pawnsOnFileInRange(b, them, f - 1, lo, hi).length + pawnsOnFileInRange(b, them, f + 1, lo, hi).length
    const candidate = !passed && !opposed && helpersBehind >= sentries

    let outsidePassed = false
    if (passed && enemyFiles.length > 0) {
      outsidePassed = enemyFiles.every(ef => Math.abs(ef - f) >= 3)
    }

    pawns.push({
      sq, side, isolated, doubled, backward, passed,
      protectedPassed: passed && supported,
      outsidePassed,
      candidate,
      supported, phalanx,
      connected: supported || phalanx,
      opposed, blocked,
    })

    for (const t of pawnAttackSquares(side, sq)) attacks[t] = 1

    // Attack span: backward pawns (not in a phalanx) are considered stuck;
    // an opposed pawn can only advance up to the enemy pawn in front of it.
    if (!backward || phalanx) {
      const frontmost = opposed
        ? (side === 'w' ? Math.min(...opposedRanks) : Math.max(...opposedRanks))
        : (side === 'w' ? 7 : 0)
      for (let rr = r + fwd; side === 'w' ? rr <= frontmost : rr >= frontmost; rr += fwd) {
        if (f > 0) attackSpan[sqAt(f - 1, rr)] = 1
        if (f < 7) attackSpan[sqAt(f + 1, rr)] = 1
      }
    }
  }

  const islands: number[][] = []
  let cur: number[] = []
  for (let f = 0; f < 8; f++) {
    if (fileCounts[f] > 0) cur.push(f)
    else if (cur.length) { islands.push(cur); cur = [] }
  }
  if (cur.length) islands.push(cur)

  const halfOpenFiles: number[] = []
  for (let f = 0; f < 8; f++) if (fileCounts[f] === 0 && theirFileCounts[f] > 0) halfOpenFiles.push(f)

  const wings = {
    queenside: fileCounts[0] + fileCounts[1] + fileCounts[2],
    center: fileCounts[3] + fileCounts[4],
    kingside: fileCounts[5] + fileCounts[6] + fileCounts[7],
  }

  return { side, pawns, fileCounts, islands, halfOpenFiles, attacks, attackSpan, wings }
}

function findChains(b: Board, side: Side): PawnChain[] {
  const fwd = forward(side)
  const them = opp(side)
  const chains: PawnChain[] = []
  // A chain is a maximal diagonal line of mutually supporting pawns.
  for (const df of [-1, 1]) {
    for (let sq = 0; sq < 64; sq++) {
      const p = b.squares[sq]
      if (!p || p.type !== 'p' || p.color !== side) continue
      const f = fileOf(sq), r = rankOf(sq)
      // Only start from the base of a line (no pawn diagonally behind in this direction).
      if (isPawn(b, f - df, r - fwd, side)) continue
      const line = [sq]
      let cf = f + df, cr = r + fwd
      while (isPawn(b, cf, cr, side)) { line.push(sqAt(cf, cr)); cf += df; cr += fwd }
      // A pawn still on its starting square isn't part of the chain proper
      // (KID: the chain is d6-e5, not c7-d6-e5 — c4-c5 hits its base d6).
      while (line.length > 2 && relRankOf(side, line[0]) === 2) line.shift()
      if (line.length < 2) continue
      const head = line[line.length - 1]
      chains.push({
        side,
        squares: line,
        base: line[0],
        head,
        pointsTo: df > 0 ? 'kingside' : 'queenside',
        locked: isPawn(b, fileOf(head), rankOf(head) + fwd, them),
      })
    }
  }
  return chains
}

export function analyzePawns(b: Board): PawnStructure {
  const w = analyzeSide(b, 'w')
  const bl = analyzeSide(b, 'b')
  const openFiles: number[] = []
  for (let f = 0; f < 8; f++) if (w.fileCounts[f] === 0 && bl.fileCounts[f] === 0) openFiles.push(f)
  const levers: Lever[] = []
  for (const side of ['w', 'b'] as Side[]) {
    const mine = side === 'w' ? w : bl
    for (const p of mine.pawns) {
      for (const t of pawnAttackSquares(side, p.sq)) {
        const q = b.squares[t]
        if (q && q.type === 'p' && q.color !== side) levers.push({ side, from: p.sq, target: t })
      }
    }
  }
  return { w, b: bl, openFiles, levers, chains: [...findChains(b, 'w'), ...findChains(b, 'b')] }
}

/** The chain that matters most for planning: longest locked chain touching
 *  the d/e files, ties broken by a central base. */
export function mainChain(ps: PawnStructure, side: Side): PawnChain | null {
  const central = (sq: number) => fileOf(sq) === 3 || fileOf(sq) === 4
  const candidates = ps.chains.filter(c => c.side === side && c.locked && c.squares.some(central))
  if (candidates.length === 0) return null
  candidates.sort((a, b) =>
    (b.squares.length - a.squares.length)
    || (Number(central(b.base)) - Number(central(a.base))))
  return candidates[0]
}

export function sidePawns(ps: PawnStructure, side: Side): SidePawns {
  return side === 'w' ? ps.w : ps.b
}

/** True if `side` has a pawn on the (absolute) square. */
export function hasPawn(b: Board, side: Side, sq: number): boolean {
  const p = b.squares[sq]
  return !!p && p.type === 'p' && p.color === side
}

