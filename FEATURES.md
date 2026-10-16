# Chess Trainer — Features

Living inventory of what the app does today. One React Native (Expo) app for iOS, Android and the web (GitHub Pages), phone-first.

## Design principles

- **No backend**. Everything runs on the device: Stockfish included. The user's data never leaves it (web: IndexedDB + localStorage; phones: SQLite).
- **No account**. Type your chess.com username, that's it.
- **Adapts to your level**. Recommendations, drill difficulty and study priorities follow your Elo bracket.
- **Phone-first**. Bottom tab bar with five parts, hub pages instead of menus, the board high on the screen, controls under the thumb, 44px touch targets.

## Data sources

- **chess.com public API** — recent games per username (no auth).
- **PGN import** — files of games (players outside chess.com) and books.
- **Lichess Opening Explorer** (masters) and **Tablebase** (≤ 7 pieces).
- **Stockfish 18 lite WASM** — a Web Worker on the web; on phones a Worker in a hidden WebView, bundled with the app (offline), restarted automatically if the OS kills it. Strength is set per request (bot games vs analysis never interfere).

## Navigation

Five parts, as in the chess.com and Lichess apps: **Aujourd'hui** (what do I do now?) · **Parties** (analyse my games) · **Entraînement** · **Théorie** · **Progrès**. The tabs and the hub pages come from one model (`src/nav/navModel.ts`): each tool is a card with what it does, its live status ("14 à revoir"), what it needs when unavailable ("Analyse au moins 3 parties (1/3)"), and an **"À faire maintenant"** card on top. Settings sit behind the gear of the top bar. On the web, every screen has its URL (`/chess-trainer/parties`, `/chess-trainer/partie/live-123…`), deep links and reloads included.

## Aujourd'hui

Greeting with your level, the **last game** (straight into "Revoir mes erreurs" when it has errors), the **exercises due**, and the **day's plan** (spaced repetition, daily puzzle, recurring mistakes, repertoire holes…), each step opening its tool.

## Parties and analysis

- Games list with results, opponents, openings; analyse one or all (progress shown).
- **New games come by themselves**: at launch and whenever the app comes back to the foreground (the tab shown again on the web), the games played since the last one are fetched (only the chess.com archives of those months) and analysed automatically, one after the other. On phones, an optional background task checks chess.com periodically and notifies you of new games (the system picks the moment, at best hourly).
- **Analysis**: board first; on the start position a **summary** (verdict text, your blunders / mistakes / inaccuracies, average loss of each side, main structure, lessons); for each move its quality, the loss, the engine's preferred move (shown as arrows on demand) and line; a **strategic reading** of the position; the **evaluation curve** with error dots (tap to go); the move list; a move bar pinned at the bottom (⏮ ◀ ▶ ⏭, next key moment).
- **Revoir mes erreurs**: replay each of your mistakes (and missed plans) from the position before it, with hints; the engine judges alternatives (from the side to move's point of view); under-promotions playable; final tally.

## Entraînement

- **Exercices du jour**: a session of 20 at most that you can finish (Chessable-style daily goal), frozen for the day. Reviews first (SM-2), then new mistakes from your recent games (last 30 days, at least your 20 last games), the costliest first, two per game before a third. An older mistake comes back only if you reach its position again in a recent game; solved mistakes older than 6 months retire. The rest waits in reserve ("Encore 10" once the session is done), old ones are archived out of every count.
- **Exercices**: your own mistakes in spaced repetition (session, status, category and difficulty filters folded under one line), solve the whole engine line by tapping, reveal, results recorded.
- **Puzzle du jour** with its streak, **Puzzle Rush** (modes, clock, lives), **Réflexe anti-gaffe** (spot the threatened piece against the clock), **Calcul de séquence** (type the forced line without moving pieces).
- **Entraîneur stratégique**: "Quel plan ?", "Case forte" (tap the square), "Nomme la structure", from your games (reference positions when you have few).
- **Jouer contre Stockfish**: colour, strength 1320–2850, all game endings (repetition included).

## Théorie

- **Mon répertoire**: your lines per opening and colour (counts, results, average loss, "SF préfère X", alternatives), the critical positions and holes, and the line trainer with spaced repetition.
- **Labo d'ouvertures**: your most played line against the masters (Lichess explorer). **Ouvertures en miroir**: replay your openings with the other colour.
- **Structures de pions**: the 23 named structures (Carlsbad, IQP, hanging pawns, Maróczy, Hedgehog, French, KID, Benoni, Stonewall…), each with its reference position, the plans of both sides, thematic breaks, key squares and your record in it.
- **Concepts**: 86 theory cards (tactics, endgames, structure, openings, strategy, mental) with positions to explore.
- **Bibliothèque**: imported books (JSON) and the bundled packs, exercises by chapter with progress and tablebase checks. **Préparer un adversaire** (a chess.com player's repertoire and habits) and **Joueurs (PGN)** (profiles from PGN files, two-player comparison).

## Progrès

- **Mon niveau**: declared or detected Elo bracket, the modules to validate for the next one.
- **Statistiques**: overview (accuracy, results by colour, recent trend, weekly curve, phases), weaknesses (missed tactical motifs, move-quality distribution), openings.
- **Profil stratégique**: the structures you play with your score, your loss by type of centre, structural concessions, missed plans with links to the games.
- **Comparer avec un ami**: two chess.com profiles side by side.

## Strategy engine (shared, deterministic)

Pawn structure (isolated / doubled / backward / passed pawns, islands, majorities, chains), strong and weak squares and outposts, centre type (closed, fixed, tension, mobile, open…), pawn breaks with their timing (le moment / à préparer) and structural consequences, king safety, bishops, rooks, space, activity; plans of both sides cross-checked against Stockfish's best move; game-level review (structure timeline, concessions, missed plans, lessons).

## Not carried over from the former web app (Vite)

Keyboard shortcuts and command palette, desktop layout with dropdown menus, colour / time-control global filter, the optional LLM coach (bring-your-own key), annotated PGN export and exercise share links, sounds, position notes, data export/import, the PWA offline cache.
