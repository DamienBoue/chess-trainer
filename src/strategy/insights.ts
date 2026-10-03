// Descriptive findings: the assets (+) and weaknesses (−) of each side.
// Each insight is short (title), explained (detail), anchored on the board
// (squares) and linked to a concept card when one exists.

import { type Side, FILES, fileOf, opp, relRank, sqName, kingSquare } from './board'
import type { ReportCore } from './report'
import { pieceRef, plural, squareList, wingName } from './text'

export type InsightTheme = 'pawns' | 'squares' | 'pieces' | 'king' | 'space' | 'development' | 'material'

export interface Insight {
  id: string
  /** The side the finding is about. */
  side: Side
  theme: InsightTheme
  /** 'info' = shared context that favours neither side by itself. */
  polarity: 'plus' | 'minus' | 'info'
  title: string
  detail: string
  squares: number[]
  conceptId?: string
  /** Relevance, roughly 1 (anecdotal) … 10 (decisive). */
  weight: number
}

function pawnInsights(r: ReportCore, side: Side, out: Insight[]) {
  const mine = side === 'w' ? r.pawns.w : r.pawns.b
  const theirs = side === 'w' ? r.pawns.b : r.pawns.w
  const endgame = r.phase === 'endgame'
  const iqpNamed = r.structures.some(m => m.pattern.id === 'iqp' && m.sideA === side)
  const hangingNamed = r.structures.some(m => m.pattern.id === 'hanging-pawns' && m.sideA === side)

  for (const p of mine.pawns) {
    if (p.isolated && !p.passed && !(iqpNamed && fileOf(p.sq) === 3) && !hangingNamed) {
      const front = sqName(p.sq + (side === 'w' ? 8 : -8))
      out.push({
        id: `isolated:${side}:${sqName(p.sq)}`, side, theme: 'pawns', polarity: 'minus',
        title: `Pion isolé en ${sqName(p.sq)}`,
        detail: `Aucun pion voisin ne peut le protéger : il faudra le défendre avec des pièces, et la case ${front} devant lui est un point d'appui idéal pour l'adversaire.`
          + (!p.opposed ? ' Il est sur une colonne semi-ouverte : cible directe pour les tours adverses.' : ''),
        squares: [p.sq],
        conceptId: 'isolated-pawn',
        weight: 3 + (p.opposed ? 0 : 1) + (endgame ? 1 : 0),
      })
    }
    if (p.backward) {
      const front = sqName(p.sq + (side === 'w' ? 8 : -8))
      out.push({
        id: `backward:${side}:${sqName(p.sq)}`, side, theme: 'pawns', polarity: 'minus',
        title: `Pion arriéré en ${sqName(p.sq)}`,
        detail: `Il ne peut plus être soutenu par un pion voisin et ne peut pas avancer sans être pris : la case ${front} devant lui devient une case forte pour l'adversaire.`
          + (!p.opposed ? ' Sur colonne semi-ouverte, il sera attaqué par les tours.' : ''),
        squares: [p.sq],
        conceptId: 'backward-pawn',
        weight: 3 + (p.opposed ? 0 : 1) + (endgame ? 1 : 0),
      })
    }
    if (p.passed) {
      const rr = relRank(side, p.sq)
      const qualifiers = [p.protectedPassed ? 'protégé' : '', p.outsidePassed ? 'éloigné' : ''].filter(Boolean)
      out.push({
        id: `passed:${side}:${sqName(p.sq)}`, side, theme: 'pawns', polarity: 'plus',
        title: `Pion passé${qualifiers.length ? ' ' + qualifiers.join(' et ') : ''} en ${sqName(p.sq)}`,
        detail: 'Aucun pion adverse ne peut plus l\'arrêter : seules les pièces peuvent le bloquer.'
          + (p.protectedPassed ? ' Protégé par un pion, il immobilise une pièce adverse sans risque.' : '')
          + (p.outsidePassed ? ' Loin des autres pions, il détournera le roi adverse en finale.' : '')
          + (rr >= 6 ? ' Très avancé : chaque tempo compte.' : ''),
        squares: [p.sq],
        conceptId: 'passed-pawn',
        weight: 2 + Math.max(0, rr - 3) + (endgame ? 2 : 0) + (p.protectedPassed ? 1 : 0),
      })
    }
  }

  // Doubled pawns, grouped by file.
  for (let f = 0; f < 8; f++) {
    if (mine.fileCounts[f] < 2) continue
    const sqs = mine.pawns.filter(p => fileOf(p.sq) === f).map(p => p.sq)
    const isolatedToo = mine.pawns.some(p => fileOf(p.sq) === f && p.isolated)
    out.push({
      id: `doubled:${side}:${FILES[f]}`, side, theme: 'pawns', polarity: 'minus',
      title: `Pions doublés en ${FILES[f]}${isolatedToo ? ' (et isolés)' : ''}`,
      detail: `${squareList(sqs)} : moins mobiles, ils ne se protègent pas entre eux.`
        + (isolatedToo ? ' Doublés et isolés, c\'est une faiblesse sérieuse en finale.' : ' En contrepartie, la colonne voisine est souvent semi-ouverte.'),
      squares: sqs,
      conceptId: 'doubled-pawns',
      weight: isolatedToo ? 4 : 2,
    })
  }

  // Islands.
  const myIslands = mine.islands.length, theirIslands = theirs.islands.length
  if (myIslands >= 3 && myIslands > theirIslands) {
    out.push({
      id: `islands:${side}`, side, theme: 'pawns', polarity: 'minus',
      title: `${myIslands} îlots de pions (contre ${theirIslands})`,
      detail: 'Chaque îlot a au moins un pion sans protection de pion : plus d\'îlots, plus de cibles à défendre (règle de Capablanca).',
      squares: [],
      conceptId: 'pawn-islands',
      weight: 2 + (endgame ? 1 : 0),
    })
  }

  // Majorities (only meaningful when the wing isn't already counted as a passed pawn).
  for (const wing of ['queenside', 'kingside'] as const) {
    const a = mine.wings[wing], b = theirs.wings[wing]
    if (a > b && a >= 2) {
      const ownKing = kingSquare(r.board, side), theirKing = kingSquare(r.board, opp(side))
      const wingFiles = wing === 'queenside' ? [0, 1, 2] : [5, 6, 7]
      const kingsAway = ![ownKing, theirKing].some(k => k >= 0 && wingFiles.includes(fileOf(k)))
      out.push({
        id: `majority:${side}:${wing}`, side, theme: 'pawns', polarity: 'plus',
        title: `Majorité à l'${wingName(wing)} (${a} contre ${b})`,
        detail: 'Une majorité saine peut créer un pion passé.'
          + (kingsAway ? ' Elle est loin des rois : en finale, ce pion passé sera décisif.' : ''),
        squares: mine.pawns.filter(p => wingFiles.includes(fileOf(p.sq))).map(p => p.sq),
        conceptId: 'pawn-majority',
        weight: 2 + (endgame ? 2 : 0) + (kingsAway ? 1 : 0),
      })
    }
  }
}

