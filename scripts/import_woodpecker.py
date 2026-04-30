#!/usr/bin/env python3
"""Full pipeline: decode all Woodpecker exercises + match with solutions.

Outputs a JSON of {id, fen, sideToMove, solution, source} suitable for the
chess-trainer app.
"""

import json
import re
import sys
import pymupdf

PIECE_MAP = {
    'p': 'P', 'P': 'P',
    'n': 'N', 'N': 'N',
    'b': 'B', 'B': 'B',
    'r': 'R', 'R': 'R',
    'q': 'Q', 'Q': 'Q',
    'k': 'K', 'K': 'K',
    'o': 'p', 'O': 'p',
    'm': 'n', 'M': 'n',
    'v': 'b', 'V': 'b',
    't': 'r', 'T': 'r',
    'w': 'q', 'W': 'q',
    'l': 'k', 'L': 'k',
    ' ': '.', '+': '.',
}

# Figurine → SAN piece letter (used in solutions section).
FIGURINE = {
    '¦': 'R', '¥': 'B', '¤': 'N', '£': 'Q', '¢': 'K',
    # Sometimes typeset variations:
    'R': 'R', 'B': 'B', 'N': 'N', 'Q': 'Q', 'K': 'K',
}

CHAPTERS = [
    # (name, diagrams_first, diagrams_last, solutions_first, solutions_last)
    ('easy',         31,  68, 224, 246),
    ('intermediate', 69, 196, 248, 344),
    ('advanced',    197, 222, 346, 379),
]


def pua_to_ascii(c: str) -> str:
    o = ord(c)
    return chr(o - 0xF000) if 0xF000 <= o <= 0xF0FF else c


def extract_chess_glyphs(page):
    glyphs = []
    raw = page.get_text('rawdict')
    for block in raw['blocks']:
        if block.get('type') != 0:
            continue
        for line in block['lines']:
            for span in line['spans']:
                font = span.get('font', '')
                if 'Chess' not in font:
                    continue
                for ch in span['chars']:
                    bb = ch['bbox']
                    cx = (bb[0] + bb[2]) / 2
                    cy = (bb[1] + bb[3]) / 2
                    glyphs.append((cx, cy, pua_to_ascii(ch['c'])))
    return glyphs


def cluster_diagrams(glyphs):
    tl = [g for g in glyphs if g[2] == '1']
    br = [g for g in glyphs if g[2] == '9']
    diagrams = []
    used = set()
    for tx, ty, _ in tl:
        best = None
        for i, (bx, by, _) in enumerate(br):
            if i in used or bx <= tx or by <= ty:
                continue
            dx, dy = bx - tx, by - ty
            if 50 < dx < 250 and 50 < dy < 250 and max(dx, dy) / min(dx, dy) < 1.4:
                score = dx + dy
                if best is None or score < best[0]:
                    best = (score, i, bx, by)
        if best is not None:
            _, i, bx, by = best
            used.add(i)
            in_box = [g for g in glyphs if tx - 1 <= g[0] <= bx + 1 and ty - 1 <= g[1] <= by + 1]
            diagrams.append(((tx, ty, bx, by), in_box))
    # Books like Woodpecker number column-by-column: read down column 1 then
    # down column 2. Snap x to nearest column band (~50 pt resolution) and
    # sort by (column, y).
    diagrams.sort(key=lambda d: (round(d[0][0] / 50) * 50, d[0][1]))
    return diagrams


def diagram_to_fen(box, in_box):
    tx, ty, bx, by = box
    cw = (bx - tx) / 9.0
    ch = (by - ty) / 9.0
    grid = [['.' for _ in range(8)] for _ in range(8)]
    for gx, gy, char in in_box:
        c = round((gx - tx) / cw)
        r = round((gy - ty) / ch)
        if not (1 <= c <= 8 and 1 <= r <= 8):
            continue
        piece = PIECE_MAP.get(char)
        if piece is None or piece == '.':
            continue
        grid[r - 1][c - 1] = piece
    out = []
    for row in grid:
        s = ''
        e = 0
        for ch in row:
            if ch == '.':
                e += 1
            else:
                if e:
                    s += str(e); e = 0
                s += ch
        if e:
            s += str(e)
        out.append(s)
    return '/'.join(out)


def decode_chapter_diagrams(doc, first, last):
    """Returns list of FENs in book order."""
    out = []
    for pno in range(first - 1, last):
        page = doc[pno]
        glyphs = extract_chess_glyphs(page)
        diags = cluster_diagrams(glyphs)
        for box, in_box in diags:
            fen = diagram_to_fen(box, in_box)
            out.append({'page': pno + 1, 'fen': fen})
    return out


SOLUTION_HEAD = re.compile(r'^\s*(\d+)\.\s+(.+?)\s*$')


def parse_solutions(doc, first, last):
    """Returns list of {n, title, body} for each numbered solution."""
    text = ''
    for pno in range(first - 1, last):
        text += doc[pno].get_text('text')
    # Solutions start with "N. Title" then "moves and prose"
    lines = text.split('\n')
    solutions: dict = {}
    cur_n = None
    cur_buf = []
    # Title pattern: "N. Player – Player, Venue YEAR"
    # Allow internal dots ("J. Wilson"), require an en-dash and a year.
    title_re = re.compile(r'^(\d+)\.\s+([A-Z].*?[–\-].*?\b(1[5-9]|20)\d{2}\b.*)$')
    for line in lines:
        m = title_re.match(line.strip())
        if m:
            if cur_n is not None:
                solutions[cur_n] = '\n'.join(cur_buf).strip()
            cur_n = int(m.group(1))
            cur_buf = [m.group(2)]
        else:
            if cur_n is not None:
                cur_buf.append(line)
    if cur_n is not None:
        solutions[cur_n] = '\n'.join(cur_buf).strip()
    return solutions


