#!/usr/bin/env python3
"""Build a Book JSON from the Lichess puzzle database.

The Lichess puzzle DB is released under CC0 and downloadable from
https://database.lichess.org/lichess_db_puzzle.csv.zst — ~300 MB compressed,
~5 M puzzles, each tagged with themes (fork, pin, mate, endgame, …) and an
Elo-style rating.

Each CSV row:
    PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,OpeningTags

Important quirk: the FIRST move in `Moves` is the OPPONENT's move that LED
to the puzzle position. So the position to show the solver is
"FEN after applying moves[0]"; the remaining moves alternate user → opp.

Usage:
    import_lichess_puzzles.py <csv_or_zst_path> [-o out.json]
        [--max N] [--min-rating N] [--max-rating N] [--theme T]...

If <path> ends in .zst, it's streamed-decompressed (requires `zstandard`).
"""

from __future__ import annotations

import argparse
import csv
import datetime as _dt
import io
import json
import os
import random
import sys

try:
    import chess  # type: ignore
except ImportError:
    sys.stderr.write("python-chess required: pip install python-chess\n")
    sys.exit(2)


def open_csv(path: str):
    if path.endswith('.zst'):
        try:
            import zstandard  # type: ignore
        except ImportError:
            sys.stderr.write("zstandard required for .zst input: pip install zstandard\n")
            sys.exit(2)
        f = open(path, 'rb')
        dctx = zstandard.ZstdDecompressor()
        stream = dctx.stream_reader(f)
        return io.TextIOWrapper(stream, encoding='utf-8')
    return open(path, 'r', encoding='utf-8')


def row_to_exercise(row: dict, n: int) -> dict | None:
    """Transform a Lichess CSV row into a BookExercise dict, or None if
    the puzzle can't be reconstructed."""
    fen = row['FEN']
    raw_moves = row['Moves'].split()
    if not raw_moves:
        return None
    board = chess.Board(fen)
    # Apply the opponent's setup move.
    try:
        setup = board.parse_uci(raw_moves[0])
        board.push(setup)
    except Exception:
        return None
    user_first = board.fen()
    side = 'w' if board.turn else 'b'
    sans: list[str] = []
    for uci in raw_moves[1:]:
        try:
            mv = board.parse_uci(uci)
        except Exception:
            break
        sans.append(board.san(mv))
        board.push(mv)
    if not sans:
        return None
    themes = row.get('Themes', '').strip()
    rating = int(row.get('Rating', '0') or 0)
    return {
        'id': f'lichess-{row["PuzzleId"]}',
        'n': n,
        'fen': user_first,
        'side': side,
        'moves': sans,
        'firstMoveSan': sans[0],
        'chapter': pick_chapter(themes, rating),
        'page': None,
        'solutionProse': f'Lichess #{row["PuzzleId"]} · {rating} elo · {themes}',
    }


def pick_chapter(themes: str, rating: int) -> str:
    """Group puzzles into broad rating bands so the BookView's chapter
    filter does something useful out of the box."""
    if rating < 1200:
        return 'Easy (<1200)'
    if rating < 1600:
        return 'Intermediate (1200-1600)'
    if rating < 2000:
        return 'Hard (1600-2000)'
    return 'Expert (2000+)'


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('csv', help='Lichess puzzle CSV (or .zst)')
    ap.add_argument('-o', '--output', default='lichess-puzzles.book.json')
    ap.add_argument('--max', type=int, default=1000, help='puzzles to emit (default 1000)')
    ap.add_argument('--min-rating', type=int, default=600)
    ap.add_argument('--max-rating', type=int, default=2400)
    ap.add_argument('--theme', action='append', default=[],
                    help='restrict to puzzles tagged with this theme (repeatable)')
    ap.add_argument('--seed', type=int, default=42)
    ap.add_argument('--balanced-bands', action='store_true',
                    help='sample equal numbers from 4 rating bands (default: random across all)')
    args = ap.parse_args()

    rng = random.Random(args.seed)
    rows: list[dict] = []
    with open_csv(args.csv) as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                rating = int(row.get('Rating', '0') or 0)
            except ValueError:
                continue
            if rating < args.min_rating or rating > args.max_rating:
                continue
            if args.theme:
                themes = row.get('Themes', '').split()
                if not any(t in themes for t in args.theme):
                    continue
            rows.append(row)
    print(f'[lichess] {len(rows)} rows pass filters')

    if args.balanced_bands:
        bands = {
            'Easy (<1200)':           [],
            'Intermediate (1200-1600)': [],
            'Hard (1600-2000)':       [],
            'Expert (2000+)':         [],
        }
        for r in rows:
            bands[pick_chapter(r.get('Themes', ''), int(r['Rating']))].append(r)
        per_band = max(1, args.max // 4)
        sampled = []
        for band, items in bands.items():
            rng.shuffle(items)
            sampled.extend(items[:per_band])
        rng.shuffle(sampled)
        rows = sampled
    else:
        rng.shuffle(rows)
        rows = rows[:args.max]

    exercises = []
    for i, row in enumerate(rows, 1):
        ex = row_to_exercise(row, i)
        if ex is not None:
            exercises.append(ex)
    # Re-number after dropping invalid ones.
    for i, e in enumerate(exercises, 1):
        e['n'] = i
        e['id'] = f'lichess-{i:05d}'

    book = {
        'id': 'lichess-puzzles',
        'title': f'Lichess Puzzles ({len(exercises)})',
        'source': 'pdf',
        'importedAt': _dt.datetime.utcnow().replace(microsecond=0).isoformat() + 'Z',
        'exercises': exercises,
    }
    out = args.output
    with open(out, 'w', encoding='utf-8') as f:
        json.dump(book, f, ensure_ascii=False)
    size_kb = os.path.getsize(out) / 1024
    print(f'wrote {len(exercises)} puzzles → {out} ({size_kb:.1f} KB)')


if __name__ == '__main__':
    main()
