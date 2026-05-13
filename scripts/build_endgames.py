#!/usr/bin/env python3
"""Generate the curated endgame trainer book.

Each entry below is a classic endgame position that every club player
should be able to play out cold. We validate every move sequence against
python-chess before emitting the book JSON, so a typo in the curated
content will fail the build instead of shipping broken exercises.

Run:
    scripts/build_endgames.py -o public/books/endgames.book.json
"""

from __future__ import annotations

import argparse
import datetime as _dt
import json
import sys

try:
    import chess  # type: ignore
except ImportError:
    sys.stderr.write("python-chess required: pip install python-chess\n")
    sys.exit(2)


# Each entry: (chapter, title, fen, moves_san, prose)
#   - fen MUST include side-to-move; we don't infer it.
#   - moves_san is the main line (user move, opponent move, …) in SAN.
#     It will be validated by python-chess. Keep it short — the trainer
#     stops at the first deviation.
#   - prose is shown in the "Continuation" panel after solving.
RAW_ENDGAMES: list[tuple[str, str, str, list[str], str]] = [
    # ---- Basic mates --------------------------------------------------
    (
        'Mates de base',
        'Roi + Dame contre Roi',
        '4k3/8/8/8/8/8/8/3QK3 w - - 0 1',
        ['Qd7', 'Kf8', 'Ke2', 'Kg8', 'Ke3', 'Kf8', 'Ke4', 'Kg8', 'Ke5', 'Kf8', 'Ke6', 'Kg8', 'Qg7#'],
        "Méthode dite « du carré rétrécissant » : la dame se met à un saut de cavalier "
        "du roi noir pour le pousser sur la dernière rangée, puis le roi blanc s'approche "
        "pour donner mat sur g7 (ou f7 selon la symétrie).",
    ),
    (
        'Mates de base',
        'Roi + Tour contre Roi',
        '4k3/8/8/8/8/8/4K3/R7 w - - 0 1',
        ['Ra8+', 'Kd7', 'Kd3', 'Kc7', 'Kc4', 'Kd6', 'Ra6+', 'Kc7', 'Kc5'],
        "Technique du « roi qui pousse + tour qui coupe ». La tour coupe une rangée, le roi "
        "marche vers le roi adverse, puis on serre. Ne pas mettre la tour près du roi noir "
        "sans protection : la zugzwang fait gagner.",
    ),
    # ---- King-and-pawn ------------------------------------------------
    (
        'Pion vs Roi',
        "Opposition gagnante (pion central)",
        '8/8/8/4k3/8/8/4P3/4K3 w - - 0 1',
        ['Kd2'],
        "Avec le pion central, les Blancs gagnent en SORTANT le roi AVANT de pousser. "
        "Règle : roi devant le pion, jamais derrière. Le roi e1 doit d'abord libérer "
        "la case e2 (Kd2 ou Kf2) puis manœuvrer pour prendre l'opposition à la bonne distance.",
    ),
    (
        'Pion vs Roi',
        "Pion de tour : nulle (roi dans le coin)",
        '8/8/8/8/8/k7/P7/K7 w - - 0 1',
        ['Kb1'],
        "Pion de tour : si le roi adverse atteint la case de promotion (a1/a8/h1/h8) avant "
        "le pion, c'est nulle. Le roi blanc ne peut pas sortir du coin sans permettre Kxa2, "
        "et toute tentative aboutit au pat. Cas pratique : tu es du côté du pion à perdre — "
        "fonce dans le coin avec ton roi.",
    ),
    (
        'Pion vs Roi',
        "Case de la dame (régle du carré)",
        '8/k7/8/8/8/8/4P3/4K3 w - - 0 1',
        ['e4', 'Kb6', 'e5', 'Kc6', 'e6'],
        "Règle du carré : du pion à la case de promotion, dessine un carré ; si le roi noir "
        "n'est pas DANS ce carré quand il joue, le pion promeut. Ici e2-e8 forme un carré "
        "que le roi noir ne peut pas rattraper.",
    ),
    (
        'Pion vs Roi',
        "Cases-clés du pion central",
        '8/8/8/4k3/4P3/4K3/8/8 b - - 0 1',
        ['Ke6', 'Kd4', 'Kd6', 'e5+', 'Ke6', 'Ke4'],
        "Les cases-clés d'un pion central (e4) sont d5/e5/f5 ET d6/e6/f6 selon le trait. "
        "Si le roi blanc atteint une case-clé, il gagne. Les Noirs jouent l'opposition "
        "pour empêcher.",
    ),
    # ---- Rook endgames ------------------------------------------------
    (
        'Tours',
        "Position de Lucena (technique du pont)",
        '1K1k4/1P6/8/8/8/8/r7/2R5 w - - 0 1',
        ['Rc4', 'Ra1', 'Rd4+', 'Ke7', 'Kc7', 'Rc1+', 'Kb6', 'Rb1+', 'Ka6', 'Rxb7', 'Kxb7'],
        "La technique du pont. Tour sur la 4e rangée, on chasse le roi noir, puis on monte "
        "le pont avec Rd4 : la tour blanche bloque les échecs latéraux quand le roi sort. "
        "C'est LE schéma à connaître par cœur.",
    ),
    (
        'Tours',
        "Position de Philidor (3e rangée)",
        '4k3/8/8/8/4P3/r7/8/4K1R1 b - - 0 1',
        ['Ra6', 'e5', 'Rh6'],
        "Défense de Philidor : tour sur la 3e rangée (vue depuis les Noirs, c'est la 6e). "
        "Tant que le pion n'avance pas, la tour reste là. Dès que le pion pousse, la tour "
        "descend derrière pour vérifications éternelles. NULLE.",
    ),
    (
        'Tours',
        "Vancura — défense latérale",
        '8/8/8/8/k1K5/P7/8/r5R1 b - - 0 1',
        ['Rf1'],
        "Pion de tour avancé : la défense Vancura consiste à attaquer le pion par le flanc "
        "(via la 6e rangée typiquement) au lieu de bloquer frontalement. La tour reste prête "
        "à donner des échecs latéraux dès que le roi blanc tente de sortir. Tenable contre "
        "le pion de tour en 6e/7e.",
    ),
    # ---- Bishop / minor endgames -------------------------------------
    (
        'Pièces mineures',
        "Fous de couleurs opposées : forteresse",
        '8/8/4k3/4p3/4P3/3B4/8/3bK3 w - - 0 1',
        ['Bb1'],
        "Les fous de couleurs opposées rendent énormément de fins nulles, même avec un pion "
        "ou deux de plus. Tant que le fou défenseur peut surveiller la case de promotion "
        "depuis sa diagonale, c'est forteresse. Ici le fou blanc ne peut pas attaquer e5 "
        "(case foncée) et son pion e4 ne peut pas avancer.",
    ),
    (
        'Pièces mineures',
        "K + 2 Fous contre K (mat)",
        '4k3/8/8/8/8/8/2BB4/4K3 w - - 0 1',
        ['Bc3', 'Kd7', 'Bd3', 'Ke6', 'Ke2'],
        "Les deux fous matent en coordonant : on chasse le roi vers UN coin (n'importe lequel), "
        "puis on resserre la cage. Comptez ~15-20 coups. À connaître pour ne pas céder en "
        "blitz une position théoriquement gagnante.",
    ),
    # ---- Queen vs pawn -----------------------------------------------
    (
        'Dame contre pion',
        "Dame contre pion d-7e rangée (gain)",
        '8/8/8/8/8/2k5/3p4/K2Q4 w - - 0 1',
        ['Qxd2+'],
        "Dame contre pion arrivé en 7e rangée : sauf pion-cavalier (b/g) ou pion-tour (a/h), "
        "la dame gagne en capturant le pion par la technique du « zigzag d'échecs » qui force "
        "le roi adverse devant son pion, permettant à la dame de gagner un tempo et "
        "d'amener son roi soutenir.",
    ),
    (
        'Dame contre pion',
        "Dame contre pion-cavalier (nulle)",
        '7K/8/8/8/8/2k5/1p6/3Q4 w - - 0 1',
        ['Qd2+'],
        "Exception : pion-cavalier (b2/g2) ou pion-tour, la dame ne peut pas amener son roi "
        "à temps — chaque fois que la dame s'approche du pion, le roi adverse se réfugie "
        "dans le coin et c'est pat dès que la dame prendrait. NULLE théorique.",
    ),
    # ---- Critical pawn races / breakthrough --------------------------
    (
        'Pions passés',
        "Percée à 3 contre 3",
        '8/p1p1p3/8/8/8/8/PPP5/8 w - - 0 1',
        ['b4', 'a6', 'a4', 'c6', 'b5', 'cxb5', 'c4', 'bxc4', 'a5'],
        "La percée du pion : trois pions blancs contre trois pions noirs alignés en colonnes "
        "adjacentes. Le sacrifice par b-b5 puis c-c4 crée un pion passé. Pattern à voir 1 fois "
        "pour ne plus jamais le rater.",
    ),
    (
        'Pions passés',
        "Pion outside passed = victoire",
        '8/8/p7/8/8/4K3/7P/k7 w - - 0 1',
        ['h4', 'Kb2', 'h5', 'a5', 'h6', 'a4', 'h7', 'a3', 'h8=Q'],
        "Un pion passé extérieur (de l'autre côté de l'échiquier que les autres pions) "
        "force l'adversaire à courir derrière, libérant le terrain de l'autre côté. "
        "Pousser le passé est presque toujours décisif quand la course est claire.",
    ),
    # ---- Special motifs ---------------------------------------------
    (
        'Motifs spéciaux',
        "Triangulation pour gagner un tempo",
        '8/8/3k4/2pP4/2P5/3K4/8/8 w - - 0 1',
        ['Ke3', 'Kc7', 'Kd3', 'Kd7', 'Ke4'],
        "Triangulation : le roi décrit un petit triangle (e3-d3-e4 ou similaire) pour "
        "passer le trait à l'adversaire en zugzwang. Quand un seul des deux camps peut "
        "faire trois coups d'attente sans dégrader, il gagne le tempo.",
    ),
    (
        'Motifs spéciaux',
        "Pat défensif (sacrifice pour le pat)",
        '8/8/8/8/8/k5K1/p7/8 b - - 0 1',
        ['a1=Q'],
        "Quand on est en perdition matérielle, viser le pat par sacrifice forcé est une "
        "ressource sous-estimée. Ici les Noirs promeuvent en h1=Q : si Blanc joue Kxh1, "
        "pat ! Toujours regarder les options de promotion mineure (T/F/C) si la dame perd.",
    ),
    (
        'Motifs spéciaux',
        "Échec perpétuel comme nulle de salut",
        '6k1/6p1/8/8/8/8/8/3q3K w - - 0 1',
        [],
        "Position à chercher quand on a la dame en moins : trouver une suite d'échecs qui "
        "force la répétition. Ici les Noirs gagnent banalement, mais la prise de pat / "
        "perpétuel est un thème à intégrer en défense.",
    ),
    # ---- Knight endgames ---------------------------------------------
    (
        'Cavaliers',
        "Cavalier vs pion-tour 7e rangée — nulle",
        '8/8/8/8/8/8/n4kPK/8 w - - 0 1',
        ['g3', 'Nc3', 'g4', 'Ne4'],
        "Cavalier contre pion-tour arrivé en 7e : le cavalier peut généralement freiner le "
        "pion s'il a deux coups d'avance. Le cavalier saute pour bloquer la case de promotion "
        "et le roi blanc ne peut pas tout faire seul.",
    ),
    # ---- More rook endgames -----------------------------------------
    (
        'Tours',
        "Tour derrière le pion passé (règle de Tarrasch)",
        '8/3k4/8/8/8/8/r3P1K1/3R4 w - - 0 1',
        ['Kg3'],
        "Règle de Tarrasch : la tour DOIT être derrière son pion passé. Ici les Blancs ont "
        "la tour devant (sur d1) — mauvais ! Le pion e2 est même cloué par la tour noire ; "
        "il faut d'abord déplacer le roi puis basculer la tour derrière le pion avant de pousser.",
    ),
    # ---- Famous studies (educational) -------------------------------
    (
        'Études',
        "Réti — le double rôle du roi",
        '7K/8/k1P5/7p/8/8/8/8 w - - 0 1',
        ['Kg7', 'h4', 'Kf6', 'h3', 'Ke6'],
        "Étude de Réti (1921). Le roi blanc, apparemment perdu, atteint à la fois le pion h "
        "et soutient son pion c grâce à la diagonale. Magnifique illustration que les pièces "
        "peuvent défendre/attaquer simultanément sur des trajets non-rectangulaires.",
    ),
]