function squareInsights(r: ReportCore, side: Side, out: Insight[]) {
  const them = opp(side)
  // Outposts are about pieces: irrelevant in pure king-and-pawn endings.
  const piecesLeft = (s: Side) => r.material[s].npm > 0
  const theirOutposts = new Set(r.squares.outposts[them]
    .filter(o => o.pawnProtected && o.score >= 6).slice(0, 2).map(o => o.sq))
  if (piecesLeft(side)) {
    for (const o of r.squares.outposts[side].filter(x => x.pawnProtected).slice(0, 2)) {
      if (o.score < 6) continue
      const ownKnight = o.occupant?.color === side && o.occupant.type === 'n'
      out.push({
        id: `outpost:${side}:${sqName(o.sq)}`, side, theme: 'squares', polarity: 'plus',
        title: ownKnight ? `Cavalier sur l'avant-poste ${sqName(o.sq)}` : `Case forte en ${sqName(o.sq)}`,
        detail: `${o.reasons.join(', ')}.`.replace(/^./, c => c.toUpperCase()),
        squares: [o.sq],
        conceptId: 'outpost',
        weight: Math.min(8, Math.round(o.score / 1.5)),
      })
    }
  }
  if (piecesLeft(them)) {
    for (const w of r.squares.weak[side].slice(0, 2)) {
      if (w.score < 6 || theirOutposts.has(w.sq)) continue
      out.push({
        id: `weak:${side}:${sqName(w.sq)}`, side, theme: 'squares', polarity: 'minus',
        title: `Case faible en ${sqName(w.sq)}`,
        detail: `${w.reasons.join(', ')}.`.replace(/^./, c => c.toUpperCase()),
        squares: [w.sq],
        conceptId: 'weak-square',
        weight: Math.min(8, Math.round(w.score / 1.5)),
      })
    }
  }
  const cc = r.squares.colorComplex[side]
  if (cc) {
    const colorFr = cc.color === 'light' ? 'blanches' : 'noires'
    out.push({
      id: `color-complex:${side}`, side, theme: 'squares', polarity: 'minus',
      title: `Cases ${colorFr} affaiblies`,
      detail: `Ton fou de cases ${colorFr} a disparu et plusieurs cases ${colorFr} (${squareList(cc.squares.slice(0, 4))}) ne sont plus contrôlables par tes pions : l'adversaire peut s'y infiltrer.`,
      squares: cc.squares,
      conceptId: 'color-complex',
      weight: 5,
    })
  }
}

