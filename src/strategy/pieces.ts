// Piece-level and king-level positional factors: bishops (good/bad, pair),
// knights, rooks (files, 7th rank), king safety, development, space and
// mobility. Formulas are simplified versions of Stockfish's classical
// evaluation terms, with thresholds tuned to produce *teachable* verdicts
// rather than centipawns.

import {
  type AttackMaps, type Board, type Material, type PieceType, type Side,
  FILES, fileOf, rankOf, sqAt, forward, relRank, opp, isLightSquare, kingSquare, piecesOf, attacksFrom, materialOf, kingSquares,
} from './board'
import type { PawnStructure } from './pawns'

export type Phase = 'opening' | 'middlegame' | 'endgame'

export function detectPhase(b: Board, mw: Material, mb: Material): Phase {
  const total = mw.npm + mb.npm
  if ((mw.queens + mb.queens === 0 && mw.npm <= 13 && mb.npm <= 13) || total <= 20) return 'endgame'
  if (b.fullmove <= 10) {
    const undeveloped = undevelopedMinors(b, 'w').length + undevelopedMinors(b, 'b').length
    if (undeveloped >= 3 || b.fullmove <= 6) return 'opening'
  }
  return 'middlegame'
}

// ---------------- Development ----------------

const START_MINORS: Record<Side, { sq: number; type: PieceType }[]> = {
  w: [{ sq: 1, type: 'n' }, { sq: 6, type: 'n' }, { sq: 2, type: 'b' }, { sq: 5, type: 'b' }],
  b: [{ sq: 57, type: 'n' }, { sq: 62, type: 'n' }, { sq: 58, type: 'b' }, { sq: 61, type: 'b' }],
}

export function undevelopedMinors(b: Board, side: Side): number[] {
  return START_MINORS[side]
    .filter(({ sq, type }) => { const p = b.squares[sq]; return !!p && p.color === side && p.type === type })
    .map(x => x.sq)
}

export interface KingSafety {
  side: Side
  king: number
  /** King tucked on a wing (castled or walked there). */
  castled: boolean
  /** King still on d/e/f files of its back two ranks. */
  inCenter: boolean
  canCastle: boolean
  /** Shield files with no own pawn on relative ranks 2-3 in front of the king. */
  missingShield: number[]
  /** Own shield pawns pushed to relative rank 4+ (weakening). */
  advancedShield: number[]
  /** Files next to the king with no own pawn at all. */
  openFilesNearKing: number[]
  /** Enemy pawns advancing on the king's files (relative ranks 4-6 from the defender's view). */
  stormPawns: number[]
  /** Distinct enemy pieces (not pawns) hitting the king zone. */
  attackers: number
  attackersIncludeQueen: boolean
  /** 0 (fortress) … 10 (on fire). */
  danger: number
}

function castlingRights(b: Board, side: Side): boolean {
  const c = b.castling
  return side === 'w' ? /[KQ]/.test(c) : /[kq]/.test(c)
}

