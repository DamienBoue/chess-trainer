// Prescriptive layer: strategic plans for one side.
//
// A plan is a textbook idea that fits the detected features: why it
// applies, how to carry it out, which squares/arrows illustrate it, and
// the first moves that would start it (so the UI can tell whether the
// engine's best move goes the same way). Pawn breaks also get a timing
// verdict — "when to break the centre" is answered with explicit pros
// and cons (development, king safety, support of the break square, …).
//
// Plans are heuristics, not calculation: the UI always presents them as
// ideas to check against the engine, never as verdicts.

import {
  type Board, type Side,
  FILES, fileOf, rankOf, sqAt, forward, opp, relRank, sqName, kingSquare, piecesOf, attacksFrom,
  pawnAttackSquares as pawnAttacks,
} from './board'
import { type PawnBreak, breakConsequences } from './center'
import { mainChain } from './pawns'
import type { ReportCore } from './report'
import { structureRole } from './structures'
import { fileName, pieceRef, plural, pushName, squareList, wingName } from './text'

export type PlanKind =
  | 'structure' | 'development' | 'castle' | 'open-center' | 'central-break' | 'wing-play'
  | 'minority-attack' | 'majority' | 'passed-pawn' | 'blockade' | 'outpost' | 'weak-pawn'
  | 'open-file' | 'seventh-rank' | 'bad-bishop' | 'bishop-pair' | 'anti-bishop-pair'
  | 'king-attack' | 'pawn-storm' | 'king-safety' | 'space' | 'free-yourself'
  | 'simplify' | 'complicate' | 'king-activity' | 'two-weaknesses' | 'worst-piece' | 'prophylaxis'

/** Short, square-free names of each kind of plan (trainer choices, profile). */
export const PLAN_KIND_LABELS: Record<PlanKind, string> = {
  structure: 'Plan type de la structure',
  development: 'Terminer son développement',
  castle: 'Roquer',
  'open-center': 'Ouvrir le centre contre le roi adverse',
  'central-break': 'Rupture de pion au centre',
  'wing-play': 'Jouer sur l\'aile où pointent ses pions',
  'minority-attack': 'Attaque de minorité',
  majority: 'Créer un pion passé avec sa majorité',
  'passed-pawn': 'Pousser son pion passé',
  blockade: 'Bloquer le pion passé adverse',
  outpost: 'Installer un cavalier sur un avant-poste',
  'weak-pawn': 'Attaquer un pion faible',
  'open-file': 'Prendre la colonne ouverte',
  'seventh-rank': 'Tour en 7e rangée',
  'bad-bishop': 'Améliorer son mauvais fou',
  'bishop-pair': 'Ouvrir le jeu pour la paire de fous',
  'anti-bishop-pair': 'Neutraliser la paire de fous',
  'king-attack': 'Attaquer le roi',
  'pawn-storm': 'Tempête de pions',
  'king-safety': 'Mettre son roi en sécurité',
  space: 'Exploiter l\'avantage d\'espace',
  'free-yourself': 'Se libérer par des échanges',
  simplify: 'Simplifier : échanger les pièces',
  complicate: 'Compliquer le jeu',
  'king-activity': 'Activer son roi',
  'two-weaknesses': 'Jouer sur deux faiblesses',
  'worst-piece': 'Améliorer sa plus mauvaise pièce',
  prophylaxis: 'Prophylaxie',
}

/** A move that starts the plan; a missing end means "any". */
export interface PlanMove { from?: number; to?: number }

export interface BreakTiming {
  verdict: 'now' | 'prepare'
  pros: string[]
  cons: string[]
}

export interface Plan {
  id: string
  side: Side
  kind: PlanKind
  title: string
  why: string
  steps: string[]
  conceptId?: string
  arrows: [number, number][]
  /** Arrows show the *opponent's* intentions (prophylaxis), not ours. */
  arrowsAreThreats?: boolean
  squares: number[]
  moves: PlanMove[]
  priority: number
  timing?: BreakTiming
}

// ---------------- helpers ----------------

function pawnPushes(b: Board, side: Side, sq: number): number[] {
  const fwd = forward(side)
  const f = fileOf(sq), r = rankOf(sq)
  const out: number[] = []
  const one = r + fwd
  if (one < 0 || one > 7 || b.squares[sqAt(f, one)]) return out
  out.push(sqAt(f, one))
  if (relRank(side, sq) === 2 && !b.squares[sqAt(f, r + 2 * fwd)]) out.push(sqAt(f, r + 2 * fwd))
  return out
}

/** Rook moves of `side` landing on file `f` in one move. */
function rookMovesToFile(b: Board, side: Side, f: number): [number, number][] {
  const out: [number, number][] = []
  for (const rq of piecesOf(b, side, 'r')) {
    if (fileOf(rq) === f) continue
    for (const t of attacksFrom(b, rq)) {
      if (fileOf(t) !== f) continue
      const occ = b.squares[t]
      if (occ && occ.color === side) continue
      out.push([rq, t])
    }
  }
  return out
}

function moveRef(from: number, to: number): string {
  return `${sqName(from)}→${sqName(to)}`
}