function pieceInsights(r: ReportCore, side: Side, out: Insight[]) {
  const them = opp(side)
  const myB = r.material[side], theirB = r.material[them]
  const openish = r.center.type === 'open' || r.center.type === 'semi-open' || r.center.type === 'tension'
  if (myB.lightBishops >= 1 && myB.darkBishops >= 1 && !(theirB.lightBishops >= 1 && theirB.darkBishops >= 1)) {
    out.push({
      id: `bishop-pair:${side}`, side, theme: 'pieces', polarity: 'plus',
      title: 'Paire de fous',
      detail: 'Deux fous contrôlent les deux couleurs : un avantage durable qui grandit quand la position s\'ouvre et en finale.'
        + (openish ? ' Le centre est déjà assez ouvert pour les faire briller.' : ' Cherche à ouvrir le jeu.'),
      squares: [],
      conceptId: 'bishop-pair',
      weight: openish ? 4 : 3,
    })
  }

  for (const bv of r.bishops[side]) {
    if (bv.verdict === 'bad') {
      out.push({
        id: `bad-bishop:${side}:${sqName(bv.sq)}`, side, theme: 'pieces', polarity: 'minus',
        title: `Mauvais fou (${sqName(bv.sq)})${bv.activeDespiteBad ? ', mais actif' : ''}`,
        detail: `${plural(bv.ownCentralOnColor, 'pion central est', 'pions centraux sont')} sur des cases de sa couleur, dont ${bv.fixedCentralOnColor} bloqué${bv.fixedCentralOnColor > 1 ? 's' : ''} par des pions adverses`
          + (bv.activeDespiteBad ? ' — mais il est sorti devant sa chaîne et reste actif. En finale, il manquera de cibles.' : ' : il bute sur ses propres pions.'),
        squares: [bv.sq],
        conceptId: 'bad-bishop',
        weight: bv.activeDespiteBad ? 2 : 4,
      })
    } else if (bv.verdict === 'good' && r.phase !== 'opening') {
      out.push({
        id: `good-bishop:${side}:${sqName(bv.sq)}`, side, theme: 'pieces', polarity: 'plus',
        title: `Bon fou (${sqName(bv.sq)})`,
        detail: `Tes pions sont sur l'autre couleur et ${plural(bv.enemyPawnsOnColor, 'pion adverse', 'pions adverses')} sont sur la sienne : des cibles.`,
        squares: [bv.sq],
        conceptId: 'bad-bishop',
        weight: 2,
      })
    }
  }

  for (const sq of r.board.squares.map((p, i) => (p && p.color === side && p.type === 'n' ? i : -1)).filter(i => i >= 0)) {
    const f = fileOf(sq)
    if ((f === 0 || f === 7) && r.phase !== 'endgame') {
      const act = r.activity[side].find(a => a.sq === sq)
      if (act && act.mobility <= 3) {
        out.push({
          id: `rim-knight:${side}:${sqName(sq)}`, side, theme: 'pieces', polarity: 'minus',
          title: `Cavalier au bord (${sqName(sq)})`,
          detail: `Au bord, un cavalier contrôle deux fois moins de cases (${act.mobility} ici). Ramène-le vers le centre.`,
          squares: [sq],
          conceptId: 'piece-activity',
          weight: 2,
        })
      }
    }
  }

  for (const rk of r.rooks[side]) {
    if (rk.onSeventh) {
      out.push({
        id: `rook7:${side}:${sqName(rk.sq)}`, side, theme: 'pieces', polarity: 'plus',
        title: `Tour en 7e rangée (${sqName(rk.sq)})`,
        detail: 'Elle attaque les pions adverses à leur base et enferme le roi sur sa dernière rangée.',
        squares: [rk.sq], conceptId: 'rook-seventh', weight: 4,
      })
    } else if (rk.file !== 'closed' && r.phase !== 'opening') {
      out.push({
        id: `rookfile:${side}:${sqName(rk.sq)}`, side, theme: 'pieces', polarity: 'plus',
        title: `Tour sur colonne ${rk.file === 'open' ? 'ouverte' : 'semi-ouverte'} (${FILES[fileOf(rk.sq)]})`,
        detail: rk.file === 'open'
          ? 'Les tours appartiennent aux colonnes ouvertes : elle peut pénétrer en 7e rangée.'
          : 'Elle met la pression sur le pion adverse de la colonne.',
        squares: [rk.sq], conceptId: 'open-file', weight: rk.file === 'open' ? 3 : 2,
      })
    }
    if (rk.behindPassed !== undefined && r.phase === 'endgame') {
      const own = r.board.squares[rk.behindPassed]?.color === side
      out.push({
        id: `tarrasch:${side}:${sqName(rk.sq)}`, side, theme: 'pieces', polarity: 'plus',
        title: `Tour derrière le pion passé ${sqName(rk.behindPassed)}`,
        detail: own
          ? 'Règle de Tarrasch : derrière ton pion passé, la tour gagne en activité à chaque pas du pion.'
          : 'Règle de Tarrasch : derrière le pion passé adverse, la tour le freine tout en restant active.',
        squares: [rk.sq, rk.behindPassed], conceptId: 'tarrasch-rule', weight: 4,
      })
    }
  }

  // The least active piece — Lasker/Silman: improve your worst piece.
  if (r.phase !== 'opening') {
    const worst = r.activity[side][0]
    const isBadBishop = r.bishops[side].some(b => b.sq === worst?.sq && b.verdict === 'bad')
    if (worst && worst.mobility <= 1 && !worst.engaged && !isBadBishop) {
      out.push({
        id: `worst:${side}:${sqName(worst.sq)}`, side, theme: 'pieces', polarity: 'minus',
        title: `Pièce passive : ${pieceRef(worst.type, worst.sq)}`,
        detail: `Seulement ${plural(worst.mobility, 'case utile', 'cases utiles')}. "Améliore ta plus mauvaise pièce" est souvent le meilleur plan quand rien ne presse.`,
        squares: [worst.sq], conceptId: 'piece-activity', weight: 2,
      })
    }
  }

  if (myB.bishops === 1 && theirB.bishops === 1 && myB.lightBishops !== theirB.lightBishops && side === 'w') {
    // Shared fact — reported once (attached to White) as context.
    const ending = r.phase === 'endgame'
    out.push({
      id: 'ocb', side, theme: 'pieces', polarity: 'info',
      title: 'Fous de couleurs opposées',
      detail: ending
        ? 'En finale, les fous de couleurs opposées sont très nulsifiants : le défenseur bâtit une forteresse sur la couleur que l\'attaquant ne contrôle pas.'
        : 'En milieu de jeu, ils favorisent l\'attaquant : chaque fou attaque sur une couleur que l\'autre ne peut pas défendre.',
      squares: [], conceptId: 'opposite-colored-bishops', weight: 3,
    })
  }
}

