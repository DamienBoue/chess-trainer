# Chess Trainer — Features

Living inventory of what the app does today. Updated at the end of every improvement loop.

## Design principles

- **No backend**. Everything runs in the browser. IndexedDB + localStorage for persistence. The user's data never leaves their device.
- **Self-hosted per user**. Open the page, type your chess.com username, that's it. No accounts, no SaaS.
- **Adapts to your level**. The trainer's recommendations, drill difficulty, and study priority shift based on your declared Elo rating bracket.
- **Bring-your-own LLM (planned)**. If you paste an API key (Anthropic / OpenAI), the trainer can call it to produce prose explanations of your blunders. No key = full functionality, just no prose layer.

## Data sources

- **chess.com public API** — recent games per username (no auth required).
- **PGN bulk import** — paste any PGN(s) to study FIDE / OTB / Lichess games.
- **Lichess Opening Explorer** (community / masters / specific player) — surfaces playable lines in your repertoire.
- **Lichess Tablebase** — perfect play for endgames with ≤ 7 pieces.
- **Stockfish 17 lite WASM** — runs in a Web Worker, no server.

## Today's plan view (entry point)

A 10-15 min curated session synthesising every training signal:
1. Daily puzzle (if not solved today)
2. Up to 5 SRS exercises that are due
3. Up to 5 repertoire SRS cards that are due
4. The single most costly recurring mistake
5. The most-visited repertoire hole

Completion state persists per-day. Deep-links to the relevant view.

## Game analysis

- **Batch analysis** — analyse all unanalyzed games sequentially with progress + cancel.
- **Per-move review** — Stockfish eval (cp, mate), best move, principal variation, classification.
- **Move classification** — `best` / `great` / `good` / `inaccuracy` / `mistake` / `blunder` / `book` based on cpLoss.
- **Eval graph** — interactive scrubbable graph across the game.
- **Threat detector** — highlights immediate threats on the board.
- **Adjustable depth** — 8–22 ply via Settings.

## SRS & drilling

- **Exercises** — auto-extracted from your blunders, scheduled with an SM-2 lite algorithm (1d → 3d → 7d → 14d → 30d → 60d).
- **Puzzle rush** — timed Woodpecker-style burndown over your exercises.
- **Anti-blunder drill** — flash-card reflex test on positions you keep losing.
- **Calculation depth trainer** — step-through a forced sequence one move at a time.
- **Daily puzzle** — deterministic per-day pick + streak tracking.
- **Shared exercise** — deeplink (hash-encoded) to send a single puzzle.

## Repertoire

- **Auto-built tree** from your games — both colors, both opponents.
- **Drill cards (SRS)** — one card per habitual node in your tree.
- **Critiques** — habits that bleed cp loss or win rate.
- **Holes** — positions you visit ≥3 times without a dominant move (you're undecided).
- **Position explorer** — open any repertoire node and drill it interactively.
- **Lichess explorer overlay** — see masters / community / your own moves in the same panel.

## Statistics

- **Aggregate stats** — accuracy, win/loss/draw, by color and by opening.
- **Tendance récente** — 4 cards (cpLoss, blunders/game, win rate, games/week) comparing the latest active week to the previous 4. Dead-zone of ±5%.
- **Motif radar** — your strength across tactical motifs (fork, pin, skewer, discovery, deflection, mate).
- **Recurring mistakes** — same SAN played wrong in same position (exact) or same opening (loose), with cumulative cp loss.
- **Per-phase breakdown** — cpLoss + accuracy split across opening (0–12 plies), middlegame (13–30), endgame (31+).
- **Study recommendations** — auto-derived from weakest motifs / openings.

## Opponents / players

- **Compare with a chess.com friend** — overlap & gaps in openings, accuracy contrast.
- **Scouting** — single-shot lookup against a chess.com opponent.
- **Players PGN library** — bulk-import PGNs (FIDE / OTB), build per-player profiles, cross-compare.

## Library (books)

- **Local book imports** — load chapters and their key positions.
- **Per-position progress** keyed by FEN, same SRS algorithm.
- **Book Rush** — burndown drill over a single book.

## Play

- **Stockfish bot** — full game vs the engine at adjustable Elo (UCI_LimitStrength 1320–3190). Export PGN at the end.

## Adaptive level (Loop 1+)

- **Elo declaration** — user states their current chess.com / FIDE rating; or it's pulled from the most recent analyzed game header.
- **Skill bracket** — `< 1000` / `1000-1400` / `1400-1800` / `1800-2200` / `2200+`. Each bracket gets a different recommended focus.
- **Roadmap module** — for each bracket, a checklist of topics to master (basic tactics → endgame fundamentals → pawn structures → calculation → prophylaxis).

## UX & polish

- **Mobile-friendly** — hamburger nav under 640px, responsive boards.
- **Command palette** (`Cmd/Ctrl+K`) — fuzzy-jump to any view, game, or book.
- **Keyboard shortcuts** — `?` opens the help modal.
- **Breadcrumbs** — for nested views (analysis, book chapter).
- **Toast notifications** — for batch results, save/import outcomes.
- **Onboarding tour** — first-run 5-card walkthrough.
- **Empty states** — every disabled view explains what to do to unlock it.
- **Skeleton loaders** — for lazy chunks and async hydrations.
- **View fade-in** — smooth route transitions.
- **4 board themes** (green / brown / blue / gray).
- **Sound effects** (move, capture, success, wrong) — toggleable.
- **Tap-to-move** (besides drag) — better on mobile, with legal-destination hints.

## Data management

- **IndexedDB-backed** — games, analyses, books, PGN profiles, exercise progress (per book).
- **localStorage** — small state (settings, filters, SRS progress, plan state).
- **Export / import JSON** — full state dump and restore (or merge) via Settings.
- **Lazy migration** — older localStorage keys are promoted to IDB on first read.

## Tech / hosting

- **Vite + React 19 + TypeScript strict**.
- **Tailwind v4**, custom CSS variables.
- **Code-split bundle** — initial chunk ~109 KB gzipped; secondary views lazy-loaded.
- **PWA** — offline cache for the shell.
- **GitHub Pages**-deployable as a static site.

## Planned (next loops)

- Engine PV step-through inline in AnalysisView and on every blunder card.
- Drill-by-motif mode (10 positions where you missed forks, etc.).
- Tactical motif classification of your own blunders (fork-missed, pin-missed, ...).
- Personal annotations per position.
- Annotated PGN export.
- Optional LLM hook (Anthropic / OpenAI) for prose blunder explanations.
- Elo-bracket → curriculum module (full version).
- Reverse-color drill (play the same position from the other side).
- Phase-specific deep dive (which opening eats your endgames?).
