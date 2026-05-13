#!/usr/bin/env python3
"""Generic vector-font chess-book importer.

Takes any PDF that renders diagrams via an embedded chess font (Chess-Merida,
Chess Cases, FigurineChessNotation, etc. — any font that maps piece glyphs
into the Unicode Private Use Area at U+F000..U+F8FF) and produces a JSON
book dictionary:

    {
      "id": "<slug>",
      "title": "<doc title or filename>",
      "source": "pdf",
      "importedAt": <iso8601>,
      "exercises": [
        {
          "id": "ex-0001",
          "n": 1,                       # exercise number as printed in the book
          "chapter": "<heading>",
          "page": <pdf-page>,
          "fen": "<FEN with side-to-move>",
          "side": "w" | "b",
          "firstMoveSan": "<SAN>",
          "moves": ["<SAN>", ...],
          "solutionProse": "<text snippet>"
        },
        ...
      ]
    }

Usage:
    import_book.py <input.pdf> [-o output.json]

No interactive prompts, no per-book hardcoding. Auto-detects:
  * the chess font (any PUA-using font on the page)
  * every 10x10 diagram frame on every page
  * the exercise number printed near each diagram
  * the solutions chapter (block of numbered "N. ..." paragraphs that
    contain SAN-looking tokens — usually with figurine notation)
  * the chapter heading the diagram belongs to (nearest "Chapter X" /
    "Easy/Intermediate/Advanced" caption preceding the diagram)
"""

from __future__ import annotations

import argparse
import datetime as _dt
import json
import os
import re
import sys
import unicodedata
from dataclasses import dataclass, field

try:
    import pymupdf  # type: ignore
except ImportError:
    sys.stderr.write("pymupdf required: pip install pymupdf\n")
    sys.exit(2)

try:
    import chess  # type: ignore
except ImportError:
    sys.stderr.write("python-chess required: pip install python-chess\n")
    sys.exit(2)


# ---------- Chess-font glyph → piece mapping --------------------------------
# Convention used by Chess-Merida-style fonts (and most ASCII-mapped chess
# fonts): the LETTER encodes piece+colour, the CASE is the square shading.
#   White: p n b r q k   Black: o m v t w l
# Empty light = space, empty dark = '+'.
PIECE_MAP = {
    'p': 'P', 'P': 'P', 'n': 'N', 'N': 'N',
    'b': 'B', 'B': 'B', 'r': 'R', 'R': 'R',
    'q': 'Q', 'Q': 'Q', 'k': 'K', 'K': 'K',
    'o': 'p', 'O': 'p', 'm': 'n', 'M': 'n',
    'v': 'b', 'V': 'b', 't': 'r', 'T': 'r',
    'w': 'q', 'W': 'q', 'l': 'k', 'L': 'k',
    ' ': '.', '+': '.',
}

# Figurine → SAN, plus a few obvious typesetting substitutions.
FIGURINE_REPL = {
    '¦': 'R', '¥': 'B', '¤': 'N', '£': 'Q', '¢': 'K',     # English-style
    '♔': 'K', '♕': 'Q', '♖': 'R', '♗': 'B', '♘': 'N',     # Unicode chess
    '♚': 'K', '♛': 'Q', '♜': 'R', '♝': 'B', '♞': 'N',
    '†': '+', '‡': '#',
    '–': '-',
}
# French SAN → English SAN (R=Roi/K, D=Dame/Q, T=Tour/R, F=Fou/B, C=Cavalier/N).
# Applied only at clear move-letter positions (start of a SAN token).
FRENCH_PIECE_RE = re.compile(r'(?<![A-Za-z])([RDTFC])(?=[a-h]|[xX]?[a-h]|[1-8])')
FRENCH_MAP = {'R': 'K', 'D': 'Q', 'T': 'R', 'F': 'B', 'C': 'N'}


SAN_TOKEN_RE = re.compile(
    r'(O-O(?:-O)?[+#]?|[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?[+#]?)'
)