export function breakTiming(r: ReportCore, side: Side, br: PawnBreak): BreakTiming {
  const them = opp(side)
  const pros: string[] = []
  const cons: string[] = []
  const myDev = r.undeveloped[side].length, theirDev = r.undeveloped[them].length
  if (r.phase === 'opening' || r.board.fullmove <= 20) {
    if (myDev <= theirDev) pros.push('ton développement est au moins égal à celui de l\'adversaire')
    else cons.push(`${plural(myDev, 'pièce mineure n\'est', 'pièces mineures ne sont')} pas encore sortie${myDev > 1 ? 's' : ''} : ouvrir le jeu profite au camp le mieux développé`)
  }
  const myKing = r.kings[side], theirKing = r.kings[them]
  if (r.phase !== 'endgame') {
    if (myKing.castled && myKing.danger < 4) pros.push('ton roi est à l\'abri')
    else if (myKing.inCenter) cons.push('ton roi est encore au centre : un centre ouvert peut se retourner contre toi')
    if (theirKing.inCenter) pros.push('le roi adverse est encore au centre')
  }
  const mine = r.material[side], theirs = r.material[them]
  const myPair = mine.lightBishops > 0 && mine.darkBishops > 0
  const theirPair = theirs.lightBishops > 0 && theirs.darkBishops > 0
  if (myPair && !theirPair) pros.push('ouvrir le jeu valorise ta paire de fous')
  if (theirPair && !myPair) cons.push('ouvrir le jeu valorise la paire de fous adverse')
  if (br.ready) pros.push(`la case ${sqName(br.to)} est assez soutenue (${br.support} contre ${br.opposition})`)
  else cons.push(`la case ${sqName(br.to)} est insuffisamment soutenue (${br.support} contre ${br.opposition}) : ajoute des pièces avant de pousser`)
  for (const role of br.roles) pros.push(`elle ${role}`)
  if (br.weakensKing) cons.push('ce pion protège ton roi : l\'avancer affaiblit ton abri')
  if (br.freesWeakPawn) cons.push('elle échangerait un pion faible adverse : ne libère pas l\'adversaire de sa faiblesse')
  for (const c of breakConsequences(r.board, br)) {
    const text = `après l'échange de pions, ${c.text}`
    if (c.polarity === 'minus') cons.push(text)
    else pros.push(text)
  }
  const verdict = br.ready && !br.weakensKing && !br.freesWeakPawn
    && (cons.length === 0 || (pros.length >= 3 && cons.length <= 1)) ? 'now' : 'prepare'
  return { verdict, pros, cons }
}

// ---------------- plan builders ----------------

type Builder = (r: ReportCore, side: Side, out: Plan[]) => void

const structurePlans: Builder = (r, side, out) => {
  r.structures.slice(0, 2).forEach((m, i) => {
    const role = structureRole(m, side)
    const possible = role.breaks.filter(([from, to]) => {
      const p = r.board.squares[from]
      return !!p && p.type === 'p' && p.color === side && !r.board.squares[to]
    })
    out.push({
      id: `structure:${m.pattern.id}`, side, kind: 'structure',
      title: `${m.pattern.name} : plans types`,
      why: `${m.pattern.summary} Ici, ${sideLabel(side)} sont ${role.role}.`,
      steps: role.plans,
      conceptId: m.pattern.conceptId,
      arrows: possible,
      squares: role.squares,
      moves: possible.map(([from, to]) => ({ from, to })),
      priority: i === 0 ? 8 : 6.5,
    })
  })
}

function sideLabel(s: Side) { return s === 'w' ? 'les Blancs' : 'les Noirs' }

const developmentPlans: Builder = (r, side, out) => {
  if (r.phase === 'endgame') return
  const und = r.undeveloped[side]
  if (r.phase === 'opening' && und.length >= 2 && r.board.fullmove >= 4) {
    out.push({
      id: 'development', side, kind: 'development',
      title: 'Termine ton développement',
      why: `${plural(und.length, 'pièce mineure est', 'pièces mineures sont')} encore sur leur case de départ (${und.map(sq => pieceRef(r.board.squares[sq]!.type, sq)).join(', ')}).`,
      steps: [
        'Sors les pièces mineures vers le centre, cavaliers avant fous en général.',
        'Évite de jouer deux fois la même pièce ou des coups de pion inutiles.',
        'Objectif : roquer et connecter les tours.',
      ],
      conceptId: 'development',
      arrows: [], squares: und,
      moves: und.map(from => ({ from })),
      priority: 9 - (r.board.fullmove < 6 ? 1 : 0),
    })
  }
  const k = r.kings[side]
  const king = kingSquare(r.board, side)
  if (!k.castled && k.canCastle && king >= 0 && fileOf(king) === 4 && r.board.fullmove >= 4) {
    const open = r.center.type === 'open' || r.center.type === 'tension' || r.center.type === 'semi-open'
    const moves: PlanMove[] = []
    const rights = r.board.castling
    if (side === 'w' ? rights.includes('K') : rights.includes('k')) moves.push({ from: king, to: king + 2 })
    if (side === 'w' ? rights.includes('Q') : rights.includes('q')) moves.push({ from: king, to: king - 2 })
    out.push({
      id: 'castle', side, kind: 'castle',
      title: 'Mets ton roi à l\'abri : roque',
      why: open
        ? 'Le centre s\'ouvre : un roi resté en e1/e8 devient vite une cible.'
        : 'Le roque met le roi en sécurité et active une tour.',
      steps: [
        'Libère les cases entre le roi et la tour (pièces mineures dehors).',
        'Le petit roque est généralement le plus rapide et le plus sûr.',
      ],
      conceptId: 'castling',
      arrows: [], squares: [king], moves,
      priority: open ? 8.5 : 6,
    })
  }
}

