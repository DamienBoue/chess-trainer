// Centre classification and pawn breaks.
//
// The type of centre drives the whole middlegame (Pachman / Nimzowitsch):
//   * closed   — d/e pawns locked head-to-head: play on the wings, the
//                direction of your pawn chain tells you which one
//   * open     — few or no central pawns: development, king safety and
//                piece activity decide everything
//   * mobile   — one side has a free-rolling pawn duo: it wants to advance
//                it, the other side must hit it with pawns before it does
//   * fixed    — one locked central pair, the rest half-open: manoeuvre
//                around fixed weaknesses (Carlsbad, French exchange, …)
//   * tension  — central pawns attack each other: whoever resolves the
//                tension usually helps the other side, keep it if you can
//
// A *pawn break* (lever push) is a pawn move that attacks an enemy pawn.
// Breaks are how structures change — and "when to break" is the most
// common strategic question at club level.

import {
  type AttackMaps, type Board, type Side,
  fileOf, rankOf, sqAt, forward, relRank, opp, sqName, pawnAttackSquares,
} from './board'
import { type Lever, type PawnStructure, analyzePawns, mainChain } from './pawns'

export type CenterType = 'closed' | 'open' | 'mobile' | 'fixed' | 'tension' | 'semi-open' | 'forming'

export interface CenterInfo {
  type: CenterType
  label: string
  /** One-paragraph explanation of what this centre implies. */
  advice: string
  /** Locked central pairs: [white pawn, black pawn]. */
  lockedPairs: [number, number][]
  /** Pawn tensions involving a d/e pawn. */
  tension: Lever[]
  /** Owner of a mobile pawn centre, when there is one. */
  mobileSide?: Side
}

export const CENTER_LABELS: Record<CenterType, string> = {
  closed: 'Centre fermé',
  open: 'Centre ouvert',
  mobile: 'Centre mobile',
  fixed: 'Centre fixé',
  tension: 'Centre en tension',
  'semi-open': 'Centre semi-ouvert',
  forming: 'Centre en construction',
}

const CENTER_ADVICE: Record<CenterType, string> = {
  closed: 'Les pions centraux sont bloqués : le jeu se déplace sur les ailes. Attaque du côté où pointent tes chaînes de pions, avec des ruptures de pions de flanc. Les cavaliers sont souvent meilleurs que les fous, et tu as le temps de manœuvrer.',
  open: 'Peu de pions au centre : les pièces respirent. Développement, sécurité du roi et activité priment ; les fous et les tours (colonnes ouvertes) prennent de la valeur. Un roi resté au centre devient une cible.',
  mobile: 'Un camp dispose d\'un duo de pions centraux libres d\'avancer. Son plan : pousser au bon moment pour gagner de l\'espace ou ouvrir vers le roi. Le camp adverse doit le harceler par des ruptures de pions (et des pièces) avant qu\'il ne déferle — ou le bloquer.',
  fixed: 'Une paire de pions centraux est bloquée, le reste du centre est semi-ouvert : la partie tourne autour de faiblesses fixes (cases, pions arriérés) et des colonnes semi-ouvertes. Plans lents et précis : avant-postes, attaque de minorité, pression sur les colonnes.',
  tension: 'Des pions centraux se touchent. Résoudre la tension (prendre) libère souvent le jeu de l\'adversaire : maintiens-la tant que c\'est possible, et ne prends que si l\'échange t\'apporte quelque chose (ouverture d\'une colonne, case gagnée, pion faible créé).',
  'semi-open': 'Une ou deux colonnes centrales sont semi-ouvertes : les tours s\'y installent, et chaque camp cherche la rupture centrale qui ouvrira le jeu à son avantage.',
  forming: 'Les pions centraux ne se touchent pas encore : c\'est la phase où l\'on se dispute le centre. Occupe-le ou contrôle-le avec tes pièces, développe-toi et roque avant d\'ouvrir le jeu.',
}

const isPawnOf = (b: Board, sq: number, side: Side) => {
  const p = b.squares[sq]
  return !!p && p.type === 'p' && p.color === side
}

