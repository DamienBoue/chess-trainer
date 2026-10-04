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

## Navigation

Five entries, each answering one question (benchmark: Lichess 6, chess.com 7, En Croissant 5):
Five parts, as in the chess.com and Lichess apps: **Aujourd'hui** (what do I do now?) · **Parties** (analyse my games) · **Entraînement** (drills from your errors, daily puzzle, strategy quizzes, play the engine) · **Théorie** (openings, pawn structures, concepts, books, opponent prep) · **Progrès** (level, stats, strategic profile, compare).
One model (`components/navModel.ts`) feeds the mobile tab bar, the desktop header, the **hub pages**, the "up" links and the command palette, so a page's title is always its menu label. Each part with several tools opens a **hub page** (`#/entrainement`, `#/theorie`, `#/progres`): cards with what each tool does, its live status ("14 à revoir"), what it needs when unavailable ("Analyse au moins 3 parties (1/3)") and an **"À faire maintenant"** card on top. Phones (designed first): a **bottom tab bar** with the five parts (due badge on Entraînement), a sticky **top bar** with the way up ("‹ Entraînement", "‹ Parties") or the part's name, the **colour / time-control filter as a chip** opening a sheet, search and an account sheet; the analysis is a full-screen board task with its own pinned move bar instead of the tab bar. Desktop: the same five entries as dropdowns (each starting with "Vue d'ensemble"), the filter row, and a breadcrumb trail (Théorie › Bibliothèque › Livre).
**URLs per screen** (`components/route.ts`): `#/parties`, `#/strategie/structures`, `#/partie/live-123456789?coup=24&onglet=strategie`… — browser back/forward work, any screen (down to the move and the analysis tab) can be linked, and a reload keeps you where you were. Moving between screens adds a history entry; stepping through moves only updates the current one. Entries that need data say why and show progress ("Analyse au moins 3 parties (1/3)"). Header utilities: visible **Rechercher ⌘K** button, settings, and an account menu (shortcuts, source code, change account) — clicking the username no longer logs you out.

## Today's plan view (entry point)

Three one-click tiles on top: **Dernière partie** (review it), **À réviser** (due exercises), **Point faible n°1** (weakest phase → strategic profile).

A 10-15 min curated session synthesising every training signal:
1. Daily puzzle (if not solved today)
2. Up to 5 SRS exercises that are due
3. Up to 5 repertoire SRS cards that are due
4. **Drill by motif** — your worst-performing motif (e.g. forks missed) when miss-rate ≥ 50% and ≥ 3 missed.
5. **Phase focus** — when one phase (opening/middle/endgame) is ≥ 1.5× worse than another, surface it as a deep-link to Stats.
6. The single most costly recurring mistake
7. The most-visited repertoire hole
8. **Lecture de position** — a strategy-trainer session built from your games (boosted from club level up).

**Adaptive ordering**: items are reranked based on your skill bracket — beginners get tactics-heavy priority, experts get opening prep priority. Completion state persists per-day. Deep-links to the relevant view.

Plan also has a second tab **Mon niveau** with the Elo declaration + roadmap modules (see "Adaptive level" below). The page header carries the bracket badge, the streak indicator, and a logout link.

## Game analysis