/** Rule of the square: in a pure pawn ending, can the defending king
 *  catch the passed pawn? (Ignores obstacles on the way.) */
export function outsideSquare(r: ReportCore, pawnSq: number, owner: Side): boolean {
  const defender = opp(owner)
  const k = kingSquare(r.board, defender)
  if (k < 0) return true
  const rr = relRank(owner, pawnSq)
  const promo = (owner === 'w' ? 56 : 0) + fileOf(pawnSq)
  const pawnDist = 8 - Math.max(rr, 3) + (rr === 2 ? 1 : 0)
  const kingDist = Math.max(Math.abs(fileOf(k) - fileOf(promo)), Math.abs((k >> 3) - (promo >> 3)))
  const tempo = r.board.turn === defender ? 1 : 0
  return kingDist - tempo > pawnDist
}

function kingInsights(r: ReportCore, side: Side, out: Insight[]) {
  const k = r.kings[side]
  if (r.phase === 'endgame' && r.material.w.npm + r.material.b.npm === 0) {
    const mine = side === 'w' ? r.pawns.w : r.pawns.b
    for (const p of mine.pawns.filter(x => x.passed)) {
      const runs = outsideSquare(r, p.sq, side)
      out.push({
        id: `square:${side}:${sqName(p.sq)}`, side, theme: 'pawns', polarity: runs ? 'plus' : 'info',
        title: runs ? `Le pion ${sqName(p.sq)} file seul à dame` : `Le roi adverse est dans le carré du pion ${sqName(p.sq)}`,
        detail: runs
          ? 'Règle du carré : le roi adverse est trop loin pour rattraper ce pion passé.'
          : 'Règle du carré : le roi adverse peut rattraper ce pion — il faudra l\'escorter avec le roi.',
        squares: [p.sq], conceptId: 'square-rule', weight: runs ? 8 : 3,
      })
    }
  }
  if (r.phase === 'endgame') {
    // Endgame: the king is a fighting piece.
    const ks = kingSquare(r.board, side)
    const centerDist = Math.max(Math.abs(fileOf(ks) - 3.5), Math.abs((ks >> 3) - 3.5))
    if (centerDist >= 3 && r.material[side].queens + r.material[opp(side)].queens === 0) {
      out.push({
        id: `passive-king:${side}`, side, theme: 'king', polarity: 'minus',
        title: 'Roi passif',
        detail: 'En finale, le roi est une pièce forte : centralise-le avant que l\'adversaire ne le fasse.',
        squares: [ks], conceptId: 'king-activity', weight: 4,
      })
    }
    return
  }
  if (k.danger >= 4) {
    const parts: string[] = []
    if (k.missingShield.length) parts.push(`bouclier de pions incomplet (colonne${k.missingShield.length > 1 ? 's' : ''} ${k.missingShield.map(f => FILES[f]).join(', ')})`)
    if (k.openFilesNearKing.length) parts.push(`colonne${k.openFilesNearKing.length > 1 ? 's' : ''} ouverte${k.openFilesNearKing.length > 1 ? 's' : ''} vers le roi`)
    if (k.stormPawns.length) parts.push(`${plural(k.stormPawns.length, 'pion adverse', 'pions adverses')} en marche`)
    if (k.attackers) parts.push(`${plural(k.attackers, 'pièce adverse vise', 'pièces adverses visent')} la zone du roi`)
    if (k.inCenter) parts.push('roi resté au centre')
    out.push({
      id: `king-danger:${side}`, side, theme: 'king', polarity: 'minus',
      title: k.inCenter ? 'Roi au centre, exposé' : 'Roi exposé',
      detail: `${parts.join(', ')}.`.replace(/^./, c => c.toUpperCase()),
      squares: [k.king, ...k.stormPawns],
      conceptId: 'king-safety',
      weight: Math.min(9, Math.round(k.danger)),
    })
  } else if (k.inCenter && !k.canCastle && r.phase === 'middlegame') {
    out.push({
      id: `king-center:${side}`, side, theme: 'king', polarity: 'minus',
      title: 'Roi bloqué au centre',
      detail: 'Il ne peut plus roquer : si le centre s\'ouvre, il deviendra une cible.',
      squares: [k.king], conceptId: 'king-safety', weight: 3,
    })
  }
}