export function classifyCenter(b: Board, ps: PawnStructure): CenterInfo {
  const lockedPairs: [number, number][] = []
  for (const f of [3, 4]) {
    for (let r = 0; r < 7; r++) {
      const w = sqAt(f, r), bl = sqAt(f, r + 1)
      if (isPawnOf(b, w, 'w') && isPawnOf(b, bl, 'b')) lockedPairs.push([w, bl])
    }
  }
  const central = (sq: number) => fileOf(sq) === 3 || fileOf(sq) === 4
  const tension = ps.levers.filter(l => central(l.from) || central(l.target))
  let centralPawns = 0
  for (const f of [3, 4]) centralPawns += ps.w.fileCounts[f] + ps.b.fileCounts[f]

  // Mobile centre: a side has a d+e (or c+d) duo on its 4th-5th rank, none
  // of the two blocked by a pawn, while the opponent keeps at most one pawn
  // on the d/e files (Grünfeld, Alekhine four pawns, …).
  let mobileSide: Side | undefined
  for (const side of ['w', 'b'] as Side[]) {
    const them = opp(side)
    const theirCentral = (them === 'w' ? ps.w : ps.b).fileCounts[3] + (them === 'w' ? ps.w : ps.b).fileCounts[4]
    if (theirCentral > 1) continue
    for (const [f1, f2] of [[3, 4], [2, 3]]) {
      const duo = [f1, f2].map(f => {
        for (let r = 0; r < 8; r++) {
          const sq = sqAt(f, r)
          if (isPawnOf(b, sq, side) && relRank(side, sq) >= 4 && relRank(side, sq) <= 5) return sq
        }
        return -1
      })
      if (duo.some(s => s < 0)) continue
      if (Math.abs(rankOf(duo[0]) - rankOf(duo[1])) > 1) continue
      const unblocked = duo.every(sq => {
        const front = sqAt(fileOf(sq), rankOf(sq) + forward(side))
        return b.squares[front]?.type !== 'p'
      })
      if (unblocked) { mobileSide = side; break }
    }
    if (mobileSide) break
  }

  let type: CenterType
  if (lockedPairs.length >= 2) type = 'closed'
  else if (tension.length > 0) type = 'tension'
  else if (lockedPairs.length === 1) type = 'fixed'
  else if (mobileSide) type = 'mobile'
  else if (centralPawns <= 2) type = 'open'
  else if (halfOpenCentral(ps)) type = 'semi-open'
  else type = 'forming'

  return {
    type,
    label: type === 'mobile' && mobileSide ? `${CENTER_LABELS[type]} (${mobileSide === 'w' ? 'Blancs' : 'Noirs'})` : CENTER_LABELS[type],
    advice: CENTER_ADVICE[type],
    lockedPairs,
    tension,
    mobileSide: type === 'mobile' ? mobileSide : undefined,
  }
}

/** A d/e file holding pawns of one side only. */
function halfOpenCentral(ps: PawnStructure): boolean {
  return [3, 4].some(f => (ps.w.fileCounts[f] === 0) !== (ps.b.fileCounts[f] === 0))
}

export interface PawnBreak {
  side: Side
  from: number
  to: number
  /** SAN of the push (pawn pushes never need disambiguation). */
  san: string
  /** Enemy pawns attacked once the pawn lands. */
  targets: number[]
  /** What the targets are, structurally ("attaque la base de la chaîne", …). */
  roles: string[]
  central: boolean
  /** Own pieces covering the landing square vs enemy ones. */
  support: number
  opposition: number
  /** Heuristic: the landing square is defended at least as many times as it is attacked. */
  ready: boolean
  /** The pushed pawn currently props up a pawn under attack: pushing drops that support. */
  weakens?: number
  /** The pushed pawn belongs to the own king's shelter. */
  weakensKing?: boolean
  /** The break would trade off an enemy weak pawn (isolated/backward) — usually helps the opponent. */
  freesWeakPawn?: boolean
  /** A pawn push that would add support to the break square (when not ready). */
  prep?: [number, number]
  score: number
}

const relRankOfSq = relRank