# ---------- Helpers ---------------------------------------------------------

def pua_to_ascii(c: str) -> str:
    o = ord(c)
    return chr(o - 0xF000) if 0xF000 <= o <= 0xF0FF else c


def normalize_prose(s: str) -> str:
    """Apply figurine + French → English SAN substitutions on a solution body.
    The result is plain SAN-ish text that python-chess can parse.

    French notation is only applied when the text clearly uses French piece
    letters (D for Dame, F for Fou, T for Tour appear in move position).
    Otherwise R/K/N could be e.g. the "C" in "Carl" — we must not rewrite
    proper names.
    """
    for k, v in FIGURINE_REPL.items():
        s = s.replace(k, v)
    # Detect French notation: are D / F / T used as piece letters at the
    # start of SAN tokens? (Q/B/R don't exist in French SAN.)
    looks_french = bool(re.search(
        r'(?<![A-Za-z])[DFT](?=[a-h]|x[a-h]|[1-8])', s,
    ))
    if looks_french:
        s = FRENCH_PIECE_RE.sub(lambda m: FRENCH_MAP[m.group(1)], s)
    return s


def slugify(s: str) -> str:
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode()
    s = re.sub(r'[^a-zA-Z0-9]+', '-', s).strip('-').lower()
    return s or 'book'


# ---------- Diagram extraction (vector-font detection) ----------------------

@dataclass
class Glyph:
    cx: float
    cy: float
    char: str  # ASCII char (PUA mapped back), or original if not in PUA
    font: str  # font name (for diagnostics)


@dataclass
class Diagram:
    page: int          # 1-based pdf page
    box: tuple         # (tx, ty, bx, by) frame corner centres
    fen_pieces: str    # FEN piece placement only
    exercise_n: int | None = None
    chapter: str | None = None


def is_chess_font(font_name: str) -> bool:
    """Heuristic: chess fonts usually contain the substring 'chess' or are
    well-known chess fonts (Diagram, Figurine, ChessCases). We accept anything
    whose presence pushes PUA chars into the page."""
    n = font_name.lower()
    return any(k in n for k in ('chess', 'diagram', 'figurine', 'chessleip', 'merida'))


def extract_chess_glyphs(page) -> list[Glyph]:
    out: list[Glyph] = []
    raw = page.get_text('rawdict')
    for block in raw['blocks']:
        if block.get('type') != 0:
            continue
        for line in block['lines']:
            for span in line['spans']:
                font = span.get('font', '')
                # Two acceptance paths: name-based, or PUA-heavy span.
                name_match = is_chess_font(font)
                if not name_match:
                    # Quick test: does this span emit PUA chars?
                    if not any(0xF000 <= ord(c['c']) <= 0xF0FF for c in span['chars']):
                        continue
                for ch in span['chars']:
                    bb = ch['bbox']
                    out.append(Glyph(
                        cx=(bb[0] + bb[2]) / 2,
                        cy=(bb[1] + bb[3]) / 2,
                        char=pua_to_ascii(ch['c']),
                        font=font,
                    ))
    return out


def cluster_diagrams(glyphs: list[Glyph]) -> list[tuple[tuple, list[Glyph]]]:
    """Pair top-left ('1') and bottom-right ('9') frame glyphs to find each
    10x10 diagram on the page."""
    tl = [g for g in glyphs if g.char == '1']
    br = [g for g in glyphs if g.char == '9']
    diags = []
    used = set()
    for tg in tl:
        best = None
        for i, bg in enumerate(br):
            if i in used or bg.cx <= tg.cx or bg.cy <= tg.cy:
                continue
            dx, dy = bg.cx - tg.cx, bg.cy - tg.cy
            if 50 < dx < 300 and 50 < dy < 300 and max(dx, dy) / min(dx, dy) < 1.4:
                score = dx + dy
                if best is None or score < best[0]:
                    best = (score, i, bg.cx, bg.cy)
        if best is not None:
            _, i, bx, by = best
            used.add(i)
            inside = [g for g in glyphs
                      if tg.cx - 1 <= g.cx <= bx + 1 and tg.cy - 1 <= g.cy <= by + 1]
            diags.append(((tg.cx, tg.cy, bx, by), inside))
    # Column-major: snap x to nearest 50pt band, then sort by (col, y).
    diags.sort(key=lambda d: (round(d[0][0] / 50) * 50, d[0][1]))
    return diags


