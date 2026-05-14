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
      { label: 'Practice Lucena (Lichess)', url: 'https://lichess.org/practice/rook-endgames/lucena-and-philidor', kind: 'lichess' },
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
    aliases: ['IQP', 'isolated queen pawn', 'pion isolé'],
    shortDef: 'Pion d sans pion adjacent (c et e absents). Force dynamique en milieu de jeu, faiblesse en finale.',
    detail: '3 plans typiques pour l\'attaquant (qui a l\'IQP) : (1) avancer d4-d5 pour ouvrir le centre ; (2) installer un cavalier en e5 ; (3) attaquer le roque. Pour le défenseur : bloquer le pion (cavalier en d5), forcer les échanges, transposer en finale gagnante. Ouvertures fréquentes : QGD-échange, Sicilienne-anti-IQP, Caro-Kann panov.',
    links: [
      { label: 'Pion isolé (Wikipedia)', url: 'https://fr.wikipedia.org/wiki/Pion_isol%C3%A9', kind: 'wikipedia' },
    ],
    positions: [
      {
        fen: 'r1bq1rk1/pp2bppp/2n1pn2/3p4/3P4/2NBPN2/PP3PPP/R1BQK2R w KQ - 0 1',
        caption: 'Position classique d\'IQP : white a la dynamique, plan d4-d5.',
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
]