function developmentInsights(r: ReportCore, side: Side, out: Insight[]) {
  if (r.phase !== 'opening' || r.board.fullmove < 7) return
  const mine = r.undeveloped[side].length, theirs = r.undeveloped[opp(side)].length
  if (mine >= 2 && mine > theirs) {
    out.push({
      id: `undeveloped:${side}`, side, theme: 'development', polarity: 'minus',
      title: `Retard de développement (${mine} pièces mineures à la maison)`,
      detail: `Encore à sortir : ${r.undeveloped[side].map(sq => pieceRef(r.board.squares[sq]!.type, sq)).join(', ')}. Chaque coup de pion ou de dame en plus aggrave le retard.`,
      squares: r.undeveloped[side], conceptId: 'development', weight: 3 + (mine - theirs),
    })
  } else if (theirs - mine >= 2) {
    out.push({
      id: `dev-lead:${side}`, side, theme: 'development', polarity: 'plus',
      title: 'Avance de développement',
      detail: 'Tes pièces sont sorties plus vite : c\'est le moment d\'ouvrir le jeu avant que l\'adversaire ne rattrape son retard.',
      squares: [], conceptId: 'development', weight: 3,
    })
  }
}

function spaceInsights(r: ReportCore, side: Side, out: Insight[]) {
  if (r.phase === 'endgame') return
  const diff = r.space[side] - r.space[opp(side)]
  if (diff >= 5) {
    out.push({
      id: `space:${side}`, side, theme: 'space', polarity: 'plus',
      title: 'Avantage d\'espace',
      detail: `Tes pions avancés te donnent plus de cases sûres pour manœuvrer (${r.space[side]} contre ${r.space[opp(side)]}). Le camp à l'étroit cherchera à échanger.`,
      squares: [], conceptId: 'space', weight: diff >= 8 ? 4 : 3,
    })
  }
}

function materialInsights(r: ReportCore, side: Side, out: Insight[]) {
  const m = r.material[side], t = r.material[opp(side)]
  const minors = (x: typeof m) => x.knights + x.bishops
  if (m.rooks - t.rooks === 1 && minors(t) - minors(m) === 1) {
    out.push({
      id: `exchange:${side}`, side, theme: 'material', polarity: 'plus',
      title: 'Qualité d\'avance',
      detail: 'Tour contre pièce mineure : ouvre des colonnes pour tes tours et simplifie vers une finale.',
      squares: [], conceptId: 'simplification', weight: 4,
    })
  }
}

export function buildInsights(r: ReportCore): Insight[] {
  const out: Insight[] = []
  for (const side of ['w', 'b'] as Side[]) {
    pawnInsights(r, side, out)
    squareInsights(r, side, out)
    pieceInsights(r, side, out)
    kingInsights(r, side, out)
    developmentInsights(r, side, out)
    spaceInsights(r, side, out)
    materialInsights(r, side, out)
  }
  return out.sort((a, b) => b.weight - a.weight)
}