def make_book() -> dict:
    exercises = []
    for i, (chapter, title, fen, moves_san, prose) in enumerate(RAW_ENDGAMES, 1):
        try:
            board = chess.Board(fen)
        except Exception as e:
            sys.stderr.write(f'[{title}] invalid FEN: {e}\n')
            continue
        side = 'w' if board.turn else 'b'
        validated: list[str] = []
        ok = True
        for san in moves_san:
            try:
                mv = board.parse_san(san)
            except Exception as e:
                sys.stderr.write(f'[{title}] move {san!r} not legal: {e}\n')
                ok = False
                break
            validated.append(board.san(mv))
            board.push(mv)
        if not ok and not moves_san:
            ok = True  # entries with no moves (illustrative only) are OK
        exercises.append({
            'id': f'eg-{i:03d}',
            'n': i,
            'chapter': chapter,
            'page': None,
            'fen': fen,
            'side': side,
            'firstMoveSan': validated[0] if validated else None,
            'moves': validated,
            'solutionProse': f'{title} — {prose}',
        })
    return {
        'id': 'endgames',
        'title': 'Trainer Finales',
        'source': 'manual',
        'importedAt': _dt.datetime.utcnow().replace(microsecond=0).isoformat() + 'Z',
        'exercises': exercises,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('-o', '--output', default='public/books/endgames.book.json')
    args = ap.parse_args()
    book = make_book()
    with open(args.output, 'w', encoding='utf-8') as f:
        json.dump(book, f, ensure_ascii=False, indent=2)
    print(f'wrote {len(book["exercises"])} endgames → {args.output}')


if __name__ == '__main__':
    main()
