import type { Concept } from './types'

// Concepts the trainer references throughout the app (motif radar, roadmap,
// plan items, study hints, …). Keep entries short — when you need depth
// for a topic, prefer linking out to a stable resource over inlining a
// textbook chapter.
//
// External URL policy: only Wikipedia FR (stable canonical pages),
// Lichess study/practice pages, and chess.com lesson hubs.

const wikiSearch = (q: string) => `https://fr.wikipedia.org/w/index.php?search=${encodeURIComponent(q)}`

export const CONCEPTS: Concept[] = [
  // ---------------- TACTICS ----------------
  {
    id: 'fork',
    title: 'Fourchette',
    category: 'tactics',
    aliases: ['fork'],
    shortDef: 'Un même coup attaque simultanément deux pièces adverses, généralement avec un cavalier ou un pion.',
    detail: 'La fourchette de cavalier est la plus rentable car les pièces adverses ne peuvent ni le bloquer ni le capturer facilement. Une fourchette royale attaque le roi + une pièce — le roi doit bouger, l\'autre pièce tombe.',
    links: [
      { label: 'Fourchette (Wikipedia)', url: 'https://fr.wikipedia.org/wiki/Fourchette_(jeu_d%27%C3%A9checs)', kind: 'wikipedia' },
      { label: 'Drill fourchettes (Lichess)', url: 'https://lichess.org/training/fork', kind: 'lichess' },
    ],
    positions: [
      {
        fen: '4k3/3q4/8/8/6N1/8/8/4K3 w - - 0 1',
        caption: 'Fourchette royale : Nf6+ attaque Roi+Dame.',
        bestSan: 'Nf6+',
      },
    ],
    related: ['fork-royal', 'pin'],
  },
  {
    id: 'fork-royal',
    title: 'Fourchette royale',
    category: 'tactics',
    aliases: ['royal fork'],
    shortDef: 'Fourchette qui inclut le roi adverse. Comme l\'échec doit être paré, l\'autre pièce attaquée tombe.',
    related: ['fork'],
  },
  {
    id: 'pin',
    title: 'Clouage',
    category: 'tactics',
    aliases: ['pin', 'absolute pin', 'relative pin'],
    shortDef: 'Une pièce ne peut pas bouger sans exposer une pièce plus précieuse (cas absolu : le roi).',
    detail: 'Clouage absolu = au roi (la pièce clouée ne peut littéralement pas bouger). Clouage relatif = à une pièce plus chère (elle peut bouger mais le coût est élevé). Exploiter un clouage : ajouter un attaquant sur la pièce clouée pour la gagner.',
    links: [
      { label: 'Clouage (Wikipedia)', url: 'https://fr.wikipedia.org/wiki/Clouage', kind: 'wikipedia' },
      { label: 'Drill clouages (Lichess)', url: 'https://lichess.org/training/pin', kind: 'lichess' },
    ],
    related: ['skewer', 'discovered-attack'],
  },
  {
    id: 'skewer',
    title: 'Enfilade',
    category: 'tactics',
    aliases: ['skewer'],
    shortDef: 'L\'inverse du clouage : la pièce plus chère est devant et doit bouger, exposant la pièce derrière elle.',
    links: [
      { label: 'Enfilade (Wikipedia)', url: 'https://fr.wikipedia.org/wiki/Enfilade_(jeu_d%27%C3%A9checs)', kind: 'wikipedia' },
    ],
    related: ['pin'],
  },
  {
    id: 'discovered-attack',
    title: 'Attaque à la découverte',
    category: 'tactics',
    aliases: ['discovered attack', 'discovered check', 'attaque découverte'],
    shortDef: 'Une pièce bouge et démasque une attaque par une autre pièce derrière elle.',
    detail: 'Le coup qui démasque crée DEUX menaces : celle de la pièce qui bouge + celle de la pièce démasquée. La forme la plus puissante est l\'échec à la découverte, où la pièce démasquée donne échec et la pièce qui bouge gagne du matériel sans risque.',
    links: [
      { label: 'Attaque à la découverte (Wikipedia)', url: 'https://fr.wikipedia.org/wiki/Attaque_d%C3%A9couverte', kind: 'wikipedia' },
      { label: 'Drill découvertes (Lichess)', url: 'https://lichess.org/training/discoveredAttack', kind: 'lichess' },
    ],
    related: ['fork', 'pin'],
  },
  {
    id: 'back-rank-mate',
    title: 'Mat du couloir',
    category: 'tactics',
    aliases: ['back rank mate', 'mat de l\'allée'],
    shortDef: 'Le roi est piégé par ses propres pions sur la 1re/8e rangée et une tour ou dame mate sur cette rangée.',
    detail: 'Le motif le plus puni à 1000-1500 Elo. Prévention : faire un "trou" pour le roi (h3/h6) ou faire la séquence "checks-captures-menaces" avant chaque coup. Exploiter : sortir la défense de la rangée par déflexion ou sacrifice.',
    links: [
      { label: 'Mat du couloir (Wikipedia)', url: 'https://fr.wikipedia.org/wiki/Mat_du_couloir', kind: 'wikipedia' },
      { label: 'Drill back-rank (Lichess)', url: 'https://lichess.org/training/backRankMate', kind: 'lichess' },
    ],
  },
  {
    id: 'smothered-mate',
    title: 'Mat étouffé',
    category: 'tactics',
    aliases: ['smothered mate', 'mat de Lucena'],
    shortDef: 'Mat de cavalier sur un roi entouré par ses propres pièces — le roi n\'a aucune case d\'évasion.',
    detail: 'Pattern classique : Cf7+ Kg8 Ch6++ Kh8 Qg8+! Rxg8 Cf7# (sacrifice de dame). L\'idée à voir au moins une fois pour ne plus jamais la rater.',
    links: [
      { label: 'Mat étouffé (Wikipedia)', url: 'https://fr.wikipedia.org/wiki/Mat_%C3%A9touff%C3%A9', kind: 'wikipedia' },
    ],
  },
  {
    id: 'greek-gift',
    title: 'Cadeau grec (Bxh7+)',
    category: 'tactics',
    aliases: ['greek gift', 'sacrifice de fou h7', 'Bxh7+'],
    shortDef: 'Sacrifice du fou en h7+ (ou h2+ noir) suivi de Cg5+ pour mater le roi.',
    detail: 'Conditions classiques : fou en d3, cavalier en f3 prêt à aller g5, dame proche pour amener Qh5, pas de cavalier noir en f6 capable de défendre h7. Si Kxh7 (forcé) → Ng5+ Kg8 → Qh5 menace mat en h7 imparable sans matériel rendu.',
    links: [
      { label: 'Cadeau grec (Wikipedia)', url: 'https://fr.wikipedia.org/wiki/Cadeau_grec', kind: 'wikipedia' },
    ],
    related: ['sacrifice'],
  },
  {
    id: 'deflection',
    title: 'Déflexion',
    category: 'tactics',
    aliases: ['deflection'],
    shortDef: 'Forcer une pièce adverse à quitter une case clé qu\'elle défendait.',
    related: ['decoy', 'remove-defender'],
  },
  {
    id: 'decoy',
    title: 'Attraction',
    category: 'tactics',
    aliases: ['decoy', 'attraction'],
    shortDef: 'Forcer une pièce (souvent le roi) sur une case où elle deviendra vulnérable.',
    related: ['deflection'],
  },
  {
    id: 'remove-defender',
    title: 'Élimination du défenseur',
    category: 'tactics',
    aliases: ['removing the defender'],
    shortDef: 'Capturer ou chasser la pièce qui défend une autre pièce ou case clé.',
    related: ['deflection'],
  },
  {
    id: 'sacrifice',
    title: 'Sacrifice',
    category: 'tactics',
    aliases: ['sacrifice'],
    shortDef: 'Céder du matériel à court terme pour un gain positionnel ou tactique plus grand.',
    detail: 'Distinguer "sacrifice tactique" (qui aboutit à un mat ou à plus de matériel) de "sacrifice positionnel" (qui paie en compensation à long terme : roi exposé, paire de fous, contrôle). Tal est le grand maître du sacrifice intuitif.',
    related: ['greek-gift'],
  },

  // ---------------- ENDGAME ----------------
  {
    id: 'opposition',
    title: 'Opposition',
    category: 'endgame',
    shortDef: 'Roi contre roi : celui qui doit jouer perd l\'opposition (et donc le contrôle de cases-clés).',
    detail: 'Opposition directe = rois face à face avec une case impaire entre eux (généralement 1 case). Le joueur qui n\'a pas le trait peut imposer le gain dans les finales de pion. Règle pratique : si le roi qui défend a l\'opposition sur la case-clé, c\'est nulle.',
    links: [
      { label: 'Opposition (Wikipedia)', url: 'https://fr.wikipedia.org/wiki/Opposition_(jeu_d%27%C3%A9checs)', kind: 'wikipedia' },
    ],
    positions: [
      {
        fen: '4k3/8/4K3/4P3/8/8/8/8 b - - 0 1',
        caption: 'Opposition directe : noir n\'a pas le trait → blanc gagne.',
      },
    ],
    related: ['square-rule'],
  },
  {
    id: 'square-rule',
    title: 'Règle du carré',
    category: 'endgame',
    aliases: ['rule of the square', 'règle du carré'],
    shortDef: 'Pour savoir si un roi seul peut rattraper un pion passé : tracer un carré du pion à sa case de promotion. Si le roi est dedans (et au trait), il rattrape.',
    detail: 'Comptez la distance entre le pion et la case de promotion (= côté du carré). Si le roi adverse est dans ce carré au moment où le pion va pousser, il rattrape. Si le roi est dehors et c\'est au pion de jouer, le pion promeut.',
    links: [
      { label: 'Règle du carré (Wikipedia)', url: 'https://fr.wikipedia.org/wiki/R%C3%A8gle_du_carr%C3%A9', kind: 'wikipedia' },
    ],
    positions: [
      {
        fen: '8/k7/8/8/8/8/4P3/4K3 w - - 0 1',
        caption: 'Le roi noir est-il dans le carré du pion e2 ?',
        bestSan: 'Kf2',
      },
    ],
    related: ['opposition'],
  },
  {
    id: 'lucena',
    title: 'Position de Lucena',
    category: 'endgame',
    aliases: ['lucena'],
    shortDef: 'Finale K+R+P vs K+R où le camp fort gagne via la technique "du pont" : sa tour bloque les échecs latéraux.',
    detail: 'La position classique : roi fort devant son pion sur la 7e, défenseur derrière. Le gain passe par le "pont" : amener la tour sur la 4e rangée (g4 si pion sur d) pour bloquer les échecs verticaux que le défenseur donne dès que le roi sort. Tu DOIS connaître cette technique pour convertir les finales R+P.',
    links: [
      { label: 'Position de Lucena (Wikipedia)', url: 'https://fr.wikipedia.org/wiki/Position_de_Lucena', kind: 'wikipedia' },
      { label: 'Position de Lucena (Wikipedia)', url: 'https://fr.wikipedia.org/wiki/Position_de_Lucena', kind: 'wikipedia' },
    ],
    related: ['philidor', 'rook-endgame', 'tarrasch-rule'],
  },
  {
    id: 'philidor',
    title: 'Position de Philidor',
    category: 'endgame',
    aliases: ['philidor'],
    shortDef: 'Finale K+R+P vs K+R défensive : nulle si le défenseur garde sa tour sur la 3e rangée (ou 6e côté noir) jusqu\'à ce que le pion la franchisse.',
    detail: 'Tant que le pion n\'a pas franchi la 4e rangée du défenseur, la tour reste sur la 3e/6e pour empêcher le roi d\'avancer. Dès que le pion arrive sur la 4e/5e, la tour saute derrière (sur la 1re/8e) et donne des échecs latéraux interminables.',
    links: [
      { label: 'Position de Philidor (Wikipedia)', url: 'https://fr.wikipedia.org/wiki/Position_de_Philidor', kind: 'wikipedia' },
    ],
    related: ['lucena', 'rook-endgame'],
  },
  {
    id: 'tarrasch-rule',
    title: 'Règle de Tarrasch',
    category: 'endgame',
    aliases: ['tarrasch rule', 'tour derrière le pion passé'],
    shortDef: 'La tour DOIT être derrière son propre pion passé (et derrière le pion passé adverse).',
    detail: 'Pourquoi : derrière son pion, la tour pousse le pion ET protège les cases d\'arrière. Devant le pion, elle bloque sa propre avance. Variante : tour devant un pion adverse passé = on bloque mais on perd activité. Si on doit choisir entre deux mauvaises options, "derrière son passé" reste prioritaire.',
    links: [
      { label: 'Siegbert Tarrasch (Wikipedia)', url: 'https://fr.wikipedia.org/wiki/Siegbert_Tarrasch', kind: 'wikipedia' },
    ],
    related: ['lucena', 'philidor', 'rook-endgame'],
  },
  {
    id: 'vancura',
    title: 'Défense de Vancura',
    category: 'endgame',
    aliases: ['vancura'],
    shortDef: 'Finale R vs R+pion de tour avancé : tenir nulle en attaquant le pion par le flanc avec la tour, pas frontalement.',
    detail: 'Setup classique : pion blanc en a6/a7, tour noire en f6 (attaque a6 latéralement), roi noir en g7/h7 prêt à esquiver les échecs. Dès que le roi blanc tente de sortir pour libérer son pion, la tour donne des échecs latéraux. La défense tient tant que les conditions sont remplies (pion de tour, défenseur en place).',
    links: [
      { label: 'Position de Vancura (Wikipedia)', url: 'https://fr.wikipedia.org/wiki/D%C3%A9fense_Vancura', kind: 'wikipedia' },
    ],
    related: ['rook-endgame', 'philidor'],
  },
  {
    id: 'rook-endgame',
    title: 'Finale de tour',
    category: 'endgame',
    shortDef: '~50% des finales en jeu compétitif. Maîtriser Lucena (gain), Philidor (nulle défensive), Vancura (pion de tour).',
    detail: 'Principes clés : (1) tour derrière le pion passé — règle de Tarrasch ; (2) roi actif — sortir le sien et restreindre celui de l\'adversaire ; (3) tour active vaut presque un pion — préférer une tour active à un pion supplémentaire passif.',
    related: ['lucena', 'philidor', 'tarrasch-rule', 'vancura'],
  },
  {
    id: 'kqk-mate',
    title: 'Mater avec Roi + Dame',
    category: 'endgame',
    aliases: ['kqk', 'mat dame roi'],
    shortDef: 'Méthode du carré rétrécissant : la dame à un saut de cavalier du roi adverse pour le pousser sur le bord, puis le roi blanc s\'approche.',
    detail: 'ATTENTION pat : la dame ne doit pas se mettre sur une case d\'où le roi adverse n\'a plus aucune case ; il faut TOUJOURS lui laisser une case d\'évasion jusqu\'au coup final. Mat dans ≤10 coups si bien fait.',
    related: ['krk-mate'],
  },
  {
    id: 'krk-mate',
    title: 'Mater avec Roi + Tour',
    category: 'endgame',
    aliases: ['krk', 'mat tour roi'],
    shortDef: 'Méthode "escalier" : la tour empêche le roi adverse de remonter, le roi blanc le pousse sur le bord.',
    detail: 'Pattern : Roi blanc face au noir avec opposition + Tour qui coupe une rangée. À chaque fois que le noir se déplace latéralement, on glisse latéralement ; chaque fois qu\'il est forcé en arrière (zugzwang), on bascule la tour.',
    related: ['kqk-mate', 'opposition'],
  },
  {
    id: 'opposite-colored-bishops',
    title: 'Fous de couleurs opposées',
    category: 'endgame',
    shortDef: 'Avec un seul fou chacun de couleurs différentes, beaucoup de finales sont nulles même avec un pion d\'avance.',
    detail: 'La règle empirique : "fous de couleurs opposées + pas plus de 2 pions d\'avantage = nulle 80% du temps". Le défenseur construit une forteresse sur la couleur où l\'attaquant n\'a pas de fou. Exception : avec dames sur l\'échiquier, l\'avantage se concrétise plus facilement (attaque).',
    related: ['rook-endgame'],
  },

  // ---------------- STRUCTURE ----------------
  {
    id: 'isolated-queen-pawn',
    title: 'Pion dame isolé (IQP)',
    category: 'structure',
    aliases: ['IQP', 'isolated queen pawn'],
    shortDef: 'Pion d sans pion adjacent (c et e absents). Force dynamique en milieu de jeu, faiblesse en finale.',
    detail: '3 plans typiques pour l\'attaquant (qui a l\'IQP) : (1) avancer d4-d5 pour ouvrir le centre ; (2) installer un cavalier en e5 ; (3) attaquer le roque. Pour le défenseur : bloquer le pion (cavalier en d5), forcer les échanges, transposer en finale gagnante. Ouvertures fréquentes : Caro-Kann attaque Panov, Gambit Dame défense Tarrasch, Nimzo-Indienne (système Rubinstein), Sicilienne Alapin (2.c3).',
    links: [
      { label: 'Pion isolé (Wikipedia)', url: 'https://fr.wikipedia.org/wiki/Pion_isol%C3%A9', kind: 'wikipedia' },
    ],
    positions: [
      {
        fen: 'r1bq1rk1/p3bppp/1pn1p3/3n4/3P4/2NB1N2/PP3PPP/R1BQR1K1 w - - 0 11',
        caption: 'Position classique d\'IQP : le pion d4 est isolé, mais les Blancs ont la dynamique (Bd3, Re1) et la rupture d4-d5 en réserve.',
      },
    ],
    related: ['hanging-pawns', 'pawn-structure'],
  },
  {
    id: 'hanging-pawns',
    title: 'Pions pendants',
    category: 'structure',
    aliases: ['hanging pawns'],
    shortDef: 'Deux pions adjacents (c+d ou d+e) sans pions de soutien. Force ou faiblesse selon la dynamique.',
    detail: 'Caractéristiques : flexibles tant que personne n\'a poussé. Forts s\'ils peuvent avancer (c4-c5 ou d4-d5) et créer un passé. Faibles s\'ils sont bloqués (le défenseur peut les attaquer un par un).',
    related: ['isolated-queen-pawn'],
  },
  {
    id: 'backward-pawn',
    title: 'Pion arriéré',
    category: 'structure',
    aliases: ['backward pawn'],
    shortDef: 'Pion qui ne peut plus être protégé par un pion adjacent et qui est bloqué.',
    detail: 'Faiblesse permanente. La case devant lui devient un avant-poste pour l\'adversaire. Plan d\'attaque : doubler tours sur la colonne ouverte, multiplier les attaquants. Plan de défense : échanger les pièces lourdes pour aller en finale et le défendre passivement.',
  },
  {
    id: 'doubled-pawns',
    title: 'Pions doublés',
    category: 'structure',
    aliases: ['doubled pawns', 'pions doublés'],
    shortDef: 'Deux pions sur la même colonne. Réduit la mobilité et le contrôle, mais ouvre une colonne pour les tours.',
    detail: 'Souvent une faiblesse, parfois un atout : les pions doublés CONTRÔLENT 6 cases au lieu de 4 (les deux pions couvrent en triangle), et la colonne adjacente est semi-ouverte pour les tours. Exemple positif : la structure Nimzo-Indienne avec ...Bxc3 bxc3.',
  },
  {
    id: 'outpost',
    title: 'Avant-poste',
    category: 'structure',
    aliases: ['outpost'],
    shortDef: 'Case forte (typiquement d5/d4 pour les blancs, d4/d5 pour les noirs) où une pièce ne peut être chassée par un pion.',
    detail: 'L\'avant-poste idéal pour un cavalier : 4e/5e rangée, dans le camp adverse, défendu par un pion ami, AUCUN pion adverse ne peut le déloger. Un cavalier en avant-poste vaut souvent une pièce et demie.',
  },
  {
    id: 'pawn-structure',
    title: 'Structures de pions',
    category: 'structure',
    shortDef: 'La structure de pions définit les plans de milieu de jeu. Apprends-en 4-5 et tu comprendras 80% des ouvertures.',
    detail: 'Les structures clés : Carlsbad (échange QGD), Sicilienne (Najdorf/Sveshnikov), Roi-Indien (e5 vs d4-c5), Stonewall (d4-e3-f4), IQP, Caro (pions e6-d5-c6). Chacune impose ses propres plans (attaque de minorité, percée centrale, attaque sur l\'aile roi).',
    related: ['isolated-queen-pawn', 'minority-attack'],
  },
  {
    id: 'minority-attack',
    title: 'Attaque de minorité',
    category: 'structure',
    aliases: ['minority attack', 'attaque de la minorité'],
    shortDef: 'Pousser tes 2 pions sur une aile contre les 3 pions adverses pour créer une faiblesse.',
    detail: 'Cadre classique de la Carlsbad (QGD-échange) : blanc a 2 pions a-b vs 3 pions a-b-c noirs. White pousse b4-b5 pour forcer ...bxc6 → pion c6 arriéré + colonne c demi-ouverte pour blanc. Plan blanc : exploiter le pion c6 + la case c5 ; plan noir : attaque kingside pour compenser.',
    related: ['pawn-structure', 'backward-pawn'],
  },

  // ---------------- OPENING ----------------
  {
    id: 'italian',
    title: 'Partie italienne',
    category: 'opening',
    aliases: ['italian game', 'giuoco piano'],
    shortDef: '1. e4 e5 2. Nf3 Nc6 3. Bc4. Ouverture la plus jouée à club, plans simples : développement rapide, possible d4 ou c3+d4.',
    detail: 'Plans clés : (1) Italienne lente (3...Bc5 4.c3+d3) → manœuvre Re1, Nbd2-f1-g3 ; (2) Giuoco Pianissimo avec a4, h3 ; (3) Evans Gambit (4.b4) pour amateurs agressifs. Pour les noirs : Two Knights (3...Nf6) si tu cherches du jeu.',
    links: [
      { label: 'Partie italienne (Wikipedia)', url: 'https://fr.wikipedia.org/wiki/Partie_italienne', kind: 'wikipedia' },
    ],
  },
  {
    id: 'ruy-lopez',
    title: 'Partie espagnole (Ruy López)',
    category: 'opening',
    aliases: ['ruy lopez', 'partie espagnole'],
    shortDef: '1. e4 e5 2. Nf3 Nc6 3. Bb5. L\'ouverture la plus profonde, dominante au top niveau.',
    detail: 'Variantes principales noir : Berlin (3...Nf6, solide, bcp de matrice), Marshall (3...a6 4.Ba4 Nf6 5.O-O Be7 6.Re1 b5 7.Bb3 O-O 8.c3 d5!?, gambit théorique), Fermée (3...a6 4.Ba4 Nf6 5.O-O Be7), Steinitz, etc. Choisi UN setup et apprend-le à fond.',
    links: [
      { label: 'Partie espagnole (Wikipedia)', url: 'https://fr.wikipedia.org/wiki/Partie_espagnole', kind: 'wikipedia' },
    ],
  },
  {
    id: 'sicilian',
    title: 'Défense sicilienne',
    category: 'opening',
    aliases: ['sicilian defense'],
    shortDef: '1. e4 c5. La réponse la plus combative à 1.e4 : noir joue pour gagner.',
    detail: 'Sous-systèmes : Najdorf (...a6, le plus théorique), Dragon (...g6, attaque mutuelle sur les ailes opposées), Sveshnikov (...e5 sur d4 — solide moderne), Taimanov (...Nc6+...Qc7, flexible), Kan (...a6+...e6 — pas de cavalier sur c6). À club : Smith-Morra ou Alapin (2.c3) côté blanc pour éviter la théorie.',
    links: [
      { label: 'Défense sicilienne (Wikipedia)', url: 'https://fr.wikipedia.org/wiki/D%C3%A9fense_sicilienne', kind: 'wikipedia' },
    ],
  },
  {
    id: 'french',
    title: 'Défense française',
    category: 'opening',
    aliases: ['french defense'],
    shortDef: '1. e4 e6 — noir construit une chaîne de pions d5-e6 et attaque le centre par c5/f6.',
    detail: 'Variantes principales : Échange (3.exd5 — sec mais blanc rate l\'avantage), Avance (3.e5 — typique chaîne de pions), Tarrasch (3.Nd2), Winawer (3.Nc3 Bb4 — Karpov-Korchnoi). Structure noire : le fou c8 est "le mauvais fou" — un thème majeur du milieu de jeu français.',
    links: [
      { label: 'Défense française (Wikipedia)', url: 'https://fr.wikipedia.org/wiki/D%C3%A9fense_fran%C3%A7aise', kind: 'wikipedia' },
    ],
  },
  {
    id: 'caro-kann',
    title: 'Défense Caro-Kann',
    category: 'opening',
    aliases: ['caro-kann'],
    shortDef: '1. e4 c6. Solide, sans faiblesse à long terme. Le fou c8 sort avant ...e6.',
    detail: 'Variantes principales : Avance (3.e5), Classique (3.Nc3 dxe4 4.Nxe4 Bf5), Panov-Botvinnik (3.exd5 cxd5 4.c4 — transposer en IQP), Two Knights (2.Nc3+3.Nf3). Le choix de référence des joueurs solides : Anand, Karpov.',
    links: [
      { label: 'Défense Caro-Kann (Wikipedia)', url: 'https://fr.wikipedia.org/wiki/D%C3%A9fense_Caro-Kann', kind: 'wikipedia' },
    ],
  },
  {
    id: 'queens-gambit',
    title: 'Gambit dame',
    category: 'opening',
    aliases: ['queens gambit'],
    shortDef: '1. d4 d5 2. c4 — blanc offre temporairement un pion pour ouvrir le centre.',
    detail: 'QGD (2...e6) = solide, Slav (2...c6) = symétrique mais combatif, QGA (2...dxc4) = noir accepte, doit ensuite construire avec ...e6 + ...c5. À club et au-dessus, le QGD-Échange (3.cxd5) mène à la structure Carlsbad — attaque de minorité.',
    links: [
      { label: 'Gambit dame (Wikipedia)', url: 'https://fr.wikipedia.org/wiki/Gambit_dame', kind: 'wikipedia' },
    ],
    related: ['minority-attack'],
  },
  {
    id: 'kings-indian',
    title: 'Défense est-indienne',
    category: 'opening',
    aliases: ['kings indian', 'défense est-indienne', 'KID'],
    shortDef: '1.d4 Nf6 2.c4 g6 3.Nc3 Bg7 — noir cède le centre pour le contre-attaquer plus tard avec ...e5 ou ...c5.',
    detail: 'Variantes : Classique (5.Nf3 puis 7.O-O exd4), Sämisch (5.f3 — solide blanc), Quatre Pions (5.f4 — agressif), Fianchetto (3.g3). Joué par les attaquants : Tal, Fischer, Kasparov. Plan typique noir : ...f5 et attaque sur l\'aile roi.',
    links: [
      { label: 'Défense est-indienne (Wikipedia)', url: 'https://fr.wikipedia.org/wiki/D%C3%A9fense_est-indienne', kind: 'wikipedia' },
    ],
  },
  {
    id: 'nimzo-indian',
    title: 'Défense nimzo-indienne',
    category: 'opening',
    aliases: ['nimzo-indian', 'défense nimzo-indienne'],
    shortDef: '1.d4 Nf6 2.c4 e6 3.Nc3 Bb4 — clouage immédiat, peut doubler les pions blancs sur c.',
    detail: 'L\'idée centrale : ...Bxc3 (ou la menace) crée des pions doublés c3+c4 pour blanc, échange contre la paire de fous. Variantes : Rubinstein (4.e3), Classique (4.Qc2), Sämisch (4.a3). Une des ouvertures les plus respectées historiquement.',
    links: [
      { label: 'Défense nimzo-indienne (Wikipedia)', url: 'https://fr.wikipedia.org/wiki/D%C3%A9fense_nimzo-indienne', kind: 'wikipedia' },
    ],
  },

  // ---------------- STRATEGY ----------------
  {
    id: 'prophylaxis',
    title: 'Prophylaxie',
    category: 'strategy',
    aliases: ['prophylaxis'],
    shortDef: 'Avant chaque coup, demande-toi : "que veut faire l\'adversaire ?". Prévenir avant de créer.',
    detail: 'Concept central de Karpov-Petrosian. Lister mentalement les 2-3 idées que l\'adversaire prépare, puis chercher un coup qui les neutralise tout en améliorant ta position. La prophylaxie distingue un joueur 1600 d\'un joueur 2000.',
    related: ['two-weaknesses'],
  },
  {
    id: 'two-weaknesses',
    title: 'Principe des deux faiblesses',
    category: 'strategy',
    aliases: ['principle of two weaknesses'],
    shortDef: 'Avec une seule faiblesse à attaquer, l\'adversaire peut défendre. Crée une 2e faiblesse pour étirer ses défenses.',
    detail: 'Articulé par Steinitz et formalisé par Nimzowitsch. En finale particulièrement : si l\'adversaire défend un pion arriéré avec ses pièces lourdes, ouvre une seconde aile pour le forcer à choisir. Tu gagnes en bougeant entre les deux fronts.',
    related: ['prophylaxis'],
  },
  {
    id: 'initiative',
    title: 'Initiative',
    category: 'strategy',
    shortDef: 'Tu joues, l\'adversaire répond. Garder l\'initiative = enchaîner des coups menaçants qui dictent le rythme.',
    detail: 'L\'initiative peut justifier des sacrifices : 1 pion donné pour 3-4 coups de pression équivaut souvent en gain à long terme. Perdre l\'initiative en milieu de jeu signifie que l\'adversaire commence à dicter le tempo — tu défends.',
  },
  {
    id: 'silmans-imbalances',
    title: 'Déséquilibres (Silman)',
    category: 'strategy',
    aliases: ['silmans imbalances', 'imbalances'],
    shortDef: 'Cadre formel pour choisir un plan : lister les déséquilibres et jouer pour les exploiter.',
    detail: 'Les 7 déséquilibres de Silman : (1) pièces mineures (paire de fous, qualité d\'un cavalier), (2) pions (structure), (3) cases fortes / faibles, (4) colonnes/diagonales ouvertes, (5) espace, (6) sécurité du roi, (7) initiative/développement. Avant chaque coup en milieu de jeu, identifie le déséquilibre clé et joue pour l\'amplifier.',
    links: [
      { label: 'Reassess Your Chess (Silman)', url: wikiSearch('Jeremy Silman How to Reassess Your Chess'), kind: 'book' },
    ],
  },

  // ---------------- MINDSET ----------------
  {
    id: 'checks-captures-threats',
    title: 'Checks, captures, menaces',
    category: 'mindset',
    aliases: ['checks captures threats', 'CCT'],
    shortDef: 'Avant chaque coup : liste mentalement tous les échecs, captures et menaces (tiens, comme l\'adversaire). Élimine 80% des gaffes.',
    detail: 'Ordre stricte : checks (tous les échecs possibles de l\'adversaire après ton coup) → captures (toutes ses prises) → menaces (toute pièce attaquée). Habitude à mécaniser jusqu\'à 1500-1700 Elo. Plus tard, ça devient inconscient.',
  },
  {
    id: 'simplification',
    title: 'Simplification',
    category: 'mindset',
    shortDef: 'Avec un avantage matériel : échange les pièces, pas les pions. Sans avantage : échange les pions, pas les pièces.',
    detail: 'En finale gagnée, échanger les pièces réduit la complexité et facilite la conversion. À l\'inverse, en position défensive, échanger les pièces accentue ton désavantage (moins de matériel = moins de chances de contre-jeu).',
  },

  // ---------------- RULES (often-misunderstood) ----------------
  {
    id: 'en-passant',
    title: 'Prise en passant',
    category: 'mindset',
    aliases: ['en passant', 'e.p.'],
    shortDef: 'Quand un pion ennemi avance de deux cases et passe à côté du tien, tu peux le prendre comme s\'il n\'avait avancé que d\'une case. Mais SEULEMENT au coup suivant immédiat.',
    detail: 'Conditions strictes : (1) ton pion est sur sa 5e rangée (4e côté noir) ; (2) un pion adverse avance de 2 cases et atterrit à côté du tien ; (3) tu joues la prise DANS LA FOULÉE — si tu joues autre chose d\'abord, le droit est perdu pour toujours. C\'est l\'une des règles que beaucoup oublient à 800-1500 Elo.',
    links: [
      { label: 'Prise en passant (Wikipedia)', url: 'https://fr.wikipedia.org/wiki/Prise_en_passant', kind: 'wikipedia' },
    ],
    positions: [
      {
        fen: 'rnbqkbnr/ppp1pppp/8/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 3',
        caption: 'Blanc peut jouer exd6 e.p. (le pion d est arrivé sur d5 au coup précédent).',
        bestSan: 'exd6',
      },
    ],
  },
  {
    id: 'castling',
    title: 'Roque',
    category: 'mindset',
    aliases: ['castling', 'O-O', 'O-O-O'],
    shortDef: 'Le seul coup où deux pièces bougent en même temps. Conditions : roi+tour n\'ont jamais bougé, aucune case du trajet attaquée, roi pas en échec.',
    detail: 'Petit roque (O-O) : roi g1, tour f1. Grand roque (O-O-O) : roi c1, tour d1. Trois conditions doivent être SIMULTANÉMENT remplies : (1) ni le roi ni la tour concernée n\'ont jamais bougé ; (2) aucune pièce entre les deux ; (3) le roi n\'est pas en échec, ne PASSE par une case attaquée, ni n\'ARRIVE en case attaquée. Note : passer par une case attaquée empêche le roque même côté grand roque (la case b1/b8 peut être attaquée sans empêcher le roque puisque le roi ne s\'y arrête pas).',
    links: [
      { label: 'Roque (Wikipedia)', url: 'https://fr.wikipedia.org/wiki/Roque_(%C3%A9checs)', kind: 'wikipedia' },
    ],
  },
  {
    id: 'threefold-repetition',
    title: 'Triple répétition',
    category: 'mindset',
    aliases: ['threefold repetition', 'triple repetition'],
    shortDef: 'La même position (même trait, mêmes droits de roque, même e.p.) répétée 3 fois → nulle si tu le réclames.',
    detail: 'Pas automatique : tu dois RÉCLAMER la nulle (sauf sur Lichess/chess.com où c\'est auto). La position doit être EXACTEMENT la même : pièces sur les mêmes cases, MÊME camp au trait, MÊMES droits de roque, MÊME possibilité de prise en passant. Utile en défense quand tu joues plus faible (lutte pour nulle) ou si l\'adversaire t\'oublie la position.',
    links: [
      { label: 'Triple occurrence de la position (Wikipedia)', url: 'https://fr.wikipedia.org/wiki/Triple_occurrence_de_la_position', kind: 'wikipedia' },
    ],
    related: ['fifty-move-rule', 'stalemate'],
  },
  {
    id: 'fifty-move-rule',
    title: 'Règle des 50 coups',
    category: 'mindset',
    aliases: ['50 move rule', 'fifty move rule'],
    shortDef: 'Si 50 coups consécutifs (50 par camp) se jouent sans capture ni mouvement de pion, n\'importe quel joueur peut réclamer la nulle.',
    detail: 'Le compteur repart à 0 à chaque capture ou poussée de pion. À titre de comparaison : K+R vs K se mate en moins de 50 coups (≤ 17 coups), donc cette règle ne sauve jamais le faible. K+B+B vs K mate en ≤ 19 coups. K+B+N vs K (méthode du W) ≤ 33 coups. Mais K+R+B vs K+R = parfois > 50 coups → l\'attaquant doit savoir convertir vite.',
    related: ['threefold-repetition'],
  },
  {
    id: 'stalemate',
    title: 'Pat',
    category: 'mindset',
    aliases: ['stalemate'],
    shortDef: 'Le joueur au trait n\'a aucun coup légal mais n\'est PAS en échec → partie nulle.',
    detail: 'Différent du mat (où le roi EST en échec sans coup légal). Ressources défensives : quand tu es écrasé matériellement, joue pour réduire les options à 0 → l\'adversaire risque de te pater. Côté attaquant : laisse TOUJOURS une case d\'évasion au roi adverse jusqu\'au coup final. Le pat est le piège #1 du débutant qui finit K+Q vs K.',
    links: [
      { label: 'Pat (Wikipedia)', url: 'https://fr.wikipedia.org/wiki/Pat_(%C3%A9checs)', kind: 'wikipedia' },
    ],
    positions: [
      {
        fen: '7k/8/6KP/8/8/8/8/8 b - - 0 1',
        caption: 'Noir au trait sans aucun coup légal → pat → nulle.',
      },
    ],
    related: ['kqk-mate'],
  },

  // ---------------- More tactical motifs ----------------
  {
    id: 'zwischenzug',
    title: 'Coup intermédiaire (Zwischenzug)',
    category: 'tactics',
    aliases: ['zwischenzug', 'in-between move', 'intermède'],
    shortDef: 'Avant de jouer le coup "évident" (reprendre une pièce, parer une menace), tu joues d\'abord un coup encore plus fort qui force la réponse adverse.',
    detail: 'Cas classique : adversaire prend ton cavalier. Tu allais reprendre, MAIS tu peux d\'abord donner un échec en posant le mat dans la foulée. La séquence "intermède puis reprise" gagne souvent du matériel. Erreur courante : jouer la reprise automatique au lieu de chercher mieux.',
  },
  {
    id: 'windmill',
    title: 'Moulin (Windmill)',
    category: 'tactics',
    aliases: ['windmill', 'moulin'],
    shortDef: 'Combinaison de découvertes + échecs alternés qui ratisse plusieurs pièces adverses sans contrôle.',
    detail: 'Pattern : tour + fou (souvent) où la tour donne échec à la découverte, l\'adversaire est forcé de bouger le roi, puis la pièce qui couvre revient en arrière (encore échec à la découverte) et capture une autre pièce, et ainsi de suite. Exemple iconique : Torre vs Lasker 1925.',
  },
  {
    id: 'anastasia-mate',
    title: 'Mat d\'Anastasia',
    category: 'tactics',
    aliases: ['anastasia mate'],
    shortDef: 'Cavalier en e7 (ou e2) + tour en h-file mate le roi noir coincé en h8 (ou h1 côté blanc).',
    detail: 'Pattern : roi noir en h7, cavalier blanc en e7, tour blanche descend en h5+ → mat. Le cavalier couvre f5/g6, la tour fait l\'échec, le roi n\'a aucune case (g7 attaquée par cavalier, h8 attaquée par tour, g8 vide mais bloquée par fil ami souvent). Très joli à voir une fois pour le reconnaître.',
  },

  // ---------------- Opening: London ----------------
  {
    id: 'london-system',
    title: 'Système de Londres',
    category: 'opening',
    aliases: ['london system'],
    shortDef: '1.d4 Nf6 2.Bf4 — système solide jouable peu importe la réponse noire. Bcp joué à club car peu théorique.',
    detail: 'Plan blanc : Bf4, e3, Nf3, Bd3, c3, Nbd2, h3, O-O. Pas de cassure centrale rapide ; on construit pas-à-pas et on attaque sur l\'aile-roi. Inconvénient : peut devenir un peu sec si noir joue précisément (...c5+...Nc6+...Qb6). Carlsen l\'a beaucoup joué récemment.',
    links: [
      { label: 'Système de Londres (Wikipedia)', url: 'https://fr.wikipedia.org/wiki/Syst%C3%A8me_de_Londres', kind: 'wikipedia' },
    ],
  },

  // ---------------- Strategy ----------------
  {
    id: 'piece-activity',
    title: 'Activité des pièces',
    category: 'strategy',
    aliases: ['piece activity', 'activité'],
    shortDef: 'Une pièce active vaut plus que sa valeur nominale. Un cavalier passif peut valoir moins qu\'un pion.',
    detail: 'Mesurer l\'activité : combien de cases la pièce contrôle, peut-elle participer à un plan, est-elle bloquée par des pions amis ? La règle "tour active vaut un pion" est un cas particulier. Maxime de Lasker : "Si un coup améliore la position de ta pire pièce, joue-le."',
    related: ['initiative', 'two-weaknesses'],
  },

  // ---------------- More mating patterns ----------------
  {
    id: 'boden-mate',
    title: 'Mat de Boden',
    category: 'tactics',
    aliases: ['boden mate', 'mat de boden'],
    shortDef: 'Deux fous mates le roi via deux diagonales croisées, typiquement après que le roi a roqué côté dame.',
    detail: 'Pattern classique : roi noir en c8, fous blancs en a6 (vise b7-c8) et f4 (vise b8-h2 ou similaire après poussée). Souvent précédé d\'un sacrifice de dame pour ouvrir les diagonales. À voir absolument une fois pour le reconnaître quand l\'adversaire roque grand sans protéger b7/g7.',
    related: ['anastasia-mate', 'smothered-mate'],
  },
  {
    id: 'arabian-mate',
    title: 'Mat arabe',
    category: 'tactics',
    aliases: ['arabian mate', 'mat arabe'],
    shortDef: 'Cavalier + tour mates le roi dans un coin — la tour fait l\'échec, le cavalier couvre les cases d\'évasion.',
    detail: 'Pattern minimal : roi noir en h8, tour blanche en h7+, cavalier blanc en f7 ou g6 qui couvre g8. Un des plus anciens motifs (déjà documenté au 9e siècle dans les manuels arabes). Reconnaissable instantanément quand un cavalier traîne près d\'un roi dans le coin.',
    related: ['anastasia-mate', 'boden-mate'],
  },
  {
    id: 'ladder-mate',
    title: 'Mat de l\'escalier',
    category: 'tactics',
    aliases: ['ladder mate', 'mat escalier'],
    shortDef: 'Deux tours (ou tour+dame) qui mate le roi adverse en descendant rang par rang.',
    detail: 'Technique de base contre roi seul : tour sur la 7e empêche le roi d\'aller au-delà, l\'autre tour donne échec sur la 8e, le roi descend en 7e... non, attendez. Plan : Ra8+ Kg7, Rb7+ Kh6, Rg8 (puis Ra-h8 selon configuration). Sert aussi en finale K+Q vs K+R bloquée. Mate en ≤16 coups depuis n\'importe quelle position.',
    related: ['krk-mate'],
  },

  // ---------------- Pawn structures ----------------
  {
    id: 'stonewall',
    title: 'Stonewall',
    category: 'structure',
    aliases: ['stonewall structure'],
    shortDef: 'Pions blancs (ou noirs) en c3-d4-e3-f4 (ou f5-e6-d5-c6) — formation solide mais le pion central faible.',
    detail: 'Le pion central (d4 ou d5 selon la couleur) est légèrement faible (case sombre e5/e4 ne peut plus être contrôlée par un pion). Plan typique : attaque kingside avec le mauvais fou échangé d\'abord. Vu dans le Stonewall Attack (1.d4 d5 2.e3 Nf6 3.Bd3 c5 4.c3 + f4) et la Dutch Stonewall (1.d4 f5 2.c4 e6 + …d5 + …c6).',
    related: ['pawn-structure', 'bad-bishop'],
  },
  {
    id: 'carlsbad',
    title: 'Structure de Carlsbad',
    category: 'structure',
    aliases: ['carlsbad structure', 'carlsbad'],
    shortDef: 'Structure issue du Gambit dame échangé (QGD-échange) : pions blancs a2-b2-d4-e3-f2-g2-h2 (plus de pion c) contre noirs a7-b7-c6-d5-f7-g7-h7 (plus de pion e). Plan blanc : attaque de minorité.',
    detail: 'Les Blancs ont 2 pions (a-b) contre 3 (a-b-c) à l\'aile dame : le plan canonique est l\'attaque de minorité (Rab1, a3, puis b4-b5). Après b5 et l\'échange sur c6, les Noirs gardent un pion c6 faible et un pion a7 isolé, et les Blancs ont la colonne c semi-ouverte pour leurs tours. Autre plan blanc : f3 puis e4 (rupture centrale) quand les pièces sont prêtes. Côté noir, le jeu est à l\'aile roi : cavalier en e4 (soutenu par ...f5), fou en d6, dame vers h4 ou f6 ; la rupture ...c5 est rare mais utile pour se débarrasser du futur pion faible. La même structure existe en couleurs inversées dans la Caro-Kann d\'échange (1.e4 c6 2.d4 d5 3.exd5 cxd5) : ce sont alors les Noirs qui mènent l\'attaque de minorité (...b5-b4). Référence : Karpov a battu Korchnoi plusieurs fois là-dessus.',
    positions: [
      {
        fen: 'r1bqrnk1/pp2bppp/2p2n2/3p2B1/3P4/2NBP3/PPQ1NPPP/R4RK1 w - - 8 11',
        caption: 'Structure de Carlsbad : les Blancs préparent l\'attaque de minorité (Rab1, puis b4-b5) contre le pion c6, alors que les Noirs jouent à l\'aile roi.',
        bestSan: 'Rab1',
      },
    ],
    related: ['minority-attack', 'pawn-structure', 'queens-gambit'],
  },
  {
    id: 'bad-bishop',
    title: 'Mauvais fou',
    category: 'structure',
    aliases: ['bad bishop', 'mauvais fou'],
    shortDef: 'Fou bloqué par ses propres pions sur les cases de sa couleur — peu mobile, vulnérable en finale.',
    detail: 'Exemple typique : fou clair (cases blanches) coincé derrière des pions sur cases blanches (e6/d5/c6 noirs → Bc8 mauvais). Plan : l\'échanger contre une pièce mineure adverse, OU le ré-router via une longue manœuvre (Bc8-d7-e8-f7 pour la France). Maxime : "améliore ton pire fou avant de songer à attaquer."',
    related: ['piece-activity', 'french'],
  },

  // ---------------- More openings ----------------
  {
    id: 'kings-gambit',
    title: 'Gambit du roi',
    category: 'opening',
    aliases: ['kings gambit', 'gambit du roi'],
    shortDef: '1.e4 e5 2.f4 — blanc sacrifie un pion pour ouvrir la colonne f et attaquer rapidement.',
    detail: 'Romantique, attaquant, presque hors mode en théorie moderne mais terriblement efficace à club. Variantes : Gambit accepté (2...exf4 — la principale, blanc cherche à récupérer le pion avec l\'attaque), Falkbeer (2...d5 — contre-gambit pour bloquer les ambitions blanches). Joué par Anderssen, Spassky, Nakamura aux blitz.',
    links: [
      { label: 'Gambit du roi (Wikipedia)', url: 'https://fr.wikipedia.org/wiki/Gambit_du_roi', kind: 'wikipedia' },
    ],
  },
  {
    id: 'english-opening',
    title: 'Ouverture anglaise',
    category: 'opening',
    aliases: ['english opening', 'anglaise'],
    shortDef: '1.c4 — flexible, peut transposer dans bcp de systèmes 1.d4 ou rester en jeu autonome.',
    detail: 'Idée : contrôler la case d5 sans engager le pion d. Réponses noires : 1...e5 (anglaise inversée — souvent symétrique), 1...c5 (symétrique), 1...Nf6 (Indienne), 1...e6 (Tarrasch inversée). Le pion c4 reprend en demi-ouverte si exf4 et donne accès au plan classique avec Nc3+g3+Bg2. Joué par Botvinnik, Kramnik.',
    links: [
      { label: 'Partie anglaise (Wikipedia)', url: 'https://fr.wikipedia.org/wiki/Partie_anglaise', kind: 'wikipedia' },
    ],
  },

  // ---------------- Pawn structures (strategic analysis) ----------------
  {
    id: 'isolated-pawn',
    title: 'Pion isolé',
    category: 'structure',
    aliases: ['isolated pawn', 'isolani', 'pions isolés'],
    shortDef: 'Pion sans pion ami sur les colonnes voisines : aucun pion ne pourra jamais le protéger. Cible durable, surtout en finale.',
    detail: 'Un pion isolé ne se défend qu\'avec des pièces, qui deviennent passives. La case devant lui est un point d\'appui rêvé pour l\'adversaire : un cavalier posé là le bloque et reste intouchable. Plus il y a d\'échanges, plus il pèse : en finale c\'est une faiblesse permanente, surtout sur une colonne semi-ouverte où les tours viennent le harceler. En contrepartie, tant que les pièces restent sur l\'échiquier, il donne de l\'espace et de l\'activité (voir le pion dame isolé). Si tu le possèdes : joue vite et activement, évite les échanges, ou fais-le disparaître par une poussée au bon moment. Si tu l\'affrontes : bloque-le, double les pièces sur sa colonne et simplifie vers la finale. Erreur typique : le défendre passivement pendant toute la partie.',
    links: [
      { label: 'Pion isolé (Wikipedia)', url: 'https://fr.wikipedia.org/wiki/Pion_isol%C3%A9', kind: 'wikipedia' },
    ],
    positions: [
      {
        fen: 'r1bqr1k1/pp2bpp1/2n2n1p/3p4/3N4/2N1B1P1/PP2PPBP/R2Q1RK1 w - - 2 12',
        caption: 'Le pion d5 noir est isolé (ni pion c, ni pion e) : le cavalier blanc en d4 le bloque, et Qb3 ajoute un attaquant sur d5.',
        bestSan: 'Qb3',
      },
    ],
    related: ['isolated-queen-pawn', 'backward-pawn', 'weak-square', 'blockade', 'two-weaknesses'],
  },
  {
    id: 'passed-pawn',
    title: 'Pion passé',
    category: 'structure',
    aliases: ['passed pawn', 'pions passés', 'pion passé protégé', 'protected passed pawn', 'pion passé éloigné', 'outside passed pawn', 'pions passés liés', 'connected passed pawns'],
    shortDef: 'Pion sans aucun pion adverse devant lui, ni sur sa colonne ni sur les colonnes voisines : seules les pièces peuvent l\'empêcher de promouvoir.',
    detail: 'Plus la partie se simplifie, plus un pion passé pèse. Il existe plusieurs versions : protégé (soutenu par un pion, il immobilise une pièce adverse sans risque), éloigné (loin des autres pions : il détourne le roi adverse pendant que le tien mange l\'autre aile), liés (deux pions passés voisins qui s\'entraident, presque imparables) et candidat (un pion qui le deviendra après un échange, typique d\'une majorité). Nimzowitsch : "un pion passé doit être bloqué", de préférence par un cavalier posé juste devant lui. Côté attaquant : pousse-le avec ton roi et place ta tour derrière lui (règle de Tarrasch). Côté défenseur : bloque-le tôt, attaque le pion qui le protège et échange les pièces qui le soutiennent. Erreur de club : ne pas voir arriver le pion passé adverse, ou le laisser avancer en comptant le reprendre plus tard.',
    links: [
      { label: 'Pion passé (Wikipedia)', url: 'https://fr.wikipedia.org/wiki/Pion_pass%C3%A9', kind: 'wikipedia' },
      { label: 'Drill pion avancé (Lichess)', url: 'https://lichess.org/training/advancedPawn', kind: 'lichess' },
    ],
    positions: [
      {
        fen: '8/p4ppp/3k4/3P4/4P3/4K3/P5PP/8 w - - 0 1',
        caption: 'Pion passé protégé : d5 n\'a aucun pion noir devant lui sur les colonnes c, d, e, et e4 le soutient. Le roi noir doit rester en d6 pour bloquer le pion, pendant que le roi blanc part chasser l\'autre aile.',
        bestSan: 'Kd4',
      },
      {
        fen: '8/5ppp/4k3/8/P7/4K3/5PPP/8 w - - 0 1',
        caption: 'Pion passé éloigné : le pion a4 est très loin des pions noirs. Le roi noir doit courir l\'arrêter, et le roi blanc en profite pour attaquer les pions de l\'aile roi.',
        bestSan: 'Kf4',
      },
    ],
    related: ['blockade', 'pawn-majority', 'tarrasch-rule', 'square-rule', 'king-activity'],
  },
  {
    id: 'pawn-islands',
    title: 'Îlots de pions',
    category: 'structure',
    aliases: ['pawn islands', 'pawn island', 'îlot de pions', 'règle de Capablanca'],
    shortDef: 'Un îlot est un groupe de pions sur des colonnes voisines. Moins tu as d\'îlots, plus ta structure est saine (règle de Capablanca).',
    detail: 'Chaque îlot compte au moins un pion qu\'aucun pion ne protège : plus il y a d\'îlots, plus il y a de cibles à défendre avec des pièces. À matériel égal, le camp qui a le moins d\'îlots a donc la meilleure structure : c\'est la règle de Capablanca. Elle pèse surtout en finale, quand les pièces ne sont plus là pour boucher les trous. Avant un échange ou une reprise, compte les îlots avant et après : un échange qui te laisse un pion isolé en crée un de plus. Le critère n\'est pas absolu : un camp très actif (centre, pièces bien placées) peut vivre avec trois îlots, comme les Blancs dans la Panov-Botvinnik ci-dessous. Mais si l\'activité retombe, la structure te le fait payer.',
    links: [
      { label: 'Structure de pions (Wikipedia)', url: 'https://fr.wikipedia.org/wiki/Structure_de_pions', kind: 'wikipedia' },
    ],
    positions: [
      {
        fen: 'r1bq1rk1/pp2bppp/2n1p3/8/3P4/2PB1N2/P2B1PPP/R2Q1RK1 w - - 1 12',
        caption: 'Les Blancs ont 3 îlots (a2 / c3-d4 / f2-g2-h2) contre 2 pour les Noirs (a7-b7 / e6-f7-g7-h7) : plus de pions à défendre, compensés ici par le centre et l\'activité des pièces.',
      },
    ],
    related: ['pawn-structure', 'isolated-pawn', 'doubled-pawns', 'pawn-majority', 'hanging-pawns'],
  },
  {
    id: 'pawn-majority',
    title: 'Majorité de pions',
    category: 'structure',
    aliases: ['pawn majority', 'majorité', 'candidate pawn', 'pion candidat', 'majorité saine', 'majorité estropiée', 'crippled majority'],
    shortDef: 'Avoir plus de pions que l\'adversaire sur une aile (3 contre 2, par exemple). Une majorité saine permet de créer un pion passé.',
    detail: 'Pour transformer ta majorité, avance d\'abord le pion candidat — celui qui n\'a aucun pion adverse devant lui — soutenu par les autres pions en phalange, puis échange : il reste un pion passé. Une majorité est saine quand ses pions sont intacts ; elle est estropiée quand ils sont doublés : à 3 contre 2 dont deux sur la même colonne, tu ne fabriqueras jamais de pion passé. Elle pèse surtout en finale, et encore plus loin des rois : le pion passé qui en sort détourne le roi adverse pendant que le tien agit ailleurs. Exemple d\'ouverture : dans la Sicilienne, les Blancs ont la majorité à l\'aile dame (a2-b2-c2 contre a6-b7) ; les Noirs ont la majorité centrale (d6-e7 contre e4). Erreur de club : pousser les pions de la majorité trop vite, sans pièces pour les soutenir : au lieu d\'un pion passé, tu te retrouves avec des pions faibles.',
    links: [
      { label: 'Structure de pions (Wikipedia)', url: 'https://fr.wikipedia.org/wiki/Structure_de_pions', kind: 'wikipedia' },
    ],
    positions: [
      {
        fen: 'rnbqkb1r/1p2pppp/p2p1n2/8/3NP3/2N5/PPP2PPP/R1BQKB1R w KQkq - 0 6',
        caption: 'Les Blancs ont 3 pions (a2-b2-c2) contre 2 (a6-b7) à l\'aile dame : une majorité. En face, les Noirs ont la majorité centrale (d6-e7 contre e4).',
      },
    ],
    related: ['passed-pawn', 'king-activity', 'minority-attack', 'doubled-pawns', 'pawn-structure', 'sicilian'],
  },
  {
    id: 'weak-square',
    title: 'Case faible (trou)',
    category: 'structure',
    aliases: ['weak square', 'weak squares', 'hole', 'trou', 'case faible', 'cases faibles'],
    shortDef: 'Case qu\'aucun de tes pions ne peut plus jamais contrôler : l\'adversaire peut y installer une pièce à demeure, surtout un cavalier.',
    detail: 'On parle de trou quand les pions qui pouvaient défendre une case ont avancé ou disparu : seules tes pièces peuvent encore la couvrir. Plus elle est avancée (3e à 5e rangée de ton camp) et centrale, plus elle est dangereuse. Vue de l\'autre camp, c\'est un avant-poste : un cavalier posé là, protégé par un pion, ne se chasse pas. Les trous naissent de coups de pions irréversibles : ...f5, ...e6 et ...d5 laissent e5 sans défense pion (Stonewall) ; d4, e3 et f4 laissent e4 ; ...e5 avec ...d6 laisse d5 (Sicilienne). Avant de pousser un pion, demande-toi quelle case il ne contrôlera plus jamais. Défense : occupe la case avec une de tes pièces, ou échange la pièce adverse qui veut s\'y installer. Erreur de club : pousser un pion "pour gagner de l\'espace" et offrir à l\'adversaire une case à vie.',
    links: [
      { label: 'Case faible (Wikipedia)', url: 'https://fr.wikipedia.org/wiki/Case_faible', kind: 'wikipedia' },
      { label: 'Avant-poste (Wikipedia)', url: 'https://fr.wikipedia.org/wiki/Avant-poste_(%C3%A9checs)', kind: 'wikipedia' },
    ],
    positions: [
      {
        fen: 'rnbq1rk1/pp4pp/2pbpn2/3pNp2/2PP4/2N3P1/PP2PPBP/R1BQ1RK1 b - - 3 8',
        caption: 'Les pions noirs f5, e6 et d5 ne pourront plus jamais contrôler e5 : c\'est un trou. Le cavalier blanc s\'y installe, soutenu par d4, et aucun pion ne peut le chasser.',
      },
    ],
    related: ['outpost', 'backward-pawn', 'color-complex', 'boleslavsky-hole', 'stonewall', 'isolated-pawn'],
  },
  {
    id: 'pawn-chain',
    title: 'Chaîne de pions',
    category: 'structure',
    aliases: ['pawn chain', 'base de la chaîne', 'tête de la chaîne', 'attaquer la base'],
    shortDef: 'Suite de pions en diagonale qui se protègent les uns les autres. Le pion arrière est la base, le plus avancé est la tête.',
    detail: 'Règle de Nimzowitsch : on attaque la base de la chaîne adverse, le seul pion qu\'aucun pion ne protège, avec une rupture de pions ; la tête s\'attaque plutôt avec des pièces ou un levier comme ...f6. Et on joue du côté où pointent ses propres pions : une chaîne qui pointe vers l\'aile roi te donne de l\'espace là-bas, donc c\'est là que tu attaques (f4-f5, g4). Exemple type : la Française d\'Avance, où les chaînes d4-e5 (Blancs) et e6-d5 (Noirs) pointent dans des directions opposées : les Blancs attaquent à l\'aile roi, les Noirs frappent la base d4 par ...c5 et jouent à l\'aile dame. Le fou qui reste derrière sa propre chaîne (c8 dans la Française) devient un mauvais fou : sors-le avant que la position ne se ferme. Erreur de club : s\'acharner sur la tête de la chaîne adverse (e5), solide, plutôt que sur sa base.',
    links: [
      { label: 'Chaîne de pions (Wikipedia)', url: 'https://fr.wikipedia.org/wiki/Cha%C3%AEne_de_pions', kind: 'wikipedia' },
      { label: 'Mon système, Nimzowitsch (Wikipedia)', url: 'https://fr.wikipedia.org/wiki/Mon_syst%C3%A8me', kind: 'wikipedia' },
    ],
    positions: [
      {
        fen: 'rnbqkbnr/ppp2ppp/4p3/3pP3/3P4/8/PPP2PPP/RNBQKBNR b KQkq - 0 3',
        caption: 'Deux chaînes face à face : d4-e5 pointe vers l\'aile roi (c\'est là que les Blancs attaquent), e6-d5 pointe vers l\'aile dame. Les Noirs frappent la base d4 par ...c5.',
        bestSan: 'c5',
      },
    ],
    related: ['french', 'pawn-break', 'bad-bishop', 'kings-indian', 'pawn-structure', 'space', 'center-types'],
  },
  {
    id: 'hedgehog',
    title: 'Hérisson',
    category: 'structure',
    aliases: ['hedgehog', 'système du hérisson', 'structure du hérisson'],
    shortDef: 'Structure noire a6-b6-d6-e6 contre les pions blancs c4 et e4 : les Noirs se ramassent derrière leurs pions de 6e rangée, puis frappent d\'un coup avec ...b5 ou ...d5.',
    detail: 'Les Blancs ont l\'espace (pions c4 et e4, plus de pion d), mais ils sont sous la menace permanente des ruptures ...b5 et ...d5 : le hérisson se ramasse, puis ses piquants sortent d\'un coup. Plan noir : patience. Regroupe les pièces derrière les pions (dame en c7, tours en c8 et d8, cavaliers en d7 et f6, fou en b7), échange pour gagner de l\'air, puis frappe avec ...d5 ou ...b5 quand les Blancs relâchent la surveillance. Plan blanc : garde l\'espace sans te surétendre, empêche ...b5 (a4), mets la pression sur d6 avec les tours sur la colonne d et prépare une attaque à l\'aile roi (g4-g5) si les pièces noires sont trop passives. On le trouve dans l\'Anglaise (...b6 et ...Bb7) et dans la Sicilienne avec c4 (Kan, Paulsen). Erreur de club : attaquer à tout prix en laissant passer un ...d5 qui libère tout.',
    links: [
      { label: 'Système du hérisson (Wikipedia)', url: 'https://fr.wikipedia.org/wiki/Syst%C3%A8me_du_h%C3%A9risson', kind: 'wikipedia' },
    ],
    positions: [
      {
        fen: 'r3k2r/1bqnbppp/pp1ppn2/8/2PNP3/2N1BP2/PP1QB1PP/R4RK1 w kq - 2 12',
        caption: 'Hérisson : les pions noirs a6-b6-d6-e6 contre c4 et e4. Les Noirs attendent leur heure pour ...d5 ou ...b5 ; les Blancs mettent la pression sur d6 avec Rfd1.',
        bestSan: 'Rfd1',
      },
    ],
    related: ['maroczy-bind', 'space', 'pawn-break', 'sicilian', 'english-opening', 'backward-pawn'],
  },
  {
    id: 'maroczy-bind',
    title: 'Étau de Maroczy',
    category: 'structure',
    aliases: ['maroczy bind', 'étau maroczy', 'maroczy', 'système maróczy'],
    shortDef: 'Pions blancs en c4 et e4 (sans pion d) contre une Sicilienne sans pion c : l\'étau contrôle d5 et empêche les ruptures ...d5 et ...b5.',
    detail: 'Le camp à l\'étau ne cherche pas à attaquer : il étouffe. Il surveille d5, garde ses pièces sur l\'échiquier et vise une finale ou une attaque à l\'aile roi. Le camp comprimé doit échanger des pièces (surtout les cavaliers), jouer sur les cases noires (...Bg7, ...Nc5, ...a5 pour fixer) et préparer ...b5 ou ...f5 au bon moment : si ...d5 passe, l\'étau est brisé. L\'étau naît dans la Sicilienne accélérée du Dragon (1.e4 c5 2.Nf3 Nc6 3.d4 cxd4 4.Nxd4 g6 5.c4) et dans la Kan avec c4. Si les Noirs installent ...b6, ...d6 et ...e6, on parle de hérisson. Erreur de club : lâcher l\'étau en jouant f4 ou g4 sans pièces, ou laisser passer ...d5 par distraction.',
    links: [
      { label: 'Système Maróczy (Wikipedia)', url: 'https://fr.wikipedia.org/wiki/Syst%C3%A8me_Mar%C3%B3czy', kind: 'wikipedia' },
    ],
    positions: [
      {
        fen: 'r2q1rk1/pp1bppbp/2np1np1/8/2PNP3/2N1B3/PP2BPPP/R2Q1RK1 w - - 2 10',
        caption: 'Étau de Maroczy : c4 et e4 verrouillent d5, la rupture ...d5 est très difficile à réaliser. Les Noirs cherchent à échanger les pièces (...Nxd4) pour respirer.',
      },
    ],
    related: ['hedgehog', 'sicilian', 'space', 'exchanges', 'pawn-break', 'outpost'],
  },
  {
    id: 'boleslavsky-hole',
    title: 'Trou d5 (Boleslavsky)',
    category: 'structure',
    aliases: ['boleslavsky hole', 'trou boleslavsky', 'trou d5', 'd5 hole', 'boleslavsky'],
    shortDef: 'Dans la Sicilienne, ...e5 avec ...d6 donne le centre aux Noirs mais laisse un trou en d5 et un pion d6 arriéré. La rupture ...d5 est leur coup libérateur.',
    detail: 'Après ...cxd4 et ...e5, plus aucun pion noir ne peut contrôler d5 : c\'est un trou, et un cavalier blanc posé là, soutenu par e4, est monstrueux. Les Blancs jouent Nd5 (en échangeant au besoin les défenseurs de d5), pressent le pion d6 arriéré sur la colonne d et freinent ...b5 par a4. Les Noirs doivent soit garder les pièces qui contrôlent d5 (fou de cases blanches, cavalier f6), soit réaliser la rupture ...d5 : si elle passe, la faiblesse disparaît et le jeu s\'égalise. Leur contre-jeu : ...b5-b4 pour chasser le cavalier de c3, tours sur la colonne c. On le rencontre dans la Najdorf (...e5), la Classique (variante Boleslavsky : 6.Be2 e5) et la Sveshnikov. Erreur de club : laisser le cavalier blanc s\'installer en d5 sans rien tenter.',
    links: [
      { label: 'Sicilienne classique (Wikipedia)', url: 'https://fr.wikipedia.org/wiki/Sicilienne_classique', kind: 'wikipedia' },
      { label: 'Variante Svechnikov (Wikipedia)', url: 'https://fr.wikipedia.org/wiki/Variante_Svechnikov', kind: 'wikipedia' },
      { label: 'Issaak Boleslavski (Wikipedia)', url: 'https://fr.wikipedia.org/wiki/Issaak_Boleslavski', kind: 'wikipedia' },
    ],
    positions: [
      {
        fen: 'r2q1rk1/pp2bppp/2npbn2/4p3/4P3/1NN1B3/PPP1BPPP/R2Q1RK1 w - - 6 10',
        caption: 'd5 est un trou : aucun pion noir ne peut plus le contrôler, et le pion d6 reste arriéré. Bf3 soutient e4 et prépare Nd5 (après ...Nxd5 exd5, le fou protège d5) ; les Noirs gardent le fou e6 et le cavalier f6 pour le surveiller.',
        bestSan: 'Bf3',
      },
    ],
    related: ['sicilian', 'weak-square', 'backward-pawn', 'outpost', 'pawn-break', 'maroczy-bind'],
  },
  {
    id: 'benoni',
    title: 'Structure Benoni',
    category: 'structure',
    aliases: ['benoni', 'benoni structure', 'modern benoni', 'benoni moderne', 'défense benoni'],
    shortDef: 'Majorité centrale pour les Blancs (d5-e4, rupture e5) contre majorité à l\'aile dame pour les Noirs (a-b-c, rupture ...b5) : un déséquilibre où chacun joue sur son aile.',
    detail: 'Après 1.d4 Nf6 2.c4 c5 3.d5 e6 4.Nc3 exd5 5.cxd5 d6, les Blancs ont plus d\'espace et la majorité au centre (d5 et e4 contre d6) : leur plan est la rupture e4-e5, souvent préparée par f4 ou par des pièces bien placées, pour ouvrir le centre et attaquer le roi. Les Noirs ont la majorité à l\'aile dame (a7-b7-c5 contre a2-b2) : leur plan est ...a6 puis ...b5, avec le fou en g7 sur la grande diagonale, un cavalier qui vise e5 et la pression sur e4 (tour en e8). Le jeu est tranchant : si e5 passe, les Noirs sont en grand danger ; si ...b5 passe, ils prennent l\'initiative et fabriquent un pion passé. Attention aux pions faibles : d6 pour les Noirs, e4 pour les Blancs. Erreur de club : jouer e5 sans que e4 et d5 soient solides, ou ...b5 sans que la tour et le fou de g7 soient prêts.',
    links: [
      { label: 'Défense Benoni (Wikipedia)', url: 'https://fr.wikipedia.org/wiki/D%C3%A9fense_Benoni', kind: 'wikipedia' },
    ],
    positions: [
      {
        fen: 'rnbqr1k1/pp3pbp/3p1np1/2pP4/4P3/2N2N2/PP2BPPP/R1BQ1RK1 w - - 6 10',
        caption: 'Structure Benoni : les Blancs ont la majorité centrale (d5-e4 contre d6, rupture e5), les Noirs la majorité à l\'aile dame (a7-b7-c5 contre a2-b2, rupture ...b5).',
      },
    ],
    related: ['pawn-majority', 'pawn-break', 'kings-indian', 'space', 'center-types', 'weak-square'],
  },
  {
    id: 'mobile-center',
    title: 'Centre mobile',
    category: 'structure',
    aliases: ['mobile center', 'big center', 'grand centre', 'duo central', 'central pawn duo'],
    shortDef: 'Un duo de pions centraux (d4-e4) libre d\'avancer, face à un camp qui n\'a presque plus de pions au centre. Fort s\'il avance au bon moment, cible s\'il est harcelé.',
    detail: 'Typique de la Grünfeld (variante d\'échange), de l\'Alekhine (attaque des quatre pions) et de la défense moderne. Le camp qui a le centre : soutiens le duo avec des pièces (fou en e3, tour en d1, f3 ou f4) et pousse d5 ou e5 quand cela gagne de l\'espace ou des tempi, puis exploite l\'espace pour attaquer le roi. L\'autre camp n\'a pas de pions au centre mais frappe sans cesse la base : ...c5 contre d4, ...e5 ou ...f5 contre e4, avec la dame en b6 ou a5, le fou en g7 ou g4 et le cavalier en c6. Un centre poussé trop tôt devient une cible (pions surétendus, cases faibles derrière) ; un centre qu\'on n\'attaque pas finit par rouler. Règle pratique : si tu as le centre, ne le pousse pas avant que tes pièces le soutiennent ; si tu l\'affrontes, attaque-le tout de suite, avec des pions ET des pièces. Erreur de club : laisser le centre mobile s\'installer sans le frapper par ...c5 ou ...e5.',
    links: [
      { label: 'Défense Grünfeld (Wikipedia)', url: 'https://fr.wikipedia.org/wiki/D%C3%A9fense_Gr%C3%BCnfeld', kind: 'wikipedia' },
      { label: 'Centre (Wikipedia)', url: 'https://fr.wikipedia.org/wiki/Centre_(%C3%A9checs)', kind: 'wikipedia' },
    ],
    positions: [
      {
        fen: 'rnbqk2r/ppp1ppbp/6p1/8/3PP3/2P5/P4PPP/R1BQKBNR w KQkq - 1 7',
        caption: 'Grünfeld d\'échange : le duo d4-e4 est libre d\'avancer et les Noirs n\'ont plus de pion au centre, mais ils vont le frapper (...c5, ...Nc6, ...Qa5, ...Bg4).',
      },
    ],
    related: ['center-types', 'pawn-break', 'space', 'kings-indian', 'initiative'],
  },

  // ---------------- Strategy (positional analysis) ----------------
  {
    id: 'color-complex',
    title: 'Complexe de cases faibles',
    category: 'strategy',
    aliases: ['color complex', 'weak color complex', 'complexe de cases', 'cases noires faibles', 'cases blanches faibles'],
    shortDef: 'Ton fou d\'une couleur a disparu et tes pions sont sur l\'autre couleur : toutes les cases de la première deviennent des trous à la merci de l\'adversaire.',
    detail: 'Un complexe se fragilise en deux temps : (1) ton fou de cette couleur est échangé ; (2) tes pions restent sur les cases de l\'autre couleur et ne contrôlent donc aucune case du complexe. Résultat : ces cases, souvent autour de ton roi, n\'ont plus de défenseur naturel. L\'adversaire y installe une dame ou un fou de la bonne couleur : menaces de mat sur h6 et g7 (ou h3 et g2), pièces qui s\'infiltrent. Exemples : le Dragon sicilien quand le fou g7 est échangé, la Française Winawer après ...Bxc3+, un fianchetto blanc dont le fou g2 est échangé. Prévention : ne troque pas ton fou de cette couleur sans réfléchir, garde un pion sur une case du complexe, ou crée du contre-jeu. Plan d\'attaque : garde ton propre fou de cette couleur (ou ta dame) et pose tes pièces sur les cases faibles.',
    links: [
      { label: 'Case faible (Wikipedia)', url: 'https://fr.wikipedia.org/wiki/Case_faible', kind: 'wikipedia' },
    ],
    positions: [
      {
        fen: 'r3k1r1/ppqbnp2/2n1p3/3pP3/5P2/P1NQ4/2P3PP/R1B1KB1R b KQq - 0 13',
        caption: 'Winawer (pion empoisonné) : les Noirs ont cédé leur fou de cases noires et leurs pions d5, e6, f7 sont sur cases blanches. d6, f6, g5 et d4 n\'ont plus de défenseur pion : les Blancs (e5, f4, Qd3) y règnent.',
      },
    ],
    related: ['weak-square', 'bad-bishop', 'bishop-pair', 'outpost', 'king-safety', 'french'],
  },
  {
    id: 'bishop-pair',
    title: 'Paire de fous',
    category: 'strategy',
    aliases: ['bishop pair', 'two bishops', 'les deux fous', 'deux fous'],
    shortDef: 'Posséder les deux fous contre fou + cavalier (ou deux cavaliers). Un avantage durable, qui grandit quand la position s\'ouvre.',
    detail: 'Les deux fous couvrent les deux couleurs de cases et se complètent : ce que l\'un ne voit pas, l\'autre le voit. Leur valeur grimpe quand les pions disparaissent et surtout en finale : la paire vaut grosso modo un demi-pion de plus. Plan du camp qui l\'a : ouvrir le jeu par des ruptures de pions, éviter de bloquer le centre, ne pas échanger un fou contre un cavalier sans raison. Plan de l\'autre camp : garder la position fermée, créer des avant-postes pour les cavaliers, échanger l\'un des deux fous. Exemple typique : la Nimzo-Indienne, où les Noirs cèdent la paire (...Bxc3+) en échange de pions doublés. Erreur de club : échanger un fou contre un cavalier "parce que ça vaut trois points", et lâcher la paire sans rien obtenir.',
    links: [
      { label: 'Fou (Wikipedia)', url: 'https://fr.wikipedia.org/wiki/Fou_(%C3%A9checs)', kind: 'wikipedia' },
    ],
    positions: [
      {
        fen: 'r1b1r1k1/ppq2ppp/2n2n2/2p1p3/3P4/P1PBPN2/2Q2PPP/R1B2RK1 w - - 2 13',
        caption: 'Nimzo-Indienne : les Blancs ont les deux fous (c1 et d3) contre fou + deux cavaliers. Leur structure est abîmée (a3, c3), mais plus le centre s\'ouvre (dxe5, dxc5), plus la paire pèse.',
      },
    ],
    related: ['bad-bishop', 'knight-vs-bishop', 'nimzo-indian', 'opposite-colored-bishops', 'piece-activity', 'pawn-break', 'center-types'],
  },
  {
    id: 'knight-vs-bishop',
    title: 'Cavalier contre fou',
    category: 'strategy',
    aliases: ['knight vs bishop', 'bishop vs knight', 'knight versus bishop', 'cavalier ou fou', 'fou ou cavalier', 'fou contre cavalier'],
    shortDef: 'En position fermée, le cavalier est souvent meilleur (il saute par-dessus les pions et adore les avant-postes). En position ouverte, avec des pions sur les deux ailes, le fou prend l\'avantage.',
    detail: 'Le fou a une longue portée mais reste prisonnier de sa couleur ; le cavalier est lent mais atteint toutes les cases et se moque des barrières de pions. Cavalier meilleur : centre fermé, fou adverse bloqué derrière ses pions, avant-poste solide (case qu\'aucun pion adverse ne contrôle), jeu sur une seule aile. Fou meilleur : position ouverte, pions sur les deux ailes (il agit des deux côtés, le cavalier met trop de temps à changer de côté), cases faibles de sa couleur dans le camp adverse, paire de fous. Règle pratique : si tu as le cavalier, garde les pions bloqués et installe-le sur un avant-poste ; si tu as le fou, ouvre le jeu et vise les pions adverses placés sur sa couleur. Erreur de club : lâcher son fou contre un cavalier "parce que ça vaut trois points", alors que la position lui donne tout son pouvoir.',
    links: [
      { label: 'Finale fou contre cavalier (Wikipedia)', url: 'https://fr.wikipedia.org/wiki/Finale_fou_contre_cavalier', kind: 'wikipedia' },
      { label: 'Drill finales de fou (Lichess)', url: 'https://lichess.org/training/bishopEndgame', kind: 'lichess' },
      { label: 'Drill finales de cavalier (Lichess)', url: 'https://lichess.org/training/knightEndgame', kind: 'lichess' },
    ],
    positions: [
      {
        fen: 'rnbq1rk1/pp4pp/2pbpn2/3pNp2/2PP4/2N3P1/PP2PPBP/R1BQ1RK1 b - - 3 8',
        caption: 'Position fermée : le cavalier blanc en e5 (avant-poste soutenu par d4) domine le fou noir de c8, gêné par ses propres pions c6, d5 et e6.',
      },
    ],
    related: ['bad-bishop', 'outpost', 'bishop-pair', 'center-types', 'weak-square', 'blockade', 'opposite-colored-bishops'],
  },
  {
    id: 'rook-seventh',
    title: 'Tour en 7e rangée',
    category: 'strategy',
    aliases: ['rook on the seventh', 'rook on the 7th', 'seventh rank', '7th rank', 'tour en septième', 'tour en 7e', 'septième rangée'],
    shortDef: 'Une tour en 7e rangée (2e pour les Noirs) attaque les pions adverses à leur base et coupe le roi adverse sur sa dernière rangée.',
    detail: 'Les pions restés sur la 7e rangée ne peuvent être protégés que par des pièces : la tour les attaque de côté, et les pièces adverses restent clouées à leur défense. Elle gêne aussi le roi, qui ne peut plus quitter la 8e rangée. Deux tours en 7e sont souvent décisives : mat, gain de pions ou échec perpétuel. Pour y entrer, il faut une colonne ouverte, puis la contrôler avec les tours doublées. En finale de tour, une tour en 7e compense souvent un pion de moins. Avant d\'y entrer, vérifie que ta tour ne sera pas piégée (roi adverse + une pièce sur la 8e) et que ton propre roi a une case de fuite : le mat du couloir ne pardonne pas. Erreur de club : laisser l\'adversaire occuper la colonne ouverte en premier, puis n\'avoir aucun moyen d\'entrer.',
    links: [
      { label: 'Tour (Wikipedia)', url: 'https://fr.wikipedia.org/wiki/Tour_(%C3%A9checs)', kind: 'wikipedia' },
      { label: 'Drill finales de tour (Lichess)', url: 'https://lichess.org/training/rookEndgame', kind: 'lichess' },
    ],
    positions: [
      {
        fen: '2r3k1/1p1R1p2/p5p1/7p/7P/6P1/PP3PK1/8 w - - 0 1',
        caption: 'La tour blanche en d7 attaque b7 par le côté et fixe f7. Rxb7 gagne un pion : rien ne défend b7, et la tour noire ne peut pas le protéger.',
        bestSan: 'Rxb7',
      },
    ],
    related: ['open-file', 'rook-endgame', 'back-rank-mate', 'piece-activity', 'tarrasch-rule'],
  },
  {
    id: 'open-file',
    title: 'Colonne ouverte',
    category: 'strategy',
    aliases: ['open file', 'semi-open file', 'half-open file', 'colonne semi-ouverte', 'colonnes ouvertes'],
    shortDef: 'Colonne sans aucun pion : le terrain des tours. Colonne semi-ouverte : sans pion de ton camp, mais avec un pion adverse à attaquer.',
    detail: 'Une tour sans colonne ouverte regarde ses propres pions. Une colonne ouverte s\'occupe d\'abord (une tour dessus), se double ensuite (deux tours, ou tour + dame derrière), puis sert à pénétrer en 7e ou 8e rangée. Si l\'adversaire la prend avant toi, dispute-la : échange les tours, ou contre-attaque ailleurs. Une colonne semi-ouverte met la pression sur le pion adverse qui s\'y trouve : c\'est typique de la colonne c dans la Sicilienne (pour les Noirs) ou de la colonne e après un échange de pions centraux. Pour ouvrir une colonne, échange des pions du côté où tu es le plus fort (rupture de pions). Erreur de club : ouvrir une colonne dont l\'adversaire profite mieux que toi, ou laisser ses tours sur la 1re rangée sans plan.',
    links: [
      { label: 'Ligne ouverte (Wikipedia)', url: 'https://fr.wikipedia.org/wiki/Ligne_ouverte_(%C3%A9checs)', kind: 'wikipedia' },
    ],
    positions: [
      {
        fen: 'r1bq1rk1/ppp1nppp/8/3n4/2BP4/1Q3N2/PP1N1PPP/R4RK1 w - - 4 12',
        caption: 'Les deux pions e ont disparu : la colonne e est ouverte. Rfe1 y installe une tour ; les Noirs devront la disputer (...Re8).',
        bestSan: 'Rfe1',
      },
    ],
    related: ['rook-seventh', 'rook-endgame', 'pawn-break', 'piece-activity', 'center-types', 'backward-pawn'],
  },
  {
    id: 'king-safety',
    title: 'Sécurité du roi',
    category: 'strategy',
    aliases: ['king safety', 'roi en sécurité', 'roi exposé', 'roi au centre', 'king in the center', 'bouclier de pions', 'pawn shield'],
    shortDef: 'Un roi en sécurité est roqué, abrité par ses pions, loin des colonnes ouvertes. Un roi resté au centre devient une cible dès que le jeu s\'ouvre.',
    detail: 'Trois critères : (1) le bouclier de pions devant le roi (f-g-h après le petit roque) : chaque pion avancé crée un trou ; (2) les colonnes et diagonales ouvertes vers le roi, que les tours et les fous adverses adorent ; (3) le nombre d\'attaquants contre le nombre de défenseurs dans la zone du roi. Roque tôt, avant que le centre ne s\'ouvre. Un roi resté en e1 ou e8 est vulnérable aux colonnes d et e : si l\'adversaire est mieux développé, il va ouvrir le centre. Garde un cavalier en f3/f6 (ou un fou) près de ton roi et ne bouge pas les pions de son abri sans raison. Aux roques opposés, la vitesse prime : c\'est la tempête de pions. Erreur de club : attaquer à l\'aile roi adverse en laissant son propre roi au centre.',
    links: [
      { label: 'Roque (Wikipedia)', url: 'https://fr.wikipedia.org/wiki/Roque_(%C3%A9checs)', kind: 'wikipedia' },
      { label: 'Drill roi exposé (Lichess)', url: 'https://lichess.org/training/exposedKing', kind: 'lichess' },
    ],
    positions: [
      {
        fen: '3rkb1r/p2nqppp/5n2/1B2p1B1/4P3/1Q6/PPP2PPP/2KR3R w k - 3 13',
        caption: 'Partie de l\'Opéra (Morphy, 1858) : le roi noir est resté au centre, le cavalier d7 est cloué. Rxd7! ouvre la colonne d et le roi ne trouvera jamais d\'abri.',
        bestSan: 'Rxd7',
      },
    ],
    related: ['castling', 'development', 'pawn-storm', 'initiative', 'open-file', 'checks-captures-threats'],
  },
  {
    id: 'space',
    title: 'Avantage d\'espace',
    category: 'strategy',
    aliases: ['space', 'space advantage', 'espace', 'gain d\'espace', 'cramped position', 'position à l\'étroit'],
    shortDef: 'Contrôler plus de cases que l\'adversaire dans ton camp et au-delà : tes pions avancés laissent respirer tes pièces et étouffent les siennes.',
    detail: 'L\'espace se mesure aux cases que tu contrôles dans ton camp et au-delà : plus tes pions sont avancés (c4-e4, d4-e5), moins l\'adversaire a de cases pour manœuvrer. Le camp à l\'étroit cherche à échanger les pièces : chaque échange le soulage. Le camp qui a l\'espace évite les échanges, garde ses pièces et prépare une percée, souvent sur l\'aile où il a le plus de pions. Attention à la surextension : chaque pion poussé laisse des cases faibles derrière lui, et l\'adversaire peut frapper la base de la chaîne par une rupture libératrice. Exemples : l\'étau de Maroczy, la Française d\'Avance, la défense est-indienne (c4-d4-e4). Erreur de club : gagner de l\'espace avec les pions sans y amener les pièces : la position devient une cible.',
    links: [
      { label: 'Stratégie échiquéenne (Wikipedia)', url: 'https://fr.wikipedia.org/wiki/Strat%C3%A9gie_%C3%A9chiqu%C3%A9enne', kind: 'wikipedia' },
    ],
    related: ['exchanges', 'maroczy-bind', 'pawn-chain', 'center-types', 'pawn-break', 'kings-indian', 'hedgehog'],
  },
  {
    id: 'center-types',
    title: 'Types de centre',
    category: 'strategy',
    aliases: ['center types', 'centre fermé', 'centre ouvert', 'centre fixe', 'centre en tension', 'closed center', 'open center', 'fixed center', 'central tension'],
    shortDef: 'Le type de centre (fermé, ouvert, mobile, fixe ou en tension) dicte le plan : jeu sur les ailes, course au développement, ruptures, manœuvres.',
    detail: 'Fermé : les pions d et e sont bloqués face à face ; on joue sur les ailes, du côté où pointent tes chaînes, et les cavaliers valent souvent mieux que les fous. Ouvert : peu ou pas de pions au centre ; développement, sécurité du roi et activité des pièces priment, les fous et les tours gagnent en valeur, un roi au centre est en danger. Mobile : un camp a un duo de pions libre d\'avancer (d4-e4) ; il doit le pousser au bon moment, l\'autre le frappe avant. Fixe : un seul couple central est bloqué, le reste est semi-ouvert (Carlsbad) : plans lents autour de faiblesses fixes, comme l\'attaque de minorité. En tension : des pions centraux s\'attaquent (d4 contre e5, par exemple) ; résoudre la tension aide souvent l\'adversaire, garde-la tant que tu peux et ne prends que si l\'échange t\'apporte quelque chose. Avant de choisir un plan, détermine le type de centre. Erreur de club : jouer sur l\'aile quand le centre est ouvert, ou ouvrir le centre quand ton roi est encore au milieu.',
    links: [
      { label: 'Centre (Wikipedia)', url: 'https://fr.wikipedia.org/wiki/Centre_(%C3%A9checs)', kind: 'wikipedia' },
      { label: 'Position ouverte (Wikipedia)', url: 'https://fr.wikipedia.org/wiki/Position_ouverte', kind: 'wikipedia' },
    ],
    positions: [
      {
        fen: 'rnbqkbnr/ppp2ppp/4p3/3pP3/3P4/8/PPP2PPP/RNBQKBNR b KQkq - 0 3',
        caption: 'Centre fermé : d4-d5 et e5-e6 sont bloqués. Le jeu se déplace sur les ailes : f4-f5 pour les Blancs, ...c5 et le jeu à l\'aile dame pour les Noirs.',
      },
      {
        fen: 'r1bqkbnr/pppp1ppp/2n5/8/3NP3/8/PPP2PPP/RNBQKB1R b KQkq - 0 4',
        caption: 'Centre ouvert : il ne reste qu\'un pion central de chaque côté. Développement, colonnes ouvertes et sécurité du roi décident de tout.',
      },
      {
        fen: 'rnbqk2r/ppp1ppbp/6p1/8/3PP3/2P5/P4PPP/R1BQKBNR w KQkq - 1 7',
        caption: 'Centre mobile : le duo blanc d4-e4 est libre d\'avancer ; les Noirs, sans pion au centre, doivent le frapper tout de suite (...c5, ...Nc6).',
      },
      {
        fen: 'r1bqrnk1/pp2bppp/2p2n2/3p2B1/3P4/2NBP3/PPQ1NPPP/R4RK1 w - - 8 11',
        caption: 'Centre fixe (Carlsbad) : d4 et d5 sont bloqués, la colonne c est semi-ouverte pour les Blancs et la colonne e pour les Noirs. Les Blancs préparent l\'attaque de minorité (Rab1, b4-b5), les Noirs jouent à l\'aile roi.',
      },
      {
        fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/3PP3/5N2/PPP2PPP/RNBQKB1R b KQkq - 0 3',
        caption: 'Centre en tension : d4 attaque e5, et e5 attaque d4. Celui qui prend ou pousse décide du type de centre qui suivra.',
      },
    ],
    related: ['pawn-structure', 'mobile-center', 'pawn-chain', 'pawn-break', 'carlsbad', 'bishop-pair', 'knight-vs-bishop', 'king-safety'],
  },
  {
    id: 'pawn-break',
    title: 'Rupture de pions',
    category: 'strategy',
    aliases: ['pawn break', 'pawn lever', 'rupture', 'rupture centrale', 'levier de pions', 'central break', 'quand rompre'],
    shortDef: 'Pousser un pion pour attaquer un pion adverse et changer la structure : c\'est le moyen d\'ouvrir le jeu à ton avantage. Le bon timing compte plus que le coup lui-même.',
    detail: 'Avant de rompre, passe en revue : (1) le développement : le camp le mieux développé a intérêt à ouvrir, pas l\'autre ; (2) ton roi : rompre au centre avec un roi encore au milieu se retourne contre toi ; (3) le soutien : la case de la rupture doit être défendue au moins autant de fois qu\'elle est attaquée ; (4) les conséquences : après l\'échange, quel pion devient isolé, arriéré ou passé ? quelle colonne s\'ouvre, et pour qui ? ; (5) ne libère pas l\'adversaire : échanger un de ses pions faibles le tire d\'affaire. Si une condition manque, prépare la rupture (pion de soutien, pièce de plus). Ruptures classiques : ...c5 (Française, Caro-Kann), ...d5 (Sicilienne, Hérisson), e4-e5, f4-f5, b4-b5 (attaque de minorité), ...f5 (Est-Indienne). Erreur de club : rompre "parce qu\'on peut", sans compter les défenseurs de la case.',
    links: [
      { label: 'Structure de pions (Wikipedia)', url: 'https://fr.wikipedia.org/wiki/Structure_de_pions', kind: 'wikipedia' },
    ],
    positions: [
      {
        fen: 'rnbq1rk1/2p1bppp/p2p1n2/1p2p3/4P3/1BP2N1P/PP1P1PP1/RNBQR1K1 w - - 1 10',
        caption: 'Espagnole fermée (Breyer) : les deux rois sont à l\'abri, e4 est solide et la case d4 est soutenue (c3, Nf3, Re1). Le centre est prêt : d4 est la rupture thématique.',
        bestSan: 'd4',
      },
    ],
    related: ['pawn-structure', 'center-types', 'development', 'king-safety', 'isolated-pawn', 'open-file', 'pawn-chain', 'minority-attack', 'prophylaxis'],
  },
  {
    id: 'blockade',
    title: 'Blocus',
    category: 'strategy',
    aliases: ['blockade', 'bloqueur', 'cavalier bloqueur', 'blocage', 'blockading knight'],
    shortDef: 'Poser une pièce juste devant un pion passé (ou isolé) adverse pour l\'empêcher d\'avancer. Nimzowitsch : un pion passé doit être bloqué.',
    detail: 'Chez Nimzowitsch (Mon système), un pion passé est une force qui n\'attend que d\'avancer : en le bloquant, tu l\'éteins, et ta pièce bloqueuse gagne une case forte. Le bloqueur idéal est un cavalier : il garde toute son activité depuis la case de blocage, et aucun pion ne peut le chasser si le pion bloqué est isolé. Un fou est moins efficace (limité à une couleur), une tour est trop précieuse, mais en finale le roi est un excellent bloqueur. Le bloqueur doit être protégé et difficile à échanger : n\'accepte pas de l\'échanger sans raison, et chasse ou échange les pièces adverses qui veulent le déloger. Une fois le pion bloqué, attaque-le avec d\'autres pièces. Exemples : cavalier en d4 contre un pion isolé d5, cavalier en d6 contre un pion passé d5. Erreur de club : laisser avancer un pion passé "pour le reprendre plus tard" au lieu de le bloquer dès qu\'il passe.',
    links: [
      { label: 'Mon système, Nimzowitsch (Wikipedia)', url: 'https://fr.wikipedia.org/wiki/Mon_syst%C3%A8me', kind: 'wikipedia' },
      { label: 'Aaron Nimzowitsch (Wikipedia)', url: 'https://fr.wikipedia.org/wiki/Aaron_Nimzowitsch', kind: 'wikipedia' },
    ],
    positions: [
      {
        fen: '8/p3kp2/1p1n2p1/3P3p/8/1PN4P/P4KP1/8 w - - 0 1',
        caption: 'Le pion d5 est passé mais isolé : le cavalier noir en d6 le bloque, aucun pion blanc ne peut le chasser, et il garde toute son activité (il surveille c4, e4, b5 et f5).',
      },
    ],
    related: ['passed-pawn', 'outpost', 'isolated-pawn', 'isolated-queen-pawn', 'knight-vs-bishop', 'weak-square'],
  },
  {
    id: 'pawn-storm',
    title: 'Tempête de pions',
    category: 'strategy',
    aliases: ['pawn storm', 'opposite-side castling', 'roques opposés', 'roques de côtés opposés', 'attaque de pions'],
    shortDef: 'Lancer ses pions contre le roque adverse pour ouvrir des colonnes. Typique des roques opposés : une course où chaque tempo compte.',
    detail: 'Aux roques opposés, tes pions peuvent avancer vers le roi adverse sans découvrir le tien : lance-les (g4-g5, h4-h5, b4-b5…) pour ouvrir une colonne, puis amène les tours dessus. Chaque coup défensif que tu joues est un tempo offert : attaque plus vite que lui, sans te défendre mollement. Exemples classiques : le Dragon sicilien (attaque yougoslave : les Blancs lancent h4-h5, les Noirs répondent ...Rc8 et ...Rxc3 à l\'aile dame) et la Najdorf avec attaque anglaise (g4-g5 contre ...b5-b4). Avant de lancer la tempête, vérifie ton propre roi et ton centre : si le centre s\'ouvre trop tôt, elle se retourne contre toi. Les pions doivent être soutenus par les pièces, et l\'attaque n\'a de sens que si tu peux exploiter la colonne ouverte avec tes tours. Erreur de club : lancer les pions avec un roi pas encore à l\'abri, ou sans pièces pour exploiter la colonne.',
    links: [
      { label: 'Roque (Wikipedia)', url: 'https://fr.wikipedia.org/wiki/Roque_(%C3%A9checs)', kind: 'wikipedia' },
      { label: 'Drill attaque à l\'aile roi (Lichess)', url: 'https://lichess.org/training/kingsideAttack', kind: 'lichess' },
    ],
    positions: [
      {
        fen: '2rq1rk1/pp1bppbp/3p1np1/4n3/3NP3/1BN1BP2/PPPQ2PP/2KR3R w - - 9 12',
        caption: 'Dragon, attaque yougoslave : roques opposés. Les Blancs lancent la tempête avec h4 (puis h5, Bh6), les Noirs contre-attaquent sur la colonne c : c\'est une course.',
        bestSan: 'h4',
      },
    ],
    related: ['king-safety', 'castling', 'sicilian', 'initiative', 'pawn-break', 'open-file', 'sacrifice'],
  },
  {
    id: 'exchanges',
    title: 'Quand échanger',
    category: 'strategy',
    aliases: ['exchanges', 'trading pieces', 'when to trade', 'échange de pièces', 'échanges'],
    shortDef: 'Chaque échange change l\'équilibre : qui doit échanger quoi dépend de l\'avantage matériel, de l\'espace, de la structure et de l\'attaque.',
    detail: '(1) Matériel : avec un avantage, échange les pièces (pas les pions) ; en retard, évite-les. (2) Espace : à l\'étroit, échange pour respirer ; avec l\'espace, évite les échanges (étau de Maroczy). (3) Structure : le camp qui a un pion isolé (IQP) garde les pièces, car il est dynamique ; son adversaire échange vers la finale. (4) Pièces : échange ton mauvais fou ou la meilleure pièce adverse, pas ton cavalier d\'avant-poste. (5) Attaque : garde tes attaquants et échange les défenseurs adverses (cavalier f6, fou g7) ; en défense, échange les attaquants, la dame en premier. Avant de prendre, demande-toi ce que l\'échange change : structure (pion isolé, doublé ?), colonnes ouvertes, cases faibles, paire de fous. Erreur de club : échanger par réflexe ("c\'est égal") ou par peur, sans regarder ce qu\'il reste après.',
    links: [
      { label: 'Stratégie échiquéenne (Wikipedia)', url: 'https://fr.wikipedia.org/wiki/Strat%C3%A9gie_%C3%A9chiqu%C3%A9enne', kind: 'wikipedia' },
      { label: 'Valeur relative des pièces (Wikipedia)', url: 'https://fr.wikipedia.org/wiki/Valeur_relative_des_pi%C3%A8ces_d%27%C3%A9checs', kind: 'wikipedia' },
    ],
    related: ['simplification', 'space', 'isolated-queen-pawn', 'bad-bishop', 'bishop-pair', 'knight-vs-bishop', 'king-safety', 'initiative', 'maroczy-bind'],
  },

  // ---------------- Endgame technique ----------------
  {
    id: 'king-activity',
    title: 'Roi actif en finale',
    category: 'endgame',
    aliases: ['king activity', 'active king', 'roi actif', 'centraliser le roi', 'king in the endgame'],
    shortDef: 'En finale, le roi n\'est plus une cible mais une pièce de combat (à peu près une pièce mineure) : centralise-le et dirige-le vers les pions adverses.',
    detail: 'Quand les dames sont échangées, le danger de mat disparaît : ton roi doit sortir. Centralise-le (e4 ou d4 pour les Blancs, e5 ou d5 pour les Noirs), puis envoie-le vers les pions faibles adverses ou devant ton pion passé. À pions égaux, le camp dont le roi arrive le premier au centre prend souvent l\'avantage : il gagne des pions que les pièces seules n\'auraient pas cueillis. Dans les finales de pions, l\'opposition et les cases clés décident de tout. Pense-y dès le milieu de jeu : quand tu échanges les dames, ton coup suivant est souvent un coup de roi (Kf1-e2, Kg8-f7). Erreur typique : laisser le roi en g1 ou g8 pendant que celui de l\'adversaire marche au centre.',
    links: [
      { label: 'Finale de pions (Wikipedia)', url: 'https://fr.wikipedia.org/wiki/Finale_de_pions', kind: 'wikipedia' },
      { label: 'Drill finales de pions (Lichess)', url: 'https://lichess.org/training/pawnEndgame', kind: 'lichess' },
    ],
    positions: [
      {
        fen: '6k1/p4pp1/1p5p/8/3K4/8/PP3PPP/8 w - - 0 1',
        caption: 'Pions égaux, mais le roi blanc est au centre et le roi noir enfermé en g8 : Kd5, puis Kc6 attaque b6 et a7, et la finale se gagne.',
        bestSan: 'Kd5',
      },
    ],
    related: ['opposition', 'square-rule', 'passed-pawn', 'rook-endgame', 'piece-activity', 'simplification', 'king-safety'],
  },

  // ---------------- Opening principles ----------------
  {
    id: 'development',
    title: 'Développement',
    category: 'opening',
    aliases: ['development', 'tempo', 'retard de développement', 'avance de développement', 'principes d\'ouverture', 'opening principles'],
    shortDef: 'Sortir ses pièces mineures, roquer et connecter ses tours le plus vite possible. Chaque coup d\'ouverture doit amener une pièce dans le jeu.',
    detail: 'Principes de base : (1) occupe le centre avec des pions (e4 ou d4) ; (2) sors les cavaliers avant les fous ; (3) ne joue pas deux fois la même pièce sans raison ; (4) ne sors pas la dame trop tôt, elle devient une cible ; (5) roque vite, puis connecte les tours. Le tempo est la monnaie de l\'ouverture : un coup de pion inutile ou une pièce déplacée deux fois, c\'est un coup offert à l\'adversaire. Quand l\'adversaire a du retard, ouvre le jeu (rupture centrale, parfois un pion sacrifié) avant qu\'il ne rattrape son retard ; si c\'est toi qui es en retard, n\'ouvre surtout pas le jeu. Illustration culte : la partie de l\'Opéra de Morphy (1858), où les Noirs avancent des pions (...c6, ...b5) pendant que leur roi, leur fou f8 et leurs tours restent à la maison, face à des Blancs qui sortent toutes leurs pièces. Erreur de club : gagner un pion en laissant deux pièces à la maison.',
    links: [
      { label: 'Ouverture (Wikipedia)', url: 'https://fr.wikipedia.org/wiki/Ouverture_(%C3%A9checs)', kind: 'wikipedia' },
      { label: 'Partie de l\'opéra (Wikipedia)', url: 'https://fr.wikipedia.org/wiki/Partie_de_l%27op%C3%A9ra', kind: 'wikipedia' },
    ],
    positions: [
      {
        fen: 'r3kb1r/p2nqppp/5n2/1B2p1B1/4P3/1Q6/PPP2PPP/R3K2R w KQkq - 1 12',
        caption: 'Partie de l\'Opéra (Morphy, 1858) : toutes les pièces mineures blanches sont sorties, alors que le roi noir est toujours au centre, avec son fou f8 et ses tours à la maison. O-O-O achève le développement et place une tour sur la colonne d.',
        bestSan: 'O-O-O',
      },
    ],
    related: ['castling', 'king-safety', 'initiative', 'piece-activity', 'italian', 'pawn-break'],
  },
]