export function findPawnBreaks(b: Board, ps: PawnStructure, atk: AttackMaps, side: Side, center: CenterInfo): PawnBreak[] {
  const them = opp(side)
  const fwd = forward(side)
  const theirMain = mainChain(ps, them)
  const theirChains = [...(theirMain ? [theirMain] : []), ...ps.chains.filter(c => c.side === them && c.locked && c !== theirMain)]
  const theirPawns = side === 'w' ? ps.b : ps.w
  const myPawns = side === 'w' ? ps.w : ps.b
  const breaks: PawnBreak[] = []
  for (const p of myPawns.pawns) {
    const f = fileOf(p.sq), r = rankOf(p.sq)
    const one = sqAt(f, r + fwd)
    if (r + fwd < 0 || r + fwd > 7 || b.squares[one]) continue
    const dests = [one]
    if (relRankOfSq(side, p.sq) === 2) {
      const two = sqAt(f, r + 2 * fwd)
      if (!b.squares[two]) dests.push(two)
    }
    // Does this pawn currently defend a friendly pawn that an enemy pawn attacks?
    const weakens = pawnAttackSquares(side, p.sq).find(t =>
      isPawnOf(b, t, side) && atk.byPawn[them][t] === 1)
    for (const to of dests) {
      // A pawn landing on the last-but-one rank is a promotion race, not a break.
      if (relRank(side, to) >= 7) continue
      const targets = pawnAttackSquares(side, to).filter(t => isPawnOf(b, t, them))
      if (targets.length === 0) continue
      const roles: string[] = []
      let score = 0
      let freesWeakPawn = false
      for (const t of targets) {
        const chain = theirChains.find(c => c.squares.includes(t))
        if (chain && chain.head !== t) { roles.push('attaque la base de la chaîne'); score += 3 }
        else if (chain) { roles.push('attaque la tête de la chaîne'); score += 2 }
        const facts = theirPawns.pawns.find(x => x.sq === t)
        if (center.mobileSide === them && (fileOf(t) === 3 || fileOf(t) === 4)) { roles.push('conteste le centre mobile'); score += 3 }
        if (facts?.passed) { roles.push('s\'attaque à un pion passé'); score += 1 }
        // Trading off the opponent's weak pawn relieves him of it.
        if (facts && (facts.isolated || facts.backward) && targets.length === 1) { freesWeakPawn = true; score -= 3 }
      }
      const central = targets.some(t => fileOf(t) >= 2 && fileOf(t) <= 5) && f >= 2 && f <= 5
      // Pawns in front of our own (future) king are its shelter.
      const myKing = kingSquareOf(b, side)
      const kingWing = myKing < 0 ? null : fileOf(myKing) >= 5 || (fileOf(myKing) === 4 && canCastleShort(b, side)) ? 'k'
        : fileOf(myKing) <= 2 ? 'q' : null
      // g/h (or a/b/c) pawns always shelter a king on that wing. The f-pawn
      // only matters for a king still in the centre with the a2-g8 / a7-g1
      // diagonal open (Italian ...f5 is bad, French ...f6 or KID ...f5 are not).
      const castled = myKing >= 0 && fileOf(myKing) !== 4
      const weakensKing = (kingWing === 'k' && (f >= 6 || (f === 5 && !castled && diagonalOpenToKing(b, side))))
        || (kingWing === 'q' && f <= 2)
      if (weakensKing) score -= 2
      if (central) score += 2
      const support = atk.count[side][to]
      // The moving pawn itself never defends its destination; enemy pawns
      // that are targets do attack it (that's the exchange we offer).
      const opposition = atk.count[them][to]
      const ready = support >= opposition
      if (ready) score += 2
      if (!ready && opposition - support >= 2) score -= 2
      if (weakens !== undefined) score -= 3
      let prep: [number, number] | undefined
      if (!ready) {
        // Find a pawn push of ours that adds a defender to `to`.
        for (const q of myPawns.pawns) {
          if (q.sq === p.sq) continue
          const one = q.sq + 8 * fwd
          if (one < 0 || one > 63 || b.squares[one]) continue
          const steps = [one]
          if (relRank(side, q.sq) === 2 && !b.squares[one + 8 * fwd]) steps.push(one + 8 * fwd)
          const dest = steps.find(d => pawnAttackSquares(side, d).includes(to))
          if (dest !== undefined) { prep = [q.sq, dest]; break }
        }
      }
      breaks.push({
        side, from: p.sq, to, san: sqName(to), targets, roles, central, support, opposition, ready,
        weakens, weakensKing: weakensKing || undefined, freesWeakPawn: freesWeakPawn || undefined, prep, score,
      })
    }
  }
  breaks.sort((a, b) => b.score - a.score)
  return breaks
}

