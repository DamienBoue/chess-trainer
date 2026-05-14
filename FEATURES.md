# Chess Trainer — Features

Living inventory of what the app does today. Updated at the end of every improvement loop.

## Design principles

- **No backend**. Everything runs in the browser. IndexedDB + localStorage for persistence. The user's data never leaves their device.
- **Self-hosted per user**. Open the page, type your chess.com username, that's it. No accounts, no SaaS.
- **Adapts to your level**. The trainer's recommendations, drill difficulty, and study priority shift based on your declared Elo rating bracket.
- **Bring-your-own LLM**. Paste an Anthropic or OpenAI API key in Settings; the trainer calls it directly from the browser (no proxy, no backend). Used today to produce a prose explanation of a blunder right next to the engine's PV. No key = full functionality, just no prose layer.

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
4. **Drill by motif** — your worst-performing motif (e.g. forks missed) when miss-rate ≥ 50% and ≥ 3 missed.
5. **Phase focus** — when one phase (opening/middle/endgame) is ≥ 1.5× worse than another, surface it as a deep-link to Stats.
6. The single most costly recurring mistake
7. The most-visited repertoire hole

**Adaptive ordering**: items are reranked based on your skill bracket — beginners get tactics-heavy priority, experts get opening prep priority. Completion state persists per-day. Deep-links to the relevant view.

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
- **Strengths panel** — positive counterpart to weaknesses: precision vs opponents, mastered motifs, best-performing opening, strongest phase. Up to 3 lines, each one quotes a concrete number.
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

## Adaptive level

- **Elo declaration** — user states their current chess.com / FIDE rating; or it's pulled from the median user rating of recent analyzed games.
- **Skill bracket** — `< 1000` / `1000-1400` / `1400-1800` / `1800-2100` / `2100-2300` / `2300+`. Each bracket gets a different recommended focus.
- **Roadmap module** — for each bracket, a checklist of priority topics (tactics → endgame fundamentals → pawn structures → calculation → prophylaxis), each with a deep-link to the relevant tool.
- **Bracket suggestion** — when declared Elo and the median inferred Elo disagree by ≥ 100 points across brackets, the Roadmap view surfaces a one-click "Mettre à jour" suggestion (promotion or demotion).
- **Adaptive plan** — buildPlan reranks items based on the active bracket (beginners: tactics-heavy; experts: opening-prep-heavy).

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
- **localStorage** — small state (settings, filters, SRS progress, plan state, notes, roadmap, LLM config, Elo).
- **Export / import JSON** — full state dump and restore (or merge) via Settings.
- **Export PGN annoté** — from AnalysisView, downloads the game with NAG glyphs (`?`, `??`, `!?`) + engine-best comments. Compatible with Lichess study upload, ChessBase, Scid.
- **Lazy migration** — older localStorage keys are promoted to IDB on first read.

## Tech / hosting

- **Vite + React 19 + TypeScript strict**.
- **Tailwind v4**, custom CSS variables.
- **Code-split bundle** — initial chunk ~109 KB gzipped; secondary views lazy-loaded.
- **PWA** — offline cache for the shell.
- **GitHub Pages**-deployable as a static site.

## Personal annotations

- **Per-position notes** keyed by truncated FEN. The same position reached in any future game shares the note.
- Editor lives in AnalysisView's detail panel and inside the PositionExplorer modal — no separate view.
- Included automatically in the Export JSON.

## LLM coach (optional)

- **BYO key** — Anthropic (`sk-ant-…`) or OpenAI (`sk-…`). Stored in localStorage, sent only to the provider.
- **Direct browser calls** — uses `anthropic-dangerous-direct-browser-access` and OpenAI's CORS-enabled chat endpoint; no proxy.
- **"Expliquer ce coup"** — in AnalysisView's detail panel, on every blunder or mistake. The prompt includes FEN, played move, classification, cpLoss, engine best, and engine PV. The coach answers in 3-5 short sentences naming the motif.
- **Plan cadrage** — on the Plan du jour, a "✨ Demander à l'IA un cadrage" button asks the coach to frame today's session: one priority axis (justified for the player's bracket) + one mini-rule of attitude.
- **Revue de partie** — on AnalysisView, a "✨ Revue complète" button asks for a 4-6 sentence coach review of the whole game (phase where you suffered, critical moment, one concrete training axis for next time).

## Planned (next loops)

- Reverse-color drill (play the same position from the other side).
- Phase-specific deep dive (which opening eats your endgames?).
- LLM-driven plan summary / weekly recap email-style.
- Auto-fill the bracket via chess.com rating header on first import (currently uses median user rating across recent analyses).
