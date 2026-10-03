// Named pawn structures and their textbook plans.
//
// Each pattern is written from the point of view of side "A" as if A were
// White (relative squares). It is tested in both orientations, so the
// Caro-Kann Exchange is recognised as a reversed Carlsbad where *Black*
// runs the minority attack. Plan texts use `[sq]` placeholders written in
// relative coordinates; they are mirrored for the side that actually owns
// the plan when rendered (`[b4]` becomes "b5" for Black).
//
// Sources: Flores Rios "Chess Structures — A Grandmaster Guide", Soltis
// "Pawn Structure Chess", Nimzowitsch "My System", classical theory.

import { type Board, type Side, FILES, sqIndex, opp } from './board'

export interface StructureView {
  /** A pawn on a relative square. */
  a: (sq: string) => boolean
  /** B pawn on a relative square (relative to A). */
  b: (sq: string) => boolean
  aFile: (file: string) => number
  bFile: (file: string) => number
}

export interface StructurePattern {
  id: string
  name: string
  conceptId?: string
  /** Who side A is, in a few words ("le camp au pion isolé"). */
  aRole: string
  bRole: string
  match: (v: StructureView) => boolean
  summary: string
  plansA: string[]
  plansB: string[]
  /** Thematic pawn moves for each side (relative from-to). */
  breaksA?: [string, string][]
  breaksB?: [string, string][]
  /** Key squares for each side (relative). */
  squaresA?: string[]
  squaresB?: string[]
}

export interface StructureMatch {
  pattern: StructurePattern
  /** The side playing the role of A. */
  sideA: Side
}

/** Mirror a relative square for `side` (identity for White). */
export function relSquare(rel: string, side: Side): string {
  return side === 'w' ? rel : rel[0] + (9 - Number(rel[1]))
}

/** Replace `[e4]`-style placeholders with the actual square for `side`. */
export function renderRel(text: string, side: Side): string {
  return text.replace(/\[([a-h][1-8])\]/g, (_, sq: string) => relSquare(sq, side))
}

function viewFor(board: Board, sideA: Side): StructureView {
  const sideB = opp(sideA)
  const pawnAt = (side: Side, rel: string) => {
    const p = board.squares[sqIndex(relSquare(rel, sideA))]
    return !!p && p.type === 'p' && p.color === side
  }
  const fileCount = (side: Side, file: string) => {
    const f = FILES.indexOf(file)
    let n = 0
    for (let r = 0; r < 8; r++) {
      const p = board.squares[r * 8 + f]
      if (p && p.type === 'p' && p.color === side) n++
    }
    return n
  }
  return {
    a: rel => pawnAt(sideA, rel),
    b: rel => pawnAt(sideB, rel),
    aFile: f => fileCount(sideA, f),
    bFile: f => fileCount(sideB, f),
  }
}

const anyOf = (v: (s: string) => boolean, squares: string[]) => squares.some(v)