def diagram_to_fen(box, inside_glyphs) -> str:
    tx, ty, bx, by = box
    cw = (bx - tx) / 9.0
    ch = (by - ty) / 9.0
    grid = [['.' for _ in range(8)] for _ in range(8)]
    for g in inside_glyphs:
        col = round((g.cx - tx) / cw)
        row = round((g.cy - ty) / ch)
        if not (1 <= col <= 8 and 1 <= row <= 8):
            continue
        piece = PIECE_MAP.get(g.char)
        if piece in (None, '.'):
            continue
        grid[row - 1][col - 1] = piece
    rows = []
    for row in grid:
        s, e = '', 0
        for c in row:
            if c == '.':
                e += 1
            else:
                if e:
                    s += str(e); e = 0
                s += c
        if e:
            s += str(e)
        rows.append(s)
    return '/'.join(rows)


# ---------- Exercise-number labelling ---------------------------------------

NUMBER_TEXT_RE = re.compile(r'^\s*(\d{1,4})\s*$')


def label_diagram_numbers(page, diagrams: list[Diagram]) -> None:
    """Attach an exercise number to each diagram by looking at standalone
    digit text blocks placed inside (or just outside) the frame."""
    if not diagrams:
        return
    # Collect candidate (n, x, y) triples from non-chess-font text.
    # Use the simpler 'blocks' API: it gives one entry per laid-out text
    # block with its bbox + concatenated text. Pure-numeric blocks are the
    # exercise labels we want.
    candidates: list[tuple[int, float, float]] = []
    for block in page.get_text('blocks'):
        text = block[4].strip()
        m = NUMBER_TEXT_RE.match(text)
        if not m:
            continue
        n = int(m.group(1))
        bbox = block[:4]
        cx = (bbox[0] + bbox[2]) / 2
        cy = (bbox[1] + bbox[3]) / 2
        candidates.append((n, cx, cy))

    for d in diagrams:
        tx, ty, bx, by = d.box
        frame_w = bx - tx
        # Books place the exercise number in the margin LEFT of the frame
        # (within ~one cell's width) or sometimes inside the frame near the
        # top-left corner. Be more generous on the left/top than right/bottom.
        margin_x = frame_w * 0.25
        best = None
        for n, cx, cy in candidates:
            in_horiz = tx - margin_x <= cx <= bx + 5
            in_vert = ty - margin_x <= cy <= by + 5
            if not (in_horiz and in_vert):
                continue
            score = abs(cx - tx) + abs(cy - ty)
            if best is None or score < best[0]:
                best = (score, n)
        if best is not None:
            d.exercise_n = best[1]


def label_chapter(page, diagrams: list[Diagram], known_chapters: list[str]) -> None:
    """Pick up a chapter heading printed at the top of the page (e.g.
    'Chapter 1 — Easy Exercises') and apply it to every diagram on this page.

    We keep a running list of seen chapters so the FIRST page of a chapter
    sets the chapter for itself AND all subsequent pages until a new heading
    is detected.
    """
    text = page.get_text('text')
    heading = None
    for line in text.split('\n'):
        s = line.strip()
        if not s:
            continue
        # Common heading patterns.
        m = re.match(r'(?i)^(chapter\s+\d+|chapitre\s+\d+|partie\s+\d+|level\s+\w+|niveau\s+\w+)\b\s*[:\-—]?\s*(.*)$', s)
        if m:
            heading = m.group(0).strip()
            break
    if heading:
        known_chapters.append(heading)
    cur = known_chapters[-1] if known_chapters else None
    if cur:
        for d in diagrams:
            d.chapter = cur