const centerPlans: Builder = (r, side, out) => {
  const them = opp(side)
  const breaks = r.breaks[side]
  const central = breaks.filter(b => b.central)
  const theirKing = r.kings[them]
  const devOk = r.undeveloped[side].length <= r.undeveloped[them].length

  // Open the centre against a king stuck in the middle.
  const myKing = r.kings[side]
  const theirStuck = !theirKing.canCastle
    || r.undeveloped[them].length - r.undeveloped[side].length >= 2
    || r.board.fullmove >= 14
  if (r.phase !== 'endgame' && theirKing.inCenter && theirStuck && devOk
    && r.center.type !== 'closed' && (myKing.castled || !myKing.inCenter || r.undeveloped[side].length === 0)
    && (central.length > 0 || r.center.tension.some(l => l.side === side))) {
    const captures = r.center.tension.filter(l => l.side === side)
    const first = central[0]
    out.push({
      id: 'open-center', side, kind: 'open-center',
      title: 'Ouvre le centre : le roi adverse est resté au milieu',
      why: 'Un roi au centre est vulnérable dès que les colonnes d et e s\'ouvrent — à condition d\'être mieux développé que l\'adversaire.',
      steps: [
        first ? `Rupture ${pushName(first.from, first.to)} pour faire sauter les pions centraux.` : 'Échange les pions centraux pour ouvrir les lignes.',
        'Place tes tours sur les colonnes centrales.',
        'Sacrifier un pion pour ouvrir une colonne vers le roi est souvent justifié.',
      ],
      conceptId: 'initiative',
      arrows: [...(first ? [[first.from, first.to] as [number, number]] : []), ...captures.map(l => [l.from, l.target] as [number, number])],
      squares: [theirKing.king],
      moves: [...central.map(b => ({ from: b.from, to: b.to })), ...captures.map(l => ({ from: l.from, to: l.target }))],
      priority: 8.5,
    })
  }

  // The best central break, with its timing.
  if (r.center.type !== 'closed' && r.phase !== 'endgame') {
    // Never give up control of a key square of our own structure (Maroczy: c4 holds d5).
    const keySquares = r.structures.flatMap(m => structureRole(m, side).squares)
    const holdsKey = (b: PawnBreak) => pawnAttacks(side, b.from).some(t => keySquares.includes(t))
    const sound = (b: PawnBreak) => b.weakens === undefined && !b.weakensKing && !b.freesWeakPawn && !holdsKey(b)
    const br = central.find(b => b.score >= 3 && sound(b))
      ?? central.find(b => !b.ready && b.prep && sound(b) && b.score >= 0)
    if (br) {
      const timing = breakTiming(r, side, br)
      if (timing.verdict === 'prepare' && br.prep) {
        timing.cons.push(`prépare-la avec ${pushName(br.prep[0], br.prep[1])}, qui ajoute un soutien sur ${sqName(br.to)}`)
      }
      out.push({
        id: `break:${sqName(br.from)}-${sqName(br.to)}`, side, kind: 'central-break',
        title: `Rupture centrale ${pushName(br.from, br.to)}${timing.verdict === 'now' ? '' : ' (à préparer)'}`,
        why: `Une rupture de pions change la structure : elle ouvre des lignes et frappe ${br.targets.length > 1 ? 'les pions' : 'le pion'} ${squareList(br.targets)}.`
          + (br.roles.length ? ` Elle ${br.roles.join(' et ')}.` : ''),
        steps: [
          timing.verdict === 'now' ? 'Les conditions sont réunies : c\'est un bon moment pour frapper.' : 'Pas encore : prépare d\'abord (voir les contre-indications).',
          ...timing.cons.map(c => `⚠️ ${c}`),
          ...timing.pros.map(p => `✓ ${p}`),
        ],
        conceptId: 'pawn-break',
        arrows: [[br.from, br.to], ...(timing.verdict === 'prepare' && br.prep ? [br.prep] : [])],
        squares: br.targets,
        moves: [{ from: br.from, to: br.to }, ...(timing.verdict === 'prepare' && br.prep ? [{ from: br.prep[0], to: br.prep[1] }] : [])],
        priority: (br.score >= 3 ? 6 : 4.5) + (timing.verdict === 'now' ? 1.5 : 0),
        timing,
      })
    }
  }

  // Closed centre: play where the chain points.
  if (r.center.type === 'closed' || r.center.type === 'fixed') {
    const chain = mainChain(r.pawns, side)
    if (chain && (r.center.type === 'closed' || chain.squares.length >= 3)) {
      const wingFiles = chain.pointsTo === 'kingside' ? [5, 6, 7] : [0, 1, 2]
      const wingBreaks = breaks.filter(b => wingFiles.includes(fileOf(b.from)) || wingFiles.includes(fileOf(b.targets[0])))
      // Pawn pushes on that wing that prepare a break, if none is available yet.
      const preparing: [number, number][] = []
      if (wingBreaks.length === 0) {
        for (const p of (side === 'w' ? r.pawns.w : r.pawns.b).pawns) {
          if (!wingFiles.includes(fileOf(p.sq))) continue
          for (const t of pawnPushes(r.board, side, p.sq)) preparing.push([p.sq, t])
        }
      }
      const wing = chain.pointsTo
      const best = wingBreaks[0]
      out.push({
        id: `wing:${wing}`, side, kind: 'wing-play',
        title: `Joue à l'${wingName(wing)}, là où pointent tes pions`,
        why: `Le centre est ${r.center.type === 'closed' ? 'bloqué' : 'fixé'} et ta chaîne ${squareList(chain.squares)} pointe vers l'${wingName(wing)} : c'est là que tu as de l'espace (règle de Nimzowitsch).`,
        steps: [
          best ? `Rupture ${pushName(best.from, best.to)}${best.roles.length ? ` — elle ${best.roles.join(' et ')}` : ''}.` : 'Avance tes pions sur cette aile pour préparer une rupture.',
          'Amène tes pièces de ce côté avant d\'ouvrir.',
          'Ne cherche pas à ouvrir le centre bloqué : c\'est sur les ailes que ça se joue.',
        ],
        conceptId: 'pawn-chain',
        arrows: best ? [[best.from, best.to]] : preparing.slice(0, 2),
        squares: chain.squares,
        moves: best ? wingBreaks.map(b => ({ from: b.from, to: b.to })) : preparing.map(([from, to]) => ({ from, to })),
        priority: (r.center.type === 'closed' ? 7 : 5) - (r.structures.length ? 0.5 : 0),
      })
    }
  }
}