export function analyzeKingSafety(b: Board, side: Side, ps: PawnStructure, phase: Phase): KingSafety {
  const them = opp(side)
  const king = kingSquare(b, side)
  const kf = fileOf(king)
  const rr = king >= 0 ? relRank(side, king) : 1
  const castled = rr <= 2 && (kf <= 2 || kf >= 6)
  const inCenter = rr <= 2 && kf >= 3 && kf <= 5
  const shieldFiles = [kf - 1, kf, kf + 1].filter(f => f >= 0 && f <= 7)
  const fwd = forward(side)
  const missingShield: number[] = []
  const advancedShield: number[] = []
  const openFilesNearKing: number[] = []
  const stormPawns: number[] = []
  const mine = side === 'w' ? ps.w : ps.b
  for (const f of shieldFiles) {
    if (mine.fileCounts[f] === 0) openFilesNearKing.push(f)
    let shield = false
    for (const p of mine.pawns) {
      if (fileOf(p.sq) !== f) continue
      const pr = relRank(side, p.sq)
      if (pr <= 3 && (side === 'w' ? rankOf(p.sq) > rankOf(king) : rankOf(p.sq) < rankOf(king))) shield = true
      else if (pr >= 4 && castled) advancedShield.push(p.sq)
    }
    if (!shield) missingShield.push(f)
    if (!castled) continue
    for (let r = 0; r < 8; r++) {
      const sq = sqAt(f, r)
      const p = b.squares[sq]
      if (!p || p.type !== 'p' || p.color !== them) continue
      const fromDefender = relRank(side, sq)
      if (fromDefender >= 4 && fromDefender <= 6) stormPawns.push(sq)
    }
  }

  // King zone: the king's square, its neighbours, and the squares two
  // ranks in front (where attacks against a castled king land).
  const zone = new Set<number>([king, ...kingSquares(king)])
  for (const f of shieldFiles) {
    const r2 = rankOf(king) + 2 * fwd
    if (r2 >= 0 && r2 < 8) zone.add(sqAt(f, r2))
  }
  let attackers = 0
  let attackersIncludeQueen = false
  for (const sq of piecesOf(b, them)) {
    const p = b.squares[sq]!
    if (p.type === 'p' || p.type === 'k') continue
    if (attacksFrom(b, sq).some(t => zone.has(t))) {
      attackers++
      if (p.type === 'q') attackersIncludeQueen = true
    }
  }
  let danger = 0
  if (phase !== 'endgame') {
    const attackWeight = attackers * (attackersIncludeQueen ? 1.5 : 1)
    if (inCenter) {
      // A king in the middle is fine while it can still castle and the
      // central files are closed; it burns once they open.
      for (const f of [3, 4]) {
        if (mine.fileCounts[f] > 0) continue
        danger += 1
        const heavyOnFile = [0, 1, 2, 3, 4, 5, 6, 7].some(r => {
          const p = b.squares[sqAt(f, r)]
          return !!p && p.color === them && (p.type === 'r' || p.type === 'q')
        })
        if (heavyOnFile) danger += 1
      }
      if (!castlingRights(b, side)) danger += 2.5
      if (b.fullmove >= 15) danger += 1.5
      danger += attackWeight
    } else {
      danger += missingShield.length * 1.5
      danger += advancedShield.length * 0.5
      danger += openFilesNearKing.length * 1
      danger += stormPawns.length * 0.75
      danger += attackWeight
    }
    if (materialOf(b, them).queens === 0) danger *= 0.5
  }
  return {
    side, king, castled, inCenter, canCastle: castlingRights(b, side),
    missingShield, advancedShield, openFilesNearKing, stormPawns,
    attackers, attackersIncludeQueen,
    danger: Math.min(10, Math.round(danger * 10) / 10),
  }
}

// ---------------- Bishops ----------------

export interface BishopVerdict {
  sq: number
  side: Side
  light: boolean
  /** Own central pawns (files c-f) standing on the bishop's colour. */
  ownCentralOnColor: number
  /** …of which are fixed (blocked by an enemy pawn): the hardest to move away. */
  fixedCentralOnColor: number
  /** Enemy pawns on the bishop's colour (targets). */
  enemyPawnsOnColor: number
  mobility: number
  verdict: 'bad' | 'good' | 'neutral'
  /** Bad by structure but placed outside (in front of) its pawn chain. */
  activeDespiteBad: boolean
}

export function analyzeBishops(b: Board, side: Side, ps: PawnStructure): BishopVerdict[] {
  const them = opp(side)
  const out: BishopVerdict[] = []
  const mine = side === 'w' ? ps.w : ps.b
  const theirs = side === 'w' ? ps.b : ps.w
  for (const sq of piecesOf(b, side, 'b')) {
    const light = isLightSquare(sq)
    let ownCentralOnColor = 0, fixedCentralOnColor = 0, enemyPawnsOnColor = 0
    let frontmostFixed = 0
    for (const p of mine.pawns) {
      const f = fileOf(p.sq)
      if (isLightSquare(p.sq) !== light || f < 2 || f > 5) continue
      ownCentralOnColor++
      if (p.blocked) {
        fixedCentralOnColor++
        frontmostFixed = Math.max(frontmostFixed, relRank(side, p.sq))
      }
    }
    for (const p of theirs.pawns) if (isLightSquare(p.sq) === light) enemyPawnsOnColor++
    const mobility = attacksFrom(b, sq).filter(t => { const q = b.squares[t]; return !q || q.color === them }).length
    let verdict: BishopVerdict['verdict'] = 'neutral'
    if (fixedCentralOnColor >= 2 || (fixedCentralOnColor >= 1 && ownCentralOnColor >= 3)) verdict = 'bad'
    else if (ownCentralOnColor <= 1 && enemyPawnsOnColor >= 3) verdict = 'good'
    out.push({
      sq, side, light, ownCentralOnColor, fixedCentralOnColor, enemyPawnsOnColor, mobility, verdict,
      activeDespiteBad: verdict === 'bad' && (relRank(side, sq) > frontmostFixed || mobility >= 7),
    })
  }
  return out
}

// ---------------- Rooks ----------------

export interface RookFact {
  sq: number
  side: Side
  file: 'open' | 'half-open' | 'closed'
  onSeventh: boolean
  doubledWith?: number
  /** Rook behind a passed pawn of either side (Tarrasch rule). */
  behindPassed?: number
}