# ---------- Solutions section parsing ---------------------------------------

# A "solution" entry starts with "N." at the beginning of a line, often
# followed by player names + year (in tactics books), or by SAN tokens
# directly (in studies/endgame books). Be permissive.
SOLUTION_HEAD_RE = re.compile(r'^\s*(\d{1,4})\.\s*(.+)$')


def parse_solutions_from_text(full_text: str) -> dict[int, str]:
    """Return {exercise_n: solution_prose}. We accept ANY line of the form
    'N. ...' as the START of a solution, as long as the following block
    contains at least one SAN-looking token before the next 'M. ...' header.
    """
    lines = full_text.split('\n')
    out: dict[int, str] = {}
    cur_n: int | None = None
    cur_buf: list[str] = []

    def flush():
        nonlocal cur_n, cur_buf
        if cur_n is None:
            return
        body = '\n'.join(cur_buf).strip()
        # Reject if no SAN-looking content (kills false positives like footnote refs).
        if SAN_TOKEN_RE.search(normalize_prose(body)):
            # Keep the longest body if we re-see the same number (rare).
            if cur_n not in out or len(body) > len(out[cur_n]):
                out[cur_n] = body
        cur_n = None
        cur_buf = []

    for line in lines:
        m = SOLUTION_HEAD_RE.match(line)
        if m:
            n = int(m.group(1))
            tail = m.group(2)
            # A real solution header almost always carries either:
            #   1. a 4-digit year (chess game annotations) OR
            #   2. an en/em-dash separating two player names "Name – Name".
            # A bare "12.Ng5" line in the middle of prose is NOT a header
            # (no year, no dash, just SAN moves on a continuation line).
            has_year = re.search(r'\b(1[5-9]|20)\d{2}\b', tail)
            has_dash = re.search(r'\s[–—-]\s', tail)
            looks_like_header = bool(has_year or has_dash)
            if looks_like_header:
                flush()
                cur_n = n
                cur_buf = [tail]
                continue
        if cur_n is not None:
            cur_buf.append(line)
    flush()
    return out


def first_move_info(prose: str) -> tuple[str | None, str | None]:
    s = normalize_prose(prose)
    m = re.search(r'(\d+)(\.\.\.|\.)', s)
    if not m:
        # Some study books skip move numbers entirely. Default to white.
        m2 = SAN_TOKEN_RE.search(s)
        return (m2.group(1) if m2 else None), 'w' if m2 else None
    side = 'b' if m.group(2) == '...' else 'w'
    after = s[m.end():]
    m2 = SAN_TOKEN_RE.search(after)
    return (m2.group(1) if m2 else None), side


def extract_main_line(prose: str, fen: str) -> list[str]:
    s = normalize_prose(prose)
    anchor = re.search(r'\d+\.{1,3}', s)
    if anchor:
        s = s[anchor.end():]
    # Stop at clear line-ending markers.
    end_m = re.search(r'\b(mate|0-1|1-0|1/2-1/2)\b', s)
    if end_m:
        s = s[:end_m.end()]
    # Strip remaining move-number markers.
    s = re.sub(r'\b\d+\.{1,3}', ' ', s)
    tokens = SAN_TOKEN_RE.findall(s)[:40]
    try:
        board = chess.Board(fen)
    except Exception:
        return []
    line: list[str] = []
    started = False
    for tok in tokens:
        try:
            mv = board.parse_san(tok)
        except Exception:
            if started:
                break
            continue
        line.append(board.san(mv))
        board.push(mv)
        started = True
    return line


# ---------- Pipeline --------------------------------------------------------