export const STRUCTURES: StructurePattern[] = [
  {
    id: 'hedgehog',
    name: 'Hérisson',
    conceptId: 'hedgehog',
    aRole: 'le camp à l\'espace (c4-e4)',
    bRole: 'le camp hérisson (a6-b6-d6-e6)',
    match: v => v.a('c4') && v.a('e4') && v.aFile('d') === 0 && v.bFile('c') === 0
      && v.b('b6') && v.b('d6') && v.b('e6'),
    summary: 'Le hérisson se recroqueville derrière ses pions de 6e rangée, mais ses piquants (...b5 et ...d5) peuvent jaillir à tout moment.',
    plansA: [
      'Garder l\'espace sans se surétendre : surveiller en permanence les ruptures [b5] et [d5].',
      'Pression sur le pion [d6] (tours sur la colonne d) et occupation de [d5] quand c\'est possible.',
      'Attaque à l\'aile roi par [g4]-[g5] si les pièces adverses sont trop passives.',
    ],
    plansB: [
      'Patience : regroupe tes pièces derrière les pions (dame en [c7], tours en [c8]/[d8], cavalier en [d7]).',
      'Prépare les ruptures [b5] (après [a6]) et surtout [d5] : quand l\'une passe, ton jeu s\'ouvre d\'un coup.',
      'Échange des pièces pour réduire le manque d\'espace.',
    ],
    breaksB: [['b6', 'b5'], ['d6', 'd5']],
    squaresA: ['d5'],
  },
  {
    id: 'maroczy',
    name: 'Étau de Maroczy',
    conceptId: 'maroczy-bind',
    aRole: 'le camp à l\'étau (c4-e4)',
    bRole: 'le camp comprimé',
    match: v => v.a('c4') && v.a('e4') && v.aFile('d') === 0 && v.bFile('c') === 0
      && (v.b('d6') || v.b('d7')),
    summary: 'Les pions c4 et e4 contrôlent d5 et étouffent les ruptures ...b5 et ...d5. Le camp à l\'espace évite les échanges ; le camp comprimé les recherche.',
    plansA: [
      'Interdire [b5] et [d5] : c\'est tout le sens de l\'étau.',
      'Installer une pièce en [d5] (cavalier) et jouer sur les colonnes c et d.',
      'Éviter les échanges : avec plus d\'espace, chaque échange soulage l\'adversaire.',
    ],
    plansB: [
      'Échanger des pièces (surtout les cavaliers) pour soulager la position.',
      'Jouer sur les cases noires : fou en [g7], cavalier vers [c5], [a5] pour fixer.',
      'Préparer la rupture [b5] ou [f5] (parfois [d5]) au bon moment.',
    ],
    breaksB: [['b7', 'b5'], ['f7', 'f5']],
    squaresA: ['d5'],
    squaresB: ['c5', 'e5'],
  },
  {
    id: 'boleslavsky',
    name: 'Trou d5 (Najdorf / Sveshnikov)',
    conceptId: 'boleslavsky-hole',
    aRole: 'le camp qui vise la case d5 (pion e4)',
    bRole: 'le camp aux pions d6-e5',
    match: v => v.a('e4') && v.aFile('d') === 0 && v.aFile('c') >= 1
      && v.b('d6') && v.b('e5') && v.bFile('c') === 0,
    summary: '...e5 donne au camp noir le centre et l\'espace, au prix d\'un trou en d5 et d\'un pion d6 arriéré. Toute la partie tourne autour de la case d5.',
    plansA: [
      'Contrôler puis occuper [d5] (cavalier), au besoin en échangeant les défenseurs de [d5] (fou en [g5]x[f6], fou blanc contre fou de cases blanches).',
      'Mettre la pression sur le pion arriéré [d6] (colonne d).',
      'Jouer [a4] pour freiner l\'expansion adverse à l\'aile dame.',
    ],
    plansB: [
      'Réaliser la rupture libératrice [d5] : si elle passe sans dommage, la faiblesse disparaît.',
      'Garder le fou de cases blanches (il défend [d5]) et contrôler [d5] avec les pièces.',
      'Contre-jeu à l\'aile dame : [b5]-[b4] pour chasser le cavalier de [c3], tours sur la colonne c.',
    ],
    breaksB: [['d6', 'd5'], ['b5', 'b4'], ['f7', 'f5']],
    squaresA: ['d5'],
  },
  {
    id: 'scheveningen',
    name: 'Petit centre sicilien (d6-e6)',
    conceptId: 'sicilian',
    aRole: 'le camp au pion e4',
    bRole: 'le camp aux pions d6-e6',
    match: v => v.a('e4') && v.aFile('d') === 0 && !v.a('c4')
      && v.b('d6') && v.b('e6') && v.bFile('c') === 0,
    summary: 'Structure "Scheveningen" : le camp aux pions d6-e6 a une majorité centrale solide et la colonne c semi-ouverte ; l\'autre camp a l\'espace et joue souvent pour l\'attaque.',
    plansA: [
      'Attaque à l\'aile roi : [f4], [g4]-[g5], parfois la rupture [f5] contre [e6].',
      'Rupture centrale [e5] au bon moment pour ouvrir vers le roi.',
      'En cas de roques opposés : tempête de pions sans perdre de temps.',
    ],
    plansB: [
      'Rupture centrale [d5] dès qu\'elle est tactiquement possible : elle neutralise l\'attaque.',
      'Contre-jeu aile dame : [a6], [b5]-[b4], tours sur la colonne c (sacrifice de qualité en [c3] typique).',
      'Ne pas ouvrir son roi : défendre d\'abord, contre-attaquer ensuite.',
    ],
    breaksA: [['f2', 'f4'], ['g2', 'g4'], ['e4', 'e5']],
    breaksB: [['d6', 'd5'], ['b7', 'b5']],
  },
  {
    id: 'dragon',
    name: 'Structure Dragon',
    conceptId: 'sicilian',
    aRole: 'le camp au pion e4',
    bRole: 'le camp au fianchetto (d6-g6)',
    match: v => v.a('e4') && v.aFile('d') === 0
      && v.b('d6') && v.b('g6') && v.b('e7') && v.bFile('c') === 0,
    summary: 'Le fou fianchetté en g7 vise la grande diagonale. Avec des roques opposés, c\'est une course d\'attaques : chaque tempo compte.',
    plansA: [
      'Échanger le fou fianchetté (fou en [h6]) et ouvrir la colonne h ([h4]-[h5]).',
      'Roque opposé et attaque directe sur le roi.',
    ],
    plansB: [
      'Contre-attaque sur la colonne c ([c8], sacrifice de qualité en [c3]) et avec les pions [b5]-[b4].',
      'Garder le fou de [g7] : c\'est le pilier de l\'attaque et de la défense.',
    ],
    breaksA: [['h2', 'h4'], ['h4', 'h5']],
    breaksB: [['b7', 'b5'], ['b5', 'b4']],
  },
  {
    id: 'hanging-pawns',
    name: 'Pions pendants',
    conceptId: 'hanging-pawns',
    aRole: 'le camp aux pions pendants',
    bRole: 'le camp qui les attaque',
    match: v => (v.a('c4') && v.a('d4') && v.aFile('b') === 0 && v.aFile('e') === 0
      && v.bFile('c') === 0 && v.bFile('d') === 0)
      || (v.a('d4') && v.a('e4') && v.aFile('c') === 0 && v.aFile('f') === 0
        && v.bFile('d') === 0 && v.bFile('e') === 0),
    summary: 'Deux pions côte à côte sans voisins : forts tant qu\'ils restent mobiles et côte à côte, faibles dès qu\'on force l\'un à avancer.',
    plansA: [
      'Les garder côte à côte et utiliser les colonnes semi-ouvertes adjacentes pour les tours.',
      'Pousser l\'un d\'eux ([d5] typiquement) au moment où ça ouvre des lignes vers le roi ou crée un pion passé.',
      'Rester actif : éviter les échanges qui mènent à une finale où les pions deviennent des cibles.',
    ],
    plansB: [
      'Mettre la pression (tours sur les colonnes c et d, fou en long sur la diagonale) pour forcer l\'avance d\'un pion.',
      'Dès qu\'un pion avance, bloquer la case devant lui et attaquer celui qui reste en arrière.',
      'Échanger les pièces : en finale, les pions pendants sont des cibles.',
    ],
    breaksA: [['d4', 'd5'], ['c4', 'c5']],
  },
  {
    id: 'iqp',
    name: 'Pion dame isolé (IQP)',
    conceptId: 'isolated-queen-pawn',
    aRole: 'le camp au pion isolé',
    bRole: 'le camp qui bloque le pion isolé',
    match: v => anyOf(v.a, ['d3', 'd4', 'd5']) && v.aFile('d') === 1 && v.aFile('c') === 0 && v.aFile('e') === 0
      && v.bFile('d') === 0,
    summary: 'Le pion isolé donne de l\'espace et des avant-postes (e5, c5) mais devient une cible en finale. Le possesseur joue l\'attaque, l\'adversaire joue le blocus et les échanges.',
    plansA: [
      'Jouer dynamique : pièces actives, cavalier en [e5], batterie dame-fou vers le roi ([d3]/[c2]).',
      'Rupture [d5] au bon moment pour liquider le pion isolé et ouvrir le jeu.',
      'Éviter les échanges (surtout des pièces mineures) : chaque échange rapproche une finale défavorable.',
      'Levée de tour par la 3e rangée ([e3]-[g3]) vers l\'aile roi.',
    ],
    plansB: [
      'Bloquer le pion : une pièce (idéalement un cavalier) en [d5].',
      'Échanger les pièces, surtout les attaquants (fou de cases blanches, cavaliers) : la finale te sourit.',
      'Attaquer le pion avec les tours (colonne d) et le fou ; ne pas le prendre trop tôt si ça active l\'adversaire.',
    ],
    breaksA: [['d4', 'd5']],
    squaresA: ['e5', 'c5'],
    squaresB: ['d5'],
  },
  {
    id: 'carlsbad',
    name: 'Structure Carlsbad',
    conceptId: 'carlsbad',
    aRole: 'le camp qui mène l\'attaque de minorité',
    bRole: 'le camp à la majorité aile dame',
    match: v => v.a('d4') && v.aFile('c') === 0 && v.aFile('e') >= 1 && v.aFile('b') >= 1
      && v.b('d5') && v.b('c6') && v.bFile('e') === 0,
    summary: 'Structure du Gambit Dame Refusé échange (et de la Caro-Kann échange en couleurs inversées). Plan roi : l\'attaque de minorité ; l\'autre camp répond par le jeu sur l\'aile roi et la case e4.',
    plansA: [
      'Attaque de minorité : [b4]-[b5] (préparé par [a4] ou une tour en [b1]) pour provoquer [c6]x[b5] ou laisser un pion [c6] faible.',
      'Tours sur la colonne c semi-ouverte, puis viser le pion [c6] (ou [d5] s\'il devient isolé).',
      'Plan alternatif : [f3] puis [e4] (rupture centrale), quand les pièces sont prêtes.',
    ],
    plansB: [
      'Jeu sur l\'aile roi : cavalier en [e4] (soutenu par [f5]), fou en [d6], dame vers [h4]/[f6].',
      'Freiner l\'attaque de minorité par [a5] ou [b5] au bon moment.',
      'Rupture [c5] parfois possible pour se débarrasser du futur pion faible.',
    ],
    breaksA: [['b2', 'b4'], ['b4', 'b5'], ['e3', 'e4']],
    breaksB: [['f7', 'f5'], ['c6', 'c5']],
    squaresA: ['e5', 'c5'],
    squaresB: ['e4'],
  },
  {
    id: 'caro-slav',
    name: 'Structure Caro-Kann (d4 contre c6-e6)',
    conceptId: 'caro-kann',
    aRole: 'le camp au pion d4',
    bRole: 'le camp aux pions c6-e6',
    match: v => v.a('d4') && v.aFile('e') === 0 && v.b('c6') && v.b('e6') && v.bFile('d') === 0,
    summary: 'Le camp au pion d4 a plus d\'espace ; le camp aux pions c6-e6 est très solide et attend son heure pour frapper le centre.',
    plansA: [
      'Exploiter l\'espace : avance à l\'aile roi ([h4]-[h5], [g4]) ou roque opposé et tempête.',
      'Pièces sur [e5] (avant-poste) et colonne e semi-ouverte.',
      'Rupture [d5] quand l\'adversaire relâche la surveillance.',
    ],
    plansB: [
      'La rupture [c5] : c\'est le coup libérateur principal. Préparer avec les pièces, puis frapper.',
      'Rupture [e5] alternative, si la pression sur d4 ne suffit pas.',
      'Utiliser la case [d5] pour les pièces (cavalier en [d5]).',
    ],
    breaksA: [['d4', 'd5'], ['h2', 'h4']],
    breaksB: [['c6', 'c5'], ['e6', 'e5']],
    squaresA: ['e5'],
    squaresB: ['d5'],
  },
  {
    id: 'french-chain',
    name: 'Chaîne française (e5-d4 contre e6-d5)',
    conceptId: 'french',
    aRole: 'le camp à la chaîne e5-d4',
    bRole: 'le camp à la chaîne e6-d5',
    match: v => v.a('d4') && v.a('e5') && v.b('d5') && v.b('e6'),
    summary: 'Deux chaînes de pions se font face. Règle de Nimzowitsch : on attaque la base de la chaîne adverse (d4 par ...c5, e6 par f5) et on joue du côté où pointent ses pions.',
    plansA: [
      'Attaque à l\'aile roi, où pointe ta chaîne : [f4]-[f5], dame en [g4], fou en [d3].',
      'Défendre la base [d4] ([c3], cavalier en [f3]) et garder [e5] solide.',
      'La rupture [f5] attaque la base [e6] de la chaîne adverse.',
    ],
    plansB: [
      'Attaquer la base [d4] avec [c5], puis pression (dame en [b6], cavalier en [c6]/[f5]).',
      'Saper la tête [e5] avec [f6] pour ouvrir la colonne f.',
      'Améliorer ou échanger le mauvais fou de cases blanches ([b6] + [a6], ou [d7]-[b5]).',
    ],
    breaksA: [['f2', 'f4'], ['f4', 'f5']],
    breaksB: [['c7', 'c5'], ['f7', 'f6']],
  },
  {
    id: 'kid-closed',
    name: 'Centre fermé est-indien (d5-e4 contre d6-e5)',
    conceptId: 'kings-indian',
    aRole: 'le camp aux pions d5-e4',
    bRole: 'le camp aux pions d6-e5',
    match: v => v.a('d5') && v.a('e4') && v.b('d6') && v.b('e5'),
    summary: 'Centre totalement bloqué : chacun attaque sur l\'aile où pointe sa chaîne. Une course de vitesse — l\'aile dame pour l\'un, l\'aile roi pour l\'autre.',
    plansA: [
      'Expansion à l\'aile dame : [b4], [c5] pour attaquer la base [d6] et ouvrir la colonne c.',
      'Cavalier vers [c4] (via [d2]) pour peser sur [d6] et [e5].',
      'Contenir l\'attaque adverse : [f3], [g4] parfois, ne pas ouvrir son propre roi.',
    ],
    plansB: [
      'Attaque à l\'aile roi : [f5] (attaque la base [e4]), puis [f4], [g5]-[g4].',
      'Préparer [f5] par un cavalier en [e8] ou [h5].',
      'Ne pas réagir à l\'aile dame : la vitesse de l\'attaque prime.',
    ],
    breaksA: [['c4', 'c5'], ['b2', 'b4']],
    breaksB: [['f7', 'f5'], ['g7', 'g5']],
  },
  {
    id: 'benoni',
    name: 'Structure Benoni',
    conceptId: 'benoni',
    aRole: 'le camp à la majorité centrale (d5)',
    bRole: 'le camp à la majorité aile dame (c5-d6)',
    match: v => v.a('d5') && v.aFile('c') === 0 && v.b('c5') && v.b('d6') && v.bFile('e') === 0,
    summary: 'Déséquilibre de majorités : le camp au pion d5 a la majorité centrale (rupture e5), l\'autre la majorité à l\'aile dame (rupture b5) et une diagonale g7-b2 puissante.',
    plansA: [
      'Rupture centrale [e5] (préparée par [f4]) : elle libère la majorité centrale et vise le roi.',
      'Freiner l\'aile dame adverse avec [a4] ; cavalier en [c4] pour presser [d6].',
    ],
    plansB: [
      'Mobiliser la majorité aile dame : [a6], [b5] (avec la tour en [b8]).',
      'Utiliser la case [e5] pour un cavalier et la grande diagonale pour le fou.',
      'Pression sur [e4] (tour en [e8]) pour freiner la rupture centrale.',
    ],
    breaksA: [['e4', 'e5'], ['f2', 'f4']],
    breaksB: [['b7', 'b5'], ['a7', 'a6']],
    squaresB: ['e5', 'c4'],
  },
  {
    id: 'stonewall',
    name: 'Stonewall',
    conceptId: 'stonewall',
    aRole: 'le camp au Stonewall (d4-e3-f4)',
    bRole: 'le camp face au Stonewall',
    match: v => v.a('d4') && v.a('e3') && v.a('f4'),
    summary: 'Mur de pions sur cases noires : avant-poste solide en e5 pour le camp au Stonewall, mais trou en e4 et mauvais fou de cases noires.',
    plansA: [
      'Cavalier en [e5], soutenu par [d4] et [f4].',
      'Attaque à l\'aile roi : tour par [f3]-[h3], dame vers [h4], parfois [g4]-[g5].',
      'Régler le problème du fou de cases noires (l\'échanger, ou le sortir par [d2]-[e1]-[h4]).',
    ],
    plansB: [
      'Occuper le trou [e4] (cavalier) et échanger le bon fou adverse si possible.',
      'Jeu à l\'aile dame : [c5], [b5] pour ouvrir des lignes loin du roi.',
      'Chasser ou échanger le cavalier de [e5] ([f6] ou pièce sur [d7]).',
    ],
    breaksB: [['c7', 'c5'], ['f7', 'f6']],
    squaresA: ['e5'],
    squaresB: ['e4'],
  },
  {
    id: 'nimzo-doubled',
    name: 'Pions c doublés (Nimzo-Indienne)',
    conceptId: 'nimzo-indian',
    aRole: 'le camp aux pions c doublés',
    bRole: 'le camp qui cible c4',
    match: v => v.a('c3') && v.a('c4') && v.a('d4'),
    summary: 'Pions doublés c3-c4 contre la paire de fous : le camp aux pions doublés veut ouvrir le jeu (e4-e5, f3), l\'autre veut le garder fermé et cibler c4.',
    plansA: [
      'Ouvrir le centre pour la paire de fous : [f3] puis [e4] (et [e5]).',
      'Attaque à l\'aile roi avec les fous.',
    ],
    plansB: [
      'Fixer puis attaquer le pion [c4] : [b6], fou en [a6], cavalier en [a5], tour en [c8].',
      'Garder la position fermée (pions sur cases noires [d6]/[e5]) : les cavaliers valent mieux que les fous.',
    ],
    breaksA: [['e3', 'e4'], ['f2', 'f3']],
    squaresB: ['c4'],
  },
  {
    id: 'triangle',
    name: 'Triangle c3-d4-e3 (Londres / Colle / Slave)',
    conceptId: 'london-system',
    aRole: 'le camp au triangle c3-d4-e3',
    bRole: 'le camp au pion d5',
    match: v => v.a('c3') && v.a('d4') && v.a('e3') && !v.a('f4') && v.b('d5') && v.aFile('c') === 1,
    summary: 'Structure solide et compacte. Le camp au triangle cherche [e4] ou un cavalier en e5 ; l\'autre camp vise les ruptures ...c5 et ...e5.',
    plansA: [
      'Rupture [e4] (préparée par un cavalier en [d2] et un fou en [d3]).',
      'Cavalier en [e5] soutenu par [f4] : jeu à l\'aile roi.',
    ],
    plansB: [
      'Ruptures [c5] (souvent avec la dame en [b6] pour viser [b2]) ou [e5] : frapper le triangle par un côté.',
      'Si ton pion c est déjà avancé : pression sur [d4] et gain d\'espace à l\'aile dame.',
    ],
    breaksA: [['e3', 'e4']],
    breaksB: [['c7', 'c5'], ['e6', 'e5']],
    squaresA: ['e5'],
  },
  {
    id: 'slav',
    name: 'Formation Slave (d4-e3 contre c6-e6)',
    conceptId: 'pawn-structure',
    aRole: 'le camp aux pions d4-e3',
    bRole: 'le camp aux pions c6-e6',
    match: v => v.a('d4') && v.a('e3') && v.aFile('c') === 0 && v.b('c6') && v.b('e6') && v.bFile('d') === 0,
    summary: 'Le camp au pion d4 a l\'espace et les avant-postes e5/c5 ; le camp c6-e6 est solide mais doit trouver sa rupture (...c5 ou ...e5) pour respirer.',
    plansA: [
      'Cavaliers en [e5] et [c5], les deux avant-postes naturels.',
      'Rupture [e4] puis [e5] pour fixer et contrôler [d6], ou attaque de roi avec [h4]-[h5].',
      'Attaque de minorité [a4], [b4]-[b5] à l\'aile dame, ou simple [b4] pour interdire [c5].',
    ],
    plansB: [
      'Rupture [e5] : la plus réaliste, elle libère le jeu (structure 4 contre 3 à l\'aile roi).',
      'Rupture [c5] : symétrie après dxc5, ou pion isolé après ...cxd4.',
      'Sortir le fou de cases blanches avant [e6] (fou en [f5] ou [g4]) : c\'est lui qui manque d\'air.',
    ],
    breaksA: [['e3', 'e4'], ['b2', 'b4']],
    breaksB: [['e6', 'e5'], ['c6', 'c5']],
    squaresA: ['e5', 'c5'],
  },
  {
    id: 'panov-chain',
    name: 'Chaîne c5-d4 (Panov)',
    conceptId: 'pawn-chain',
    aRole: 'le camp aux pions c5-d4',
    bRole: 'le camp au pion d5',
    match: v => v.a('c5') && v.a('d4') && v.b('d5') && v.bFile('c') === 0,
    summary: 'Le pion c5 gagne de l\'espace et prépare un pion passé à l\'aile dame ; en échange d4 devient la base d\'une chaîne que l\'adversaire va harceler.',
    plansA: [
      'Créer un pion passé à l\'aile dame : [b4]-[b5] puis [c6].',
      'Exploiter les cases noires [e5] et [d6] (avant-postes).',
    ],
    plansB: [
      'Attaquer l\'avant de la chaîne avec [b6] pour échanger le pion c5.',
      'Attaquer la base [d4] : cavalier en [c6], fou en [f6], rupture [e5].',
      'Installer un cavalier en [e4].',
    ],
    breaksA: [['b2', 'b4'], ['b4', 'b5']],
    breaksB: [['b7', 'b6'], ['e6', 'e5']],
    squaresA: ['e5', 'd6'],
    squaresB: ['e4'],
  },
  {
    id: 'd5-chain',
    name: 'Chaîne d5 (Najdorf type I)',
    conceptId: 'pawn-chain',
    aRole: 'le camp au pion d5',
    bRole: 'le camp aux pions d6-e5',
    match: v => v.a('d5') && v.aFile('e') === 0 && v.b('d6') && v.b('e5') && v.bFile('c') === 0,
    summary: 'Après ...cxd5 exd5 : le camp au pion d5 a la majorité à l\'aile dame, l\'autre la majorité centrale et l\'aile roi. Chacun pousse sa majorité.',
    plansA: [
      'Mobiliser la majorité aile dame : [b4], [c4]-[c5] contre le pion arriéré [d6].',
      'Si l\'adversaire joue [f5] : fou sur la diagonale b1-h7 et [g4] pour casser.',
    ],
    plansB: [
      'Expansion à l\'aile roi [f5] (puis [e4]) et attaque sur le roi.',
      'Freiner l\'aile dame adverse avec [b5].',
    ],
    breaksA: [['c2', 'c4'], ['b2', 'b4']],
    breaksB: [['f7', 'f5'], ['b7', 'b5']],
    squaresA: ['c4', 'c6'],
    squaresB: ['e4'],
  },
  {
    id: 'benoni-sym',
    name: 'Benoni symétrique (c4-d5 contre c5-d6)',
    conceptId: 'benoni',
    aRole: 'le camp au pion d5',
    bRole: 'le camp au pion d6',
    match: v => v.a('c4') && v.a('d5') && v.aFile('e') === 0 && v.b('c5') && v.b('d6') && v.bFile('e') === 0,
    summary: 'Colonne e ouverte, le camp au pion d6 est à l\'étroit : il doit échanger et tenir e4, pendant que l\'autre avance à l\'aile roi.',
    plansA: [
      'Expansion à l\'aile roi : [f4], [g4] — c\'est le plan clé.',
      'Viser le pion [d6] (fou sur la diagonale h2-b8, cavalier en [e4]).',
    ],
    plansB: [
      'Contrôler [e4] et y installer un cavalier.',
      'Contre-jeu [b5] contre le pion [d5] ; échanger des pièces.',
      'Répondre à [f4] par [f5] et empêcher [g4].',
    ],
    breaksA: [['f2', 'f4'], ['g2', 'g4']],
    breaksB: [['b7', 'b5'], ['f7', 'f5']],
    squaresB: ['e4'],
  },
  {
    id: 'french-open',
    name: 'Française type I (e6 arriéré)',
    conceptId: 'french',
    aRole: 'le camp au pion d4',
    bRole: 'le camp aux pions d5-e6',
    match: v => v.a('d4') && v.aFile('e') === 0 && v.b('d5') && v.b('e6') && v.bFile('f') === 0,
    summary: 'Après ...f6 et exf6, le pion e6 est arriéré et e5 devient un avant-poste : toute la partie tourne autour de cette case.',
    plansA: [
      'Contrôler et occuper [e5] (cavalier, puis tour ou fou).',
      'Presser le pion [e6] : tours doublées sur la colonne e.',
      'Une fois [e5] tenu : expansion [f4] / [h4]-[h5] contre le roi.',
    ],
    plansB: [
      'Tout pour empêcher [e5] : pression sur [d4] ([c5], cavalier en [c6], dame en [b6]).',
      'Activer le fou de cases blanches ([d7]-[e8]-[h5]) et doubler les tours sur la colonne f.',
      'Rupture [e5] pour se libérer (au prix d\'un pion isolé).',
    ],
    breaksA: [['f2', 'f4']],
    breaksB: [['c7', 'c5'], ['e6', 'e5']],
    squaresA: ['e5'],
  },
  {
    id: 'french-e5',
    name: 'Française type II (chaîne c3-e5)',
    conceptId: 'french',
    aRole: 'le camp au pion e5',
    bRole: 'le camp aux pions d5-e6',
    match: v => v.a('c3') && v.a('e5') && v.aFile('d') === 0 && v.b('d5') && v.b('e6') && v.bFile('c') === 0,
    summary: 'Sans pions d blanc ni c noir : la case d4 devient centrale pour le camp au pion e5, qui attaque la base e6 et le roi.',
    plansA: [
      'Contrôler [d4] (cavalier soutenu par [c3], fou en [e3], tour en [d1]).',
      'Attaquer la base [e6] par [f4]-[f5] ; attaque à l\'aile roi ([f6], dame en [h5]).',
    ],
    plansB: [
      'Saper la chaîne par [f6] (ou [g5] contre e5).',
      'Échanger ou sortir le mauvais fou de cases blanches ; simplifier.',
      'Attaque de minorité [b5]-[b4].',
    ],
    breaksA: [['f2', 'f4'], ['f4', 'f5']],
    breaksB: [['f7', 'f6'], ['b7', 'b5']],
    squaresA: ['d4'],
  },
  {
    id: 'majority-3-4',
    name: 'Majorités 3-3 contre 4-2',
    conceptId: 'pawn-majority',
    aRole: 'le camp à la majorité aile dame (3-3)',
    bRole: 'le camp à la majorité aile roi (4-2)',
    match: v => v.aFile('d') === 0 && v.aFile('e') === 0 && v.bFile('c') === 0 && v.bFile('d') === 0
      && v.aFile('a') + v.aFile('b') + v.aFile('c') === 3 && v.aFile('f') + v.aFile('g') + v.aFile('h') === 3
      && v.bFile('a') + v.bFile('b') === 2 && v.bFile('e') + v.bFile('f') + v.bFile('g') + v.bFile('h') === 4,
    summary: 'Chaque camp a une majorité sur une aile. La colonne d ouverte et la course aux pions passés décident : on joue surtout à l\'aile dame.',
    plansA: [
      'Prendre la colonne d et viser la 7e rangée.',
      'Créer un pion passé avec la majorité aile dame (3 contre 2).',
    ],
    plansB: [
      'Prendre la colonne d, elle aussi.',
      'Attaque de minorité [a5], [b5]-[b4] pour éliminer les pions aile dame adverses, puis finale 4 contre 3.',
    ],
    breaksA: [['b2', 'b4'], ['c3', 'c4']],
    breaksB: [['a7', 'a5'], ['b5', 'b4']],
  },
  {
    id: 'big-center',
    name: 'Grand centre mobile (d4-e4)',
    conceptId: 'mobile-center',
    aRole: 'le camp au grand centre',
    bRole: 'le camp qui attaque le centre',
    match: v => v.a('d4') && v.a('e4') && v.bFile('d') === 0
      && !v.b('e5') && !v.b('c5') && !v.b('f5'),
    summary: 'Duo central libre d\'avancer (Grünfeld, Alekhine, …). Le possesseur le soutient et le pousse au bon moment ; l\'adversaire le harcèle de pions et de pièces avant qu\'il ne déferle.',
    plansA: [
      'Soutenir le centre (fou en [e3], tour en [d1], [f3]/[f4]) et pousser [d5] ou [e5] quand ça gagne de l\'espace ou des tempi.',
      'Utiliser l\'espace pour attaquer le roi.',
    ],
    plansB: [
      'Frapper le centre avec les pions : [c5], [e5] ou [f5].',
      'Pression des pièces sur [d4] (fou en [g7], cavalier en [c6], dame en [b6]).',
      'Si le centre avance, bloquer les cases devant les pions et attaquer leur base.',
    ],
    breaksA: [['d4', 'd5'], ['e4', 'e5']],
    breaksB: [['c7', 'c5'], ['e7', 'e5'], ['f7', 'f5']],
  },
]