export function analyzeRooks(b: Board, side: Side, ps: PawnStructure): RookFact[] {
  const out: RookFact[] = []
  const mine = side === 'w' ? ps.w : ps.b
  const rooks = piecesOf(b, side, 'r')
  const allPassed = [...ps.w.pawns, ...ps.b.pawns].filter(p => p.passed)
  for (const sq of rooks) {
    const f = fileOf(sq)
    const file: RookFact['file'] = ps.openFiles.includes(f) ? 'open' : mine.halfOpenFiles.includes(f) ? 'half-open' : 'closed'
    const enemyKing = kingSquare(b, opp(side))
    const theirPawnsOn7 = (side === 'w' ? ps.b : ps.w).pawns.some(p => relRank(side, p.sq) === 7)
    const onSeventh = relRank(side, sq) === 7 && (theirPawnsOn7 || (enemyKing >= 0 && relRank(side, enemyKing) === 8))
    const doubledWith = rooks.find(o => o !== sq && fileOf(o) === f && !between(b, sq, o))
    let behindPassed: number | undefined
    for (const p of allPassed) {
      if (fileOf(p.sq) !== f) continue
      // "Behind" = on the side the pawn comes from (for its owner).
      const pawnFwd = forward(p.side)
      const isBehind = pawnFwd > 0 ? rankOf(sq) < rankOf(p.sq) : rankOf(sq) > rankOf(p.sq)
      if (isBehind && !between(b, sq, p.sq)) behindPassed = p.sq
    }
    out.push({ sq, side, file, onSeventh, doubledWith, behindPassed })
  }
  return out
}

/** True when some piece stands strictly between two squares of one file. */
function between(b: Board, a: number, c: number): boolean {
  const f = fileOf(a)
  const lo = Math.min(rankOf(a), rankOf(c)), hi = Math.max(rankOf(a), rankOf(c))
  for (let r = lo + 1; r < hi; r++) if (b.squares[sqAt(f, r)]) return true
  return false
}

// ---------------- Space ----------------

/** Stockfish's space term: safe squares on files c-f, relative ranks 2-4,
 *  counted twice when they sit behind our own pawns. */
export function spaceScore(b: Board, side: Side, ps: PawnStructure, atk: AttackMaps): number {
  const them = opp(side)
  const theirPawnAttacks = (side === 'w' ? ps.b : ps.w).attacks
  const fwd = forward(side)
  const behind = new Uint8Array(64)
  for (const p of (side === 'w' ? ps.w : ps.b).pawns) {
    for (let k = 0; k <= 3; k++) {
      const r = rankOf(p.sq) - k * fwd
      if (r >= 0 && r < 8) behind[sqAt(fileOf(p.sq), r)] = 1
    }
  }
  let score = 0
  for (let f = 2; f <= 5; f++) {
    for (let rr = 2; rr <= 4; rr++) {
      const sq = sqAt(f, side === 'w' ? rr - 1 : 8 - rr)
      const p = b.squares[sq]
      if (p && p.type === 'p' && p.color === side) continue
      if (theirPawnAttacks[sq]) continue
      score++
      if (behind[sq] && atk.count[them][sq] === 0) score++
    }
  }
  return score
}

// ---------------- Mobility / worst piece ----------------

export interface PieceActivity {
  sq: number
  type: PieceType
  mobility: number
  /** Mobility relative to what the piece type usually enjoys (1 = normal). */
  ratio: number
  /** Attacks at least one enemy piece (not a pawn): pinning, pressuring… */
  engaged: boolean
}

const TYPICAL_MOBILITY: Partial<Record<PieceType, number>> = { n: 5, b: 7 }

/** Minor pieces sorted from least to most active. */
export function pieceActivity(b: Board, side: Side, ps: PawnStructure): PieceActivity[] {
  const theirPawnAttacks = (side === 'w' ? ps.b : ps.w).attacks
  const out: PieceActivity[] = []
  for (const sq of piecesOf(b, side)) {
    const p = b.squares[sq]!
    const typical = TYPICAL_MOBILITY[p.type]
    if (!typical) continue
    const targets = attacksFrom(b, sq)
    const mobility = targets.filter(t => {
      const q = b.squares[t]
      if (q && q.color === side) return false
      return !theirPawnAttacks[t]
    }).length
    const engaged = targets.some(t => { const q = b.squares[t]; return !!q && q.color !== side && q.type !== 'p' })
    out.push({ sq, type: p.type, mobility, ratio: mobility / typical, engaged })
  }
  return out.sort((a, b) => a.ratio - b.ratio)
}

export function fileLetter(f: number): string {
  return FILES[f]
}