def import_pdf(path: str) -> dict:
    doc = pymupdf.open(path)
    title = doc.metadata.get('title') or os.path.splitext(os.path.basename(path))[0]

    # Pass 1: collect diagrams across all pages.
    all_diagrams: list[Diagram] = []
    known_chapters: list[str] = []
    for pno in range(len(doc)):
        page = doc[pno]
        glyphs = extract_chess_glyphs(page)
        clusters = cluster_diagrams(glyphs)
        page_diags = [
            Diagram(page=pno + 1, box=box, fen_pieces=diagram_to_fen(box, inside))
            for box, inside in clusters
        ]
        label_chapter(page, page_diags, known_chapters)
        label_diagram_numbers(page, page_diags)
        all_diagrams.extend(page_diags)

    # Pass 2: parse solutions from the full document text.
    full_text = ''
    for pno in range(len(doc)):
        full_text += doc[pno].get_text('text') + '\n'
    solutions = parse_solutions_from_text(full_text)

    # Pass 3: book-vs-intro filter.
    # A "real" exercise has a numeric label next to its diagram and lives on a
    # page with several other numbered diagrams (book exercise layout). Intro /
    # example diagrams from front-matter usually have no label or are alone on
    # their page. We keep only diagrams that pass either gate.
    by_page: dict[int, list[Diagram]] = {}
    for d in all_diagrams:
        by_page.setdefault(d.page, []).append(d)

    numbered = [d for d in all_diagrams if d.exercise_n is not None]
    # If we never saw a single printed number (study books, etc.) fall back to
    # an implicit column-major sequence so we still produce something useful.
    if not numbered:
        for i, d in enumerate(all_diagrams, 1):
            d.exercise_n = i
        numbered = all_diagrams
    else:
        # Otherwise drop diagrams that lack a printed number AND happen on a
        # page with fewer than 2 numbered siblings (almost certainly intro art).
        kept: list[Diagram] = []
        for d in all_diagrams:
            if d.exercise_n is not None:
                kept.append(d)
                continue
            same_page_numbered = sum(
                1 for o in by_page.get(d.page, []) if o.exercise_n is not None
            )
            if same_page_numbered >= 2:
                # Likely a real exercise where the label OCR missed; skip it
                # rather than guessing a wrong number.
                continue
        all_diagrams = kept

    # Build the exercise objects.
    exercises = []
    for d in sorted(all_diagrams, key=lambda x: (x.exercise_n or 0)):
        n = d.exercise_n or 0
        prose = solutions.get(n, '')
        san, side = first_move_info(prose) if prose else (None, 'w')
        fen = d.fen_pieces + f' {side or "w"} - - 0 1'
        moves = extract_main_line(prose, fen) if prose else []
        exercises.append({
            'id': f'ex-{n:04d}',
            'n': n,
            'chapter': d.chapter or '',
            'page': d.page,
            'fen': fen,
            'side': side or 'w',
            'firstMoveSan': san,
            'moves': moves,
            'solutionProse': normalize_prose(prose)[:300] if prose else '',
        })

    return {
        'id': slugify(title),
        'title': title,
        'source': 'pdf',
        'importedAt': _dt.datetime.utcnow().replace(microsecond=0).isoformat() + 'Z',
        'exercises': exercises,
    }


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('pdf', help='input PDF path')
    ap.add_argument('-o', '--output', help='output JSON path (default: <slug>.json)')
    args = ap.parse_args()

    book = import_pdf(args.pdf)
    out = args.output or f'{book["id"]}.json'
    with open(out, 'w', encoding='utf-8') as f:
        json.dump(book, f, ensure_ascii=False)

    # Brief report.
    total = len(book['exercises'])
    with_moves = sum(1 for e in book['exercises'] if e['moves'])
    with_san = sum(1 for e in book['exercises'] if e['firstMoveSan'])
    print(f'{book["title"]!r} → {out}')
    print(f'  {total} exercises  ·  {with_san} with first move  ·  {with_moves} with full line')


if __name__ == '__main__':
    main()