function kingSquareOf(b: Board, side: Side): number {
  for (let sq = 0; sq < 64; sq++) {
    const p = b.squares[sq]
    if (p && p.type === 'k' && p.color === side) return sq
  }
  return -1
}

function canCastleShort(b: Board, side: Side): boolean {
  return b.castling.includes(side === 'w' ? 'K' : 'k')
}

export interface BreakConsequence {
  /** From the breaking side's point of view. */
  polarity: 'plus' | 'minus' | 'info'
  text: string
}

/** What the pawn structure looks like if the break leads to a plain pawn
 *  trade (our pawn and its target both disappear, pieces recapture) — the
 *  most common outcome, and the one a player must foresee before breaking. */
export function breakConsequences(b: Board, br: PawnBreak): BreakConsequence[] {
  const side = br.side
  const them = opp(side)
  const before = analyzePawns(b)
  const target = br.targets[0]
  const squares = b.squares.slice()
  squares[br.from] = null
  squares[target] = null
  const after = analyzePawns({ ...b, squares })
  const out: BreakConsequence[] = []
  const flags = (ps: PawnStructure, s: Side) => (s === 'w' ? ps.w : ps.b).pawns
  for (const s of [side, them] as Side[]) {
    const mine = s === side
    const old = new Map(flags(before, s).map(p => [p.sq, p]))
    for (const p of flags(after, s)) {
      const was = old.get(p.sq)
      if (!was) continue
      if (p.isolated && !was.isolated) {
        out.push({ polarity: mine ? 'minus' : 'plus', text: `${mine ? 'ton' : 'le'} pion ${sqName(p.sq)}${mine ? '' : ' adverse'} deviendrait isolé` })
      } else if (p.backward && !was.backward) {
        out.push({ polarity: mine ? 'minus' : 'plus', text: `${mine ? 'ton' : 'le'} pion ${sqName(p.sq)}${mine ? '' : ' adverse'} deviendrait arriéré` })
      }
      if (p.passed && !was.passed) {
        out.push({ polarity: mine ? 'plus' : 'minus', text: mine ? `tu obtiendrais un pion passé en ${sqName(p.sq)}` : `l'adversaire obtiendrait un pion passé en ${sqName(p.sq)}` })
      }
    }
  }
  const mineAfter = side === 'w' ? after.w : after.b
  for (const f of new Set([fileOf(br.from), fileOf(target)])) {
    if (after.openFiles.includes(f) && !before.openFiles.includes(f)) {
      out.push({ polarity: 'info', text: `la colonne ${'abcdefgh'[f]} s'ouvrirait` })
    } else if (mineAfter.halfOpenFiles.includes(f) && !(side === 'w' ? before.w : before.b).halfOpenFiles.includes(f)) {
      out.push({ polarity: 'plus', text: `la colonne ${'abcdefgh'[f]} deviendrait semi-ouverte pour toi` })
    }
  }
  return out
}

/** Walking from the f-pawn's square along the a2-g8 (a7-g1) diagonal, is
 *  the first thing we meet something other than a pawn? Then pushing the
 *  f-pawn opens that diagonal onto the king's future home. */
function diagonalOpenToKing(b: Board, side: Side): boolean {
  // e6-d5-c4-b3-a2 for Black, e3-d4-c5-b6-a7 for White.
  const squares = side === 'b' ? [44, 35, 26, 17, 8] : [20, 27, 34, 41, 48]
  for (const sq of squares) {
    const p = b.squares[sq]
    if (p) return p.type !== 'p'
  }
  return true
}