const pawnPlans: Builder = (r, side, out) => {
  if (r.phase === 'opening') return
  const them = opp(side)
  const mine = side === 'w' ? r.pawns.w : r.pawns.b
  const theirs = side === 'w' ? r.pawns.b : r.pawns.w
  const endgame = r.phase === 'endgame'

  // Minority attack (generic; skipped when Carlsbad already explains it).
  const carlsbadA = r.structures.some(m => m.pattern.id === 'carlsbad' && m.sideA === side)
  const theirCBack = theirs.pawns.some(p => fileOf(p.sq) === 2 && relRank(side, p.sq) >= 6)
  if (!carlsbadA && mine.wings.queenside < theirs.wings.queenside && mine.fileCounts[2] === 0
    && theirCBack && mine.fileCounts[1] > 0 && !endgame) {
    const bPawn = mine.pawns.find(p => fileOf(p.sq) === 1)!
    const pushes = pawnPushes(r.board, side, bPawn.sq)
    out.push({
      id: 'minority', side, kind: 'minority-attack',
      title: 'Attaque de minorité à l\'aile dame',
      why: `Tu as moins de pions à l'aile dame (${mine.wings.queenside} contre ${theirs.wings.queenside}) et la colonne c semi-ouverte : pousser ta minorité crée une faiblesse durable chez l'adversaire.`,
      steps: [
        `Avance le pion b (${sqName(bPawn.sq)}) jusqu'en ${sqName(sqAt(1, side === 'w' ? 4 : 3))}, appuyé par le pion a ou une tour.`,
        'Après l\'échange, l\'adversaire garde un pion c arriéré ou isolé.',
        'Double tes tours sur la colonne c contre ce pion, et occupe la case devant lui.',
      ],
      conceptId: 'minority-attack',
      arrows: pushes.length ? [[bPawn.sq, pushes[pushes.length - 1]]] : [],
      squares: theirs.pawns.filter(p => fileOf(p.sq) === 2).map(p => p.sq),
      moves: pushes.map(to => ({ from: bPawn.sq, to })),
      priority: 6.5,
    })
  }

  // Majority → passed pawn.
  for (const wing of ['queenside', 'kingside'] as const) {
    const a = mine.wings[wing], b = theirs.wings[wing]
    if (!(a > b && a >= 2)) continue
    const files = wing === 'queenside' ? [0, 1, 2] : [5, 6, 7]
    const wingPawns = mine.pawns.filter(p => files.includes(fileOf(p.sq)))
    if (wingPawns.some(p => p.doubled)) continue // crippled majority
    if (wingPawns.some(p => p.passed)) continue // already converted
    const cand = wingPawns.filter(p => p.candidate)
      .sort((x, y) => relRank(side, y.sq) - relRank(side, x.sq))[0]
    if (!cand) continue
    const kings = [kingSquare(r.board, side), kingSquare(r.board, them)]
    const kingsAway = !kings.some(k => k >= 0 && files.includes(fileOf(k)))
    const pushes = pawnPushes(r.board, side, cand.sq)
    out.push({
      id: `majority:${wing}`, side, kind: 'majority',
      title: `Crée un pion passé avec ta majorité à l'${wingName(wing)}`,
      why: `${a} pions contre ${b} : une majorité saine produit un pion passé.`
        + (kingsAway ? ' Loin des rois, ce futur pion passé détournera le roi adverse.' : ''),
      steps: [
        `Pousse d'abord le pion candidat ${sqName(cand.sq)} (celui qui n'a pas de pion adverse devant lui).`,
        'Avance les pions en phalange pour qu\'ils se protègent.',
        endgame ? 'Ton roi peut soutenir l\'avance.' : 'Échange les pièces : la majorité pèse surtout en finale.',
      ],
      conceptId: 'pawn-majority',
      arrows: pushes.length ? [[cand.sq, pushes[0]]] : [],
      squares: wingPawns.map(p => p.sq),
      moves: pushes.map(to => ({ from: cand.sq, to })),
      priority: endgame ? 7 : kingsAway ? 5.5 : 4,
    })
  }

  // Our most advanced passed pawn.
  const passed = mine.pawns.filter(p => p.passed).sort((x, y) => relRank(side, y.sq) - relRank(side, x.sq))[0]
  if (passed) {
    const pushes = pawnPushes(r.board, side, passed.sq).slice(0, 1)
    const rr = relRank(side, passed.sq)
    out.push({
      id: `passed:${sqName(passed.sq)}`, side, kind: 'passed-pawn',
      title: `Pousse ton pion passé ${sqName(passed.sq)}`,
      why: 'Un pion passé ne peut être arrêté que par des pièces : chaque pas en avant immobilise un peu plus l\'adversaire.',
      steps: endgame ? [
        'Escorte-le avec ton roi.',
        'Place une tour derrière lui (règle de Tarrasch).',
        'Chasse ou échange la pièce qui le bloque.',
      ] : [
        'Soutiens son avance avec tes pièces.',
        'S\'il est bloqué, il fixe quand même une pièce adverse : profite-en ailleurs.',
      ],
      conceptId: 'passed-pawn',
      arrows: pushes.map(t => [passed.sq, t] as [number, number]),
      squares: [passed.sq],
      moves: pushes.map(to => ({ from: passed.sq, to })),
      priority: 4.5 + Math.max(0, rr - 4) + (endgame ? 2 : 0),
    })
  }

  // Blockade the enemy's most advanced passed pawn.
  const theirPassed = theirs.pawns.filter(p => p.passed).sort((x, y) => relRank(them, y.sq) - relRank(them, x.sq))[0]
  if (theirPassed) {
    const block = theirPassed.sq + (them === 'w' ? 8 : -8)
    const occ = r.board.squares[block]
    const blockaded = !!occ && occ.color === side
    if (!blockaded && block >= 0 && block < 64) {
      const rr = relRank(them, theirPassed.sq)
      out.push({
        id: `blockade:${sqName(theirPassed.sq)}`, side, kind: 'blockade',
        title: `Bloque le pion passé adverse en ${sqName(block)}`,
        why: `Le pion ${sqName(theirPassed.sq)} est passé : s'il avance, il coûtera une pièce. Nimzowitsch : un pion passé doit être mis "sous les verrous".`,
        steps: [
          `Installe une pièce en ${sqName(block)}, idéalement un cavalier (un bloqueur qui garde son activité).`,
          'Le bloqueur doit être solidement protégé.',
          endgame ? 'Rapproche ton roi : en finale c\'est le meilleur bloqueur.' : 'Évite d\'échanger le bloqueur.',
        ],
        conceptId: 'blockade',
        arrows: [], squares: [theirPassed.sq, block],
        moves: [{ to: block }],
        priority: 5 + Math.max(0, rr - 4) + (endgame ? 1.5 : 0),
      })
    }
  }
}