def normalize_solution_text(s: str) -> str:
    """Turn figurine-notation prose into plain SAN text. Just substitute
    figurines and unicode dashes — leave SAN parsing to the trainer side."""
    repl = {
        '¦': 'R', '¥': 'B', '¤': 'N', '£': 'Q', '¢': 'K',
        '†': '+', '‡': '#',
        '–': '-', '‚': ',',
    }
    for k, v in repl.items():
        s = s.replace(k, v)
    return s


def first_move_info(sol_text: str):
    """Side-to-move is determined by the first move number in the prose:
    'N.' = white to move, 'N...' = black to move.
    """
    s = normalize_solution_text(sol_text)
    m = re.search(r'(\d+)(\.\.\.|\.)', s)
    if not m:
        return None, None
    side = 'b' if m.group(2) == '...' else 'w'
    after = s[m.end():]
    m2 = re.match(r'\s*([A-Za-z][A-Za-z0-9+#=\-]{1,7}!?\??)', after)
    return (m2.group(1) if m2 else None), side


SAN_TOKEN_RE = re.compile(
    r'(O-O(?:-O)?[+#]?|[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?[+#]?)'
)


def extract_main_line(sol_text: str, fen: str):
    """Walk the solution prose and apply moves on a real board.

    Order matters here:
      1. Anchor at the FIRST move-number marker so prose intro ("forced mate:")
         doesn't trip the end-marker scan.
      2. Apply the end marker (mate / 0-1 / etc.) AFTER the anchor so it cuts
         the main line at its actual conclusion, not in the introduction.
      3. Skip leading non-applicable tokens (false positives like "d6" in
         "bishop on d6"); once a real move is played, the first failure ends
         the line.
    """
    import chess
    s = normalize_solution_text(sol_text)
    anchor = re.search(r'\d+\.{1,3}', s)
    if not anchor:
        return []
    main = s[anchor.end():]
    end_pat = re.compile(r'\b(mate|0-1|1-0|1/2-1/2)\b')
    m = end_pat.search(main)
    if m:
        main = main[:m.end()]
    main = re.sub(r'\b\d+\.{1,3}', ' ', main)
    candidates = SAN_TOKEN_RE.findall(main)[:30]
    try:
        board = chess.Board(fen)
    except Exception:
        return []
    moves = []
    started = False
    for san in candidates:
        try:
            mv = board.parse_san(san)
        except Exception:
            if started:
                break
            continue
        moves.append(board.san(mv))
        board.push(mv)
        started = True
    return moves


def main():
    pdf = sys.argv[1] if len(sys.argv) > 1 else \
        '/Users/damienboue/Documents/perso/chess books/The Woodpecker method.pdf'
    doc = pymupdf.open(pdf)

    # Diagrams chapter by chapter (so we know book section per exercise),
    # but solutions are GLOBAL (numbered 1..1128 across all solution chapters).
    chapter_diagrams = []
    for name, df, dl, _, _ in CHAPTERS:
        diags = decode_chapter_diagrams(doc, df, dl)
        chapter_diagrams.append((name, diags))

    # Parse all solution pages as one stream so global numbering is preserved.
    # Solutions span 224-380 (last solution #1128 starts on page 380).
    all_solutions = parse_solutions(doc, 224, 380)
    print(f'parsed solutions: {len(all_solutions)}  (max #: {max(all_solutions) if all_solutions else 0})')

    all_exercises = []
    global_n = 0
    for name, diagrams in chapter_diagrams:
        print(f'[{name}] diagrams={len(diagrams)}')
        for d in diagrams:
            global_n += 1
            sol = all_solutions.get(global_n, '')
            san, side = first_move_info(sol)
            full_fen = d['fen'] + f" {side or 'w'} - - 0 1"
            line = extract_main_line(sol, full_fen)
            all_exercises.append({
                'id': f'wp-{global_n:04d}',
                'chapter': name,
                'number': global_n,
                'page': d['page'],
                'fen': full_fen,
                'sideToMove': side,
                'firstMoveSan': san,
                'mainLine': line,                    # SAN sequence playable on board
                'solution': normalize_solution_text(sol),
            })

    out_path = '/tmp/woodpecker.json'
    with open(out_path, 'w') as f:
        json.dump(all_exercises, f, ensure_ascii=False, indent=2)
    print(f'\nWrote {len(all_exercises)} exercises → {out_path}')

    n_with_side = sum(1 for e in all_exercises if e['sideToMove'])
    n_with_san = sum(1 for e in all_exercises if e['firstMoveSan'])
    n_with_line = sum(1 for e in all_exercises if e['mainLine'])
    avg_line = sum(len(e['mainLine']) for e in all_exercises) / max(1, n_with_line)
    print(f'  with side-to-move : {n_with_side}/{len(all_exercises)}')
    print(f'  with first SAN   : {n_with_san}/{len(all_exercises)}')
    print(f'  with main line   : {n_with_line}/{len(all_exercises)}  (avg {avg_line:.1f} plies)')


if __name__ == '__main__':
    main()