- **Layout** — sticky board with eval bar, controls and eval graph underneath; on the right an always-visible **verdict strip** (move, classification, engine alternative, "Moment clé suivant"), the compact move list (`1. e4 c5 2. Nf3…` with `?!` `?` `??` glyphs, auto-scroll), then 4 tabs: **Bilan** · **Coup** · **Stratégie** · **Ouverture** (inactive tabs are not mounted: no Lichess request or strategic overlay off-screen).
- **Keyboard** — ← → move, ↑ ↓ start/end, **N** / **Maj+N** next/previous key moment (your errors + strategic moments), **A** engine arrow, **B C S O** tabs, **F** flip, **Échap** leave the engine line. Shortcuts are ignored while typing a note.
- **Engine arrow** — green arrow of Stockfish's best move in the displayed position (toggle `A` / "➚ moteur", remembered).
- **Revoir mes erreurs** (Lichess "Learn from your mistakes") — from the Bilan tab, replay each of your mistakes/blunders and strategic misses from the decision point: play a move on the board; the engine move is accepted at once, other moves are checked by Stockfish (full strength) and accepted within 5 % of winning chances if they also beat your game move. Progressive hints (the strategic plan the engine was starting, or the tactical motif, then the piece to move), "Voir la solution" with the engine line, the plan and what your game move damaged, and an end-of-review summary (first try / with help / missed).
- **Eval graph markers** — dots for every inaccuracy / mistake / blunder (yours bold, the opponent's dimmed, tooltip with the move and the cp lost), markers for key moments, zero line; click to jump.
- **Batch analysis** — analyse all unanalyzed games sequentially with progress + cancel.
- **Per-move review** — Stockfish eval (cp, mate), best move, principal variation, classification.
- **Move classification** — `best` / `great` / `good` / `inaccuracy` / `mistake` / `blunder` / `book` based on cpLoss. Negative classes use colour-blind-safer hues (Okabe-Ito blue / orange / vermilion) plus glyphs.
- **Eval graph** — interactive scrubbable graph across the game.
- **Threat detector** — highlights immediate threats on the board.
- **Adjustable depth** — 8–22 ply via Settings.

## Strategy (positional analysis)

A deterministic positional engine (`src/strategy/`, no LLM, ~0.15 ms per position) that reads any position like a coach would. Definitions follow Stockfish's classical evaluation (isolated / backward / passed pawns, outposts, space, bad bishop, king shelter) and the plans follow Flores Rios (*Chess Structures*), Nimzowitsch and Silman.

- **Pawn structure** — isolated, doubled, backward, passed (protected, outside, candidate), islands, majorities, chains (base/head, direction), levers.
- **Squares** — holes, weak squares (with why: near the king, blockade square, enemy pawn support, no minor piece left to contest), **outposts** with the shortest knight route to reach them, weak colour complexes.
- **Centre** — closed / fixed / tension / mobile / open / semi-open / forming, with what each implies.
- **Pawn breaks — "when to break the centre"** — every lever with its role (attacks the base/head of the chain, contests a mobile centre…), a **timing verdict** (le moment / à préparer) with explicit pros and cons (development, king safety, support count, bishop pair) and the **structural consequence** of the pawn trade ("après l'échange, ton pion d4 deviendrait isolé"). A preparatory move is suggested when the break isn't ready (Italian: c3 before d4). Breaks that weaken your own king, drop the support of an attacked pawn, give up a key square of your structure or trade the opponent's weak pawn are filtered out.
- **23 named structures**, recognised in both colour orientations (the Caro-Kann Exchange is a reversed Carlsbad): IQP, hanging pawns, Panov c5-d4, Carlsbad, Slav, Caro-Kann, London/Colle triangle, Nimzo doubled c-pawns, big mobile centre, Maróczy, Hedgehog, Scheveningen, Boleslavsky hole, Najdorf d5 chain, Dragon, French (advance, type I, type II), KID closed centre, Benoni (modern, symmetric), Stonewall, 3-3 vs 4-2 majorities — each with the textbook plans of **both** sides, thematic breaks and key squares.
- **Pieces & king** — good/bad bishop (central fixed pawns, "bad but active" outside its chain), bishop pair, opposite-coloured bishops, rim knights, rooks on open/half-open files and the 7th, Tarrasch rule, worst piece, king safety (shelter, open files, storms, attackers; central kings judged on castling rights), development, space (Stockfish formula), material imbalance, rule of the square.
- **28 kinds of plans** for each side (develop/castle, open the centre against an uncastled king, central break, play where your chain points, minority attack, majority → passed pawn, push/blockade passers, outposts, attack weak pawns, open files, 7th rank, bad bishop, bishop pair, king attack, pawn storms on opposite castling, space, free yourself, simplify/complicate, king activity, two weaknesses, prophylaxis…), each with *why*, *how*, arrows and squares.
- **In the analysis view (tab Stratégie)** — assets/weaknesses for you or your opponent, plans with board overlays (teal = asset, amber = weakness, blue = your plan, violet = opponent's plan), and a cross-check with Stockfish: "Le moteur joue ici Nd5 — dans l'esprit du plan « Installe un cavalier en d5 »", "Coup joué : a4 — ne suit aucun des plans détectés".
- **Bilan stratégique de la partie** (tab Bilan) — dominant structure, structure & centre timelines (clickable), strategic moments of both sides (isolated/doubled/backward pawns created, holes, king shelter weakened, bishop pair given up, passers conceded or obtained, outposts occupied, **plans missed** when the engine's move started a recognised plan and yours cost ≥ 60 cp), and 3 lessons. Mid-exchange states are ignored (judged after the recapture); winning material is left to the tactics exercises.
- **Coup tab** — the strategic impact of the selected move.
- **Three strategy pages**, each in its part of the app — **Profil stratégique** in Progrès (structures you play with score and cp/move, cp lost by type of centre vs your average, structural concessions vs your opponents, missed plans by kind with links to the exact position), **Entraîneur stratégique** in Entraînement (drills from your games: *Quel plan ?* with square-free choices, *Case forte* by clicking the board, *Nomme la structure*; reference positions when you have few games), **Structures de pions** in Théorie (atlas of the 23 structures with an annotated reference position and your record in each). Reviews are computed in background batches and cached per game.
- **LLM coach** — the heuristic reading is sent as context ("Lecture stratégique heuristique") for *Expliquer ce coup*, *Revue complète* and the new **✨ Explique-moi le plan**; the model is told to correct it if wrong. The strategy engine is lazy-loaded by the coach so it stays out of the main bundle.

## SRS & drilling

- **Exercises** — auto-extracted from your blunders, scheduled with an SM-2 lite algorithm (1d → 3d → 7d → 14d → 30d → 60d). Each one carries a heuristic difficulty (`easy` / `medium` / `hard`) based on the engine PV length, presence of sacrifices, and whether the solution is a quiet move; filterable in the toolbar.
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

Grouped into 3 tabs (Aperçu / Faiblesses / Ouvertures) so the user lands on a focused view.

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

- **Phone-first** — bottom tab bar with the five parts, hub pages instead of menus, sticky top bar with the way up, filters in a sheet, pinned move bar in the analysis, 44px touch targets on the main controls, safe-area insets (`viewport-fit=cover`).
- **Command palette** (`Cmd/Ctrl+K` or the header "Rechercher" button) — fuzzy-jump to any view (grouped like the navigation), game, or book.
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

## Concepts library

- **86 fiches** de concepts d'échecs (6 catégories : Tactique, Finale, Structure, Ouverture, Stratégie, Mental), dont 25 dédiées à la stratégie positionnelle (pion isolé/passé, îlots, majorités, case faible, chaîne de pions, rupture, blocus, tempête, colonne ouverte, 7e rangée, paire de fous, cavalier contre fou, espace, sécurité du roi, types de centre, quand échanger, Hérisson, Maróczy, trou d5, Benoni, centre mobile…) avec positions vérifiées au moteur.
- Chaque fiche : définition courte + détaillée, liens externes curés (Wikipedia FR, Lichess practice), positions à explorer (FEN), renvois croisés.
- **ConceptModal** : event-bus pattern (`openConcept(id)`) ouvrable depuis n'importe quelle vue.
- Surfacés via "📖" sur le motif radar, sur les modules roadmap (12 wired), sur les items du plan, plus une vue **Concepts** dédiée (recherche + filtre).

## Opening Lab

- Vue qui prend une ouverture habituelle et **compare ply à ply** ce que tu joues vs ce que jouent les maîtres (Lichess Masters explorer).
- Pour chaque coup de ta ligne la plus jouée : card "Toi" (count/total + W-L-D) + card "Masters" (top 5 avec barres W-D-L).
- Flag automatique "⚠ déviation théorique" quand ton coup est hors du top-3 masters.
- Bouton **🎯 Drill** sur chaque déviation : ouvre le PositionExplorer avec le coup des maîtres comme `bestSan` et ton coup comme `playedSan`.
- Accessible via le header de RepertoireView + command palette.
- **Nécessite un token Lichess** depuis que l'API explorer est gated (Préférences → Token Lichess, gratuit, sans scope).

## Planned (next loops)

- Reverse-color drill (play the same position from the other side).
- Phase-specific deep dive (which opening eats your endgames?).
- LLM-driven plan summary / weekly recap email-style.
- Auto-fill the bracket via chess.com rating header on first import (currently uses median user rating across recent analyses).