const squarePlans: Builder = (r, side, out) => {
  if (r.phase === 'opening' && r.board.fullmove < 8) return
  if (r.material[side].npm === 0) return
  const best = r.squares.outposts[side].find(o => o.score >= 6 && o.pawnProtected && !o.occupant && o.route)
  if (best?.route) {
    const path = [best.route.from, ...best.route.path]
    const arrows: [number, number][] = []
    for (let i = 0; i + 1 < path.length; i++) arrows.push([path[i], path[i + 1]])
    out.push({
      id: `outpost:${sqName(best.sq)}`, side, kind: 'outpost',
      title: `Installe un cavalier en ${sqName(best.sq)}`,
      why: `${sqName(best.sq)} est une case forte : ${best.reasons.filter(x => !x.startsWith('cavalier')).join(', ')}.`,
      steps: [
        `Itinéraire : ${path.map(sqName).join(' → ')} (${plural(best.route.path.length, 'coup')}).`,
        'Un cavalier sur un avant-poste ne peut être chassé par un pion : il vaut souvent plus qu\'un fou.',
        'Si l\'adversaire l\'échange, reprends de façon à garder le contrôle de la case.',
      ],
      conceptId: 'outpost',
      arrows, squares: [best.sq],
      moves: [{ from: best.route.from, to: best.route.path[0] }],
      priority: 5.5 + ((fileOf(best.sq) === 3 || fileOf(best.sq) === 4) ? 1 : 0),
    })
  }
}