/** Every named structure present on the board, most specific first. */
export function detectStructures(board: Board): StructureMatch[] {
  const out: StructureMatch[] = []
  const views: Record<Side, StructureView> = { w: viewFor(board, 'w'), b: viewFor(board, 'b') }
  for (const pattern of STRUCTURES) {
    for (const sideA of ['w', 'b'] as Side[]) {
      if (pattern.match(views[sideA])) { out.push({ pattern, sideA }); break }
    }
  }
  // Hedgehog is a special Maroczy; Dragon/Scheveningen/Boleslavsky are
  // exclusive with it too. Keep the most specific.
  const ids = new Set(out.map(m => m.pattern.id))
  return out.filter(m => !(m.pattern.id === 'maroczy' && ids.has('hedgehog')))
}

export interface StructureRole {
  role: string
  plans: string[]
  /** Thematic pawn moves for this side, as absolute square indexes. */
  breaks: [number, number][]
  /** Key squares for this side. */
  squares: number[]
}

/** Plans of a matched structure for one side. Every square in a pattern
 *  is written in side A's frame, so rendering always mirrors on `sideA`. */
export function structureRole(m: StructureMatch, side: Side): StructureRole {
  const isA = side === m.sideA
  const p = m.pattern
  const abs = (rel: string) => sqIndex(relSquare(rel, m.sideA))
  return {
    role: isA ? p.aRole : p.bRole,
    plans: (isA ? p.plansA : p.plansB).map(t => renderRel(t, m.sideA)),
    breaks: ((isA ? p.breaksA : p.breaksB) ?? []).map(([f, t]) => [abs(f), abs(t)] as [number, number]),
    squares: ((isA ? p.squaresA : p.squaresB) ?? []).map(abs),
  }
}