const pieceAndFilePlans: Builder = (r, side, out) => {
  const them = opp(side)
  const theirs = side === 'w' ? r.pawns.b : r.pawns.w
  const mine = side === 'w' ? r.pawns.w : r.pawns.b
  if (r.phase === 'opening' && r.board.fullmove < 10) return

  // Attack a weak enemy pawn on a file we can use.
  const weak = theirs.pawns
    .filter(p => (p.isolated || p.backward) && mine.fileCounts[fileOf(p.sq)] === 0)
    .sort((x, y) => Number(y.backward) - Number(x.backward))[0]
  if (weak && r.material[side].rooks + r.material[side].queens > 0) {
    const f = fileOf(weak.sq)
    const front = weak.sq + (them === 'w' ? 8 : -8)
    const rookMoves = rookMovesToFile(r.board, side, f)
    out.push({
      id: `weak-pawn:${sqName(weak.sq)}`, side, kind: 'weak-pawn',
      title: `Attaque le pion ${weak.backward ? 'arriéré' : 'isolé'} ${sqName(weak.sq)}`,
      why: `Il ne peut pas être protégé par un pion et se trouve sur une ${fileName(f)} semi-ouverte pour toi.`,
      steps: [
        `Fixe-le : contrôle (ou occupe) la case ${sqName(front)} devant lui.`,
        `Double tes tours sur la ${fileName(f)}.`,
        'Ajoute des attaquants (cavalier, fou) : il faut plus d\'attaquants que de défenseurs.',
      ],
      conceptId: weak.backward ? 'backward-pawn' : 'isolated-pawn',
      arrows: rookMoves.slice(0, 2),
      squares: [weak.sq, front],
      moves: [...rookMoves.map(([from, to]) => ({ from, to })), { to: front }],
      priority: 5.5 + (r.phase === 'endgame' ? 1 : 0),
    })
  }

  // Open files for the rooks.
  const myRookFiles = new Set(piecesOf(r.board, side, 'r').map(fileOf))
  for (const f of r.pawns.openFiles) {
    if (myRookFiles.has(f)) continue
    const rookMoves = rookMovesToFile(r.board, side, f)
    if (rookMoves.length === 0) continue
    const theirRook = piecesOf(r.board, them, 'r').some(sq => fileOf(sq) === f)
    out.push({
      id: `open-file:${FILES[f]}`, side, kind: 'open-file',
      title: `${theirRook ? 'Conteste' : 'Prends'} la ${fileName(f)} ouverte`,
      why: 'Les tours appartiennent aux colonnes ouvertes : c\'est par là qu\'elles entrent dans le camp adverse.',
      steps: [
        `Place une tour en ${moveRef(rookMoves[0][0], rookMoves[0][1])}, puis double-la.`,
        'Objectif : pénétrer en 7e rangée.',
      ],
      conceptId: 'open-file',
      arrows: [rookMoves[0]], squares: [],
      moves: rookMoves.map(([from, to]) => ({ from, to })),
      priority: 5 - (theirRook ? 0.5 : 0) - (myRookFiles.size > 0 ? 0.5 : 0),
    })
    break
  }

  // Seventh rank.
  for (const rq of piecesOf(r.board, side, 'r')) {
    const f = fileOf(rq)
    if (!r.pawns.openFiles.includes(f) || relRank(side, rq) >= 7) continue
    const seventh = sqAt(f, side === 'w' ? 6 : 1)
    if (!attacksFrom(r.board, rq).includes(seventh)) continue
    const occ = r.board.squares[seventh]
    if (occ && occ.color === side) continue
    const targets = theirs.pawns.filter(p => relRank(side, p.sq) === 7).length
    const ek = kingSquare(r.board, them)
    if (targets === 0 && !(ek >= 0 && relRank(side, ek) === 8)) continue
    out.push({
      id: `seventh:${sqName(rq)}`, side, kind: 'seventh-rank',
      title: `Tour en 7e rangée (${moveRef(rq, seventh)})`,
      why: 'Une tour en 7e attaque les pions par derrière et enferme le roi adverse.',
      steps: ['Pénètre en 7e, puis double si possible (deux tours en 7e sont souvent décisives).'],
      conceptId: 'rook-seventh',
      arrows: [[rq, seventh]], squares: [seventh],
      moves: [{ from: rq, to: seventh }],
      priority: 6,
    })
    break
  }

  // Bishops.
  for (const bv of r.bishops[side]) {
    if (bv.verdict !== 'bad' || bv.activeDespiteBad) continue
    out.push({
      id: `bad-bishop:${sqName(bv.sq)}`, side, kind: 'bad-bishop',
      title: `Améliore ton mauvais fou ${sqName(bv.sq)}`,
      why: `${plural(bv.fixedCentralOnColor, 'pion central bloqué est', 'pions centraux bloqués sont')} sur sa couleur : il bute sur sa propre chaîne.`,
      steps: [
        'Sors-le devant tes pions (hors de la chaîne) plutôt que derrière.',
        'Ou échange-le contre une pièce adverse active, souvent le "bon" fou adverse.',
        'À long terme, place tes pions sur l\'autre couleur.',
      ],
      conceptId: 'bad-bishop',
      arrows: [], squares: [bv.sq],
      moves: [{ from: bv.sq }],
      priority: 4 + (r.phase === 'endgame' ? 0.5 : 0),
    })
    break
  }
  const m = r.material[side], t = r.material[them]
  const myPair = m.lightBishops > 0 && m.darkBishops > 0
  const theirPair = t.lightBishops > 0 && t.darkBishops > 0
  if (myPair && !theirPair && r.center.type !== 'closed') {
    const central = r.breaks[side].filter(b => b.central)
    out.push({
      id: 'bishop-pair', side, kind: 'bishop-pair',
      title: 'Ouvre la position pour ta paire de fous',
      why: 'La paire de fous contrôle les deux couleurs : plus la position est ouverte, plus elle pèse.',
      steps: [
        central[0] ? `Une rupture comme ${pushName(central[0].from, central[0].to)} ouvre des diagonales.` : 'Cherche des ruptures de pions qui ouvrent les diagonales.',
        'Évite de bloquer toi-même le centre.',
        'Les finales avec la paire de fous contre fou + cavalier sont souvent favorables.',
      ],
      conceptId: 'bishop-pair',
      arrows: [], squares: [],
      moves: central.map(b => ({ from: b.from, to: b.to })),
      priority: 4.5,
    })
  } else if (theirPair && !myPair && r.phase !== 'endgame') {
    out.push({
      id: 'anti-bishop-pair', side, kind: 'anti-bishop-pair',
      title: 'Neutralise la paire de fous adverse',
      why: 'L\'adversaire a la paire de fous : chaque ouverture du jeu la renforce.',
      steps: [
        'Garde des chaînes de pions qui limitent les diagonales.',
        'Crée des avant-postes pour tes cavaliers.',
        'Échange un des fous adverses quand l\'occasion se présente.',
      ],
      conceptId: 'bishop-pair',
      arrows: [], squares: [], moves: [],
      priority: 3.5,
    })
  }

  // Worst piece (unless it's the bad bishop we already talked about).
  const worst = r.activity[side][0]
  const badBishopPlanned = out.some(p => p.side === side && p.kind === 'bad-bishop' && p.squares[0] === worst?.sq)
  if (worst && worst.mobility <= 1 && !worst.engaged && r.phase !== 'opening' && !badBishopPlanned) {
    out.push({
      id: `worst:${sqName(worst.sq)}`, side, kind: 'worst-piece',
      title: `Améliore ta pire pièce : ${pieceRef(worst.type, worst.sq)}`,
      why: `Elle n'a que ${plural(worst.mobility, 'case utile', 'cases utiles')}. Quand rien ne presse, améliorer sa plus mauvaise pièce est le plan le plus sûr.`,
      steps: ['Cherche-lui une case où elle participe au plan (colonne ouverte, avant-poste, diagonale libre).'],
      conceptId: 'piece-activity',
      arrows: [], squares: [worst.sq],
      moves: [{ from: worst.sq }],
      priority: 3.5,
    })
  }
}

const kingPlans: Builder = (r, side, out) => {
  const them = opp(side)
  const mine = r.kings[side], theirs = r.kings[them]
  if (r.phase === 'endgame') {
    const k = kingSquare(r.board, side)
    const centerDist = Math.max(Math.abs(fileOf(k) - 3.5), Math.abs(rankOf(k) - 3.5))
    if (centerDist >= 2 && r.material.w.queens + r.material.b.queens === 0) {
      out.push({
        id: 'king-activity', side, kind: 'king-activity',
        title: 'Active ton roi',
        why: 'En finale, le roi est une pièce d\'attaque : il vaut à peu près une pièce mineure.',
        steps: [
          'Centralise-le.',
          'Dirige-le vers les pions faibles adverses ou devant ton pion passé.',
        ],
        conceptId: 'king-activity',
        arrows: [], squares: [k], moves: [{ from: k }],
        priority: 7,
      })
    }
    return
  }
  if (mine.danger >= 5) {
    out.push({
      id: 'king-safety', side, kind: 'king-safety',
      title: 'Mets ton roi en sécurité',
      why: `Ton roi est exposé (danger ${mine.danger}/10) : tant qu'il l'est, aucun plan à long terme ne compte.`,
      steps: [
        'Ramène un défenseur (souvent un cavalier en f3/f6 ou un fou) près du roi.',
        'Évite d\'avancer les pions devant ton roi.',
        'Échange les pièces d\'attaque adverses, la dame en premier.',
      ],
      conceptId: 'king-safety',
      arrows: [], squares: [mine.king], moves: [],
      priority: 8,
    })
  }
  const myQueen = r.material[side].queens > 0
  if (theirs.danger >= 5 && myQueen) {
    const kingFiles = [fileOf(theirs.king) - 1, fileOf(theirs.king), fileOf(theirs.king) + 1]
    const levers = r.breaks[side].filter(b => kingFiles.includes(fileOf(b.to)))
    const weakNear = r.squares.weak[them].filter(w => w.reasons.some(x => x.includes('près du roi'))).map(w => w.sq)
    out.push({
      id: 'king-attack', side, kind: 'king-attack',
      title: 'Attaque le roi adverse',
      why: `Le roi adverse est exposé (danger ${theirs.danger}/10)`
        + (theirs.missingShield.length ? ` : son bouclier de pions est entamé (colonne${theirs.missingShield.length > 1 ? 's' : ''} ${theirs.missingShield.map(f => FILES[f]).join(', ')}).` : '.'),
      steps: [
        `${plural(theirs.attackers, 'pièce vise', 'pièces visent')} déjà la zone du roi : amènes-en d'autres avant de frapper.`,
        levers[0] ? `Ouvre une ligne avec ${pushName(levers[0].from, levers[0].to)}.` : 'Ouvre une colonne vers le roi (rupture de pion ou sacrifice).',
        ...(weakNear.length ? [`Vise les cases faibles ${squareList(weakNear.slice(0, 3))}.`] : []),
      ],
      conceptId: 'king-safety',
      arrows: levers.slice(0, 1).map(b => [b.from, b.to] as [number, number]),
      squares: [theirs.king, ...weakNear.slice(0, 3)],
      moves: levers.map(b => ({ from: b.from, to: b.to })),
      priority: 6 + Math.min(2, (theirs.danger - 5) / 2),
    })
  }
  // Opposite-side castling → pawn storm.
  if (mine.castled && theirs.castled) {
    const myWing = fileOf(mine.king) <= 2 ? 'q' : 'k'
    const theirWing = fileOf(theirs.king) <= 2 ? 'q' : 'k'
    if (myWing !== theirWing) {
      const files = theirWing === 'k' ? [5, 6, 7] : [0, 1, 2]
      const pushes: [number, number][] = []
      const furthest: [number, number][] = []
      for (const p of (side === 'w' ? r.pawns.w : r.pawns.b).pawns) {
        if (!files.includes(fileOf(p.sq))) continue
        const t = pawnPushes(r.board, side, p.sq)
        for (const to of t) pushes.push([p.sq, to])
        if (t.length) furthest.push([p.sq, t[t.length - 1]])
      }
      out.push({
        id: 'pawn-storm', side, kind: 'pawn-storm',
        title: `Tempête de pions sur l'${theirWing === 'k' ? 'aile roi' : 'aile dame'}`,
        why: 'Roques opposés : tes pions peuvent avancer vers le roi adverse sans découvrir le tien. C\'est une course de vitesse.',
        steps: [
          'Pousse les pions devant le roi adverse pour ouvrir des colonnes.',
          'Chaque coup défensif est un tempo offert à l\'adversaire : attaque d\'abord.',
          'Amène les tours sur les colonnes qui vont s\'ouvrir.',
        ],
        conceptId: 'pawn-storm',
        arrows: furthest.slice(0, 3),
        squares: [theirs.king],
        moves: pushes.map(([from, to]) => ({ from, to })),
        priority: 7,
      })
    }
  }
}

const balancePlans: Builder = (r, side, out) => {
  const them = opp(side)
  if (r.phase !== 'endgame' && r.phase !== 'opening') {
    const diff = r.space[side] - r.space[them]
    if (diff >= 5) {
      out.push({
        id: 'space', side, kind: 'space',
        title: 'Exploite ton avantage d\'espace',
        why: `Tu as plus d'espace (${r.space[side]} contre ${r.space[them]}) : l'adversaire manque de cases pour ses pièces.`,
        steps: [
          'Évite les échanges : ils soulagent le camp à l\'étroit.',
          'Manœuvre derrière tes pions et prépare une percée sur une aile.',
          'Ne surétends pas tes pions : chaque poussée crée aussi des cases faibles.',
        ],
        conceptId: 'space', arrows: [], squares: [], moves: [], priority: 4,
      })
    } else if (diff <= -5) {
      const br = r.breaks[side][0]
      out.push({
        id: 'free-yourself', side, kind: 'free-yourself',
        title: 'Libère ta position',
        why: `Tu manques d'espace (${r.space[side]} contre ${r.space[them]}) : tes pièces se gênent.`,
        steps: [
          'Échange des pièces pour gagner de la place.',
          br ? `Cherche une rupture libératrice (${pushName(br.from, br.to)}).` : 'Prépare une rupture de pions libératrice.',
        ],
        conceptId: 'space',
        arrows: br ? [[br.from, br.to]] : [], squares: [],
        moves: br ? [{ from: br.from, to: br.to }] : [],
        priority: 5,
      })
    }
  }
  const balance = r.material[side].total - r.material[them].total
  if (balance >= 2) {
    out.push({
      id: 'simplify', side, kind: 'simplify',
      title: 'Simplifie : échange les pièces',
      why: `Tu as ${balance} points de matériel d'avance : chaque échange de pièces rapproche une finale gagnante.`,
      steps: [
        'Échange les pièces, pas les pions.',
        'Neutralise le contre-jeu adverse avant de pousser ton avantage.',
      ],
      conceptId: 'simplification', arrows: [], squares: [], moves: [], priority: 5.5,
    })
  } else if (balance <= -2 && r.phase !== 'endgame') {
    out.push({
      id: 'complicate', side, kind: 'complicate',
      title: 'Complique le jeu',
      why: `Tu as ${-balance} points de matériel de retard : la finale serait perdue, il faut de l'activité.`,
      steps: [
        'Garde les pièces sur l\'échiquier, évite les échanges.',
        'Cherche l\'initiative : menaces, attaque sur le roi.',
      ],
      conceptId: 'initiative', arrows: [], squares: [], moves: [], priority: 4.5,
    })
  }

  // Two weaknesses: count the opponent's fixed targets.
  if (r.phase !== 'opening') {
    const theirPawns = side === 'w' ? r.pawns.b : r.pawns.w
    const pawnTargets = theirPawns.pawns.filter(p => p.isolated || p.backward).map(p => p.sq)
    // A weak square right next to a weak pawn is the same weakness (its blockade square).
    const squareTargets = r.squares.weak[them].filter(w => w.score >= 7)
      .map(w => w.sq).filter(sq => pawnTargets.every(p => Math.abs(fileOf(p) - fileOf(sq)) >= 2))
    const uniq = [...new Set([...pawnTargets, ...squareTargets])]
    const far = uniq.some(a => uniq.some(b => Math.abs(fileOf(a) - fileOf(b)) >= 3))
    if (uniq.length >= 2 && far) {
      out.push({
        id: 'two-weaknesses', side, kind: 'two-weaknesses',
        title: 'Principe des deux faiblesses',
        why: `L'adversaire a plusieurs faiblesses éloignées les unes des autres (${squareList(uniq.slice(0, 4))}).`,
        steps: [
          'Une faiblesse se défend ; deux faiblesses éloignées étirent la défense jusqu\'à la rupture.',
          'Alterne la pression d\'une cible à l\'autre.',
          'Ne te presse pas : améliore d\'abord toutes tes pièces.',
        ],
        conceptId: 'two-weaknesses',
        arrows: [], squares: uniq.slice(0, 4), moves: [],
        priority: 5,
      })
    }
  }

  // Prophylaxis: the opponent's most dangerous break.
  if (r.phase !== 'endgame') {
    const theirBreak = r.breaks[them].find(b => b.central && b.score >= 6 && b.roles.length > 0
      && b.weakens === undefined && !b.weakensKing && !b.freesWeakPawn)
    if (theirBreak) {
      const timing = breakTiming(r, them, theirBreak)
      out.push({
        id: `prophylaxis:${sqName(theirBreak.to)}`, side, kind: 'prophylaxis',
        title: `Prophylaxie : surveille la rupture adverse ${pushName(theirBreak.from, theirBreak.to)}`,
        why: `C'est la rupture que l'adversaire cherche${theirBreak.roles.length ? ` (elle ${theirBreak.roles.join(' et ')})` : ''}.`
          + (timing.verdict === 'now' ? ' Elle est déjà jouable.' : ''),
        steps: [
          `Contrôle ${sqName(theirBreak.to)} avec une pièce de plus, ou fais en sorte que la rupture perde du matériel.`,
          'Avant chaque coup, demande-toi : que veut faire l\'adversaire ?',
        ],
        conceptId: 'prophylaxis',
        arrows: [[theirBreak.from, theirBreak.to]], arrowsAreThreats: true,
        squares: [theirBreak.to],
        moves: [{ to: theirBreak.to }],
        priority: 4.5 + (timing.verdict === 'now' ? 1 : 0),
      })
    }
  }
}

const BUILDERS: Builder[] = [structurePlans, developmentPlans, centerPlans, pawnPlans, squarePlans, pieceAndFilePlans, kingPlans, balancePlans]

export function buildPlans(r: ReportCore, side: Side): Plan[] {
  const out: Plan[] = []
  for (const b of BUILDERS) b(r, side, out)
  const seen = new Set<string>()
  return out
    .filter(p => (seen.has(p.id) ? false : (seen.add(p.id), true)))
    .sort((a, b) => b.priority - a.priority)
}
