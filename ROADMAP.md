# Roadmap

## Deferred (yes-but-not-now)

These were proposed and explicitly held off by the user. Don't drop them; pick them up when there's appetite.

- **Lichess support** — fetch games from `lichess.org/api/games/user/{username}` (NDJSON), same engine pipeline. The user only plays chess.com today; revisit when that changes.

## Ideas (not yet committed to)

- Library cloud sync (move IndexedDB store to a self-hosted backend so books + progress follow the user across devices). Imported book content is copyrighted so anything we upload needs to stay in the user's own scope.
- Image-based PDF importer (ChessBase exports): vision-LLM transcription of bitmap diagrams to FEN, or template matching against a curated pieces bank. Out of scope for now.
- Cloud sync of analyses across devices (Supabase / Cloudflare KV / a tiny self-hosted endpoint).
- Stockfish full (NNUE) build for deeper analysis on capable machines, with a setting toggle.
- Multi-engine pool to run several Stockfish workers in parallel during batch analyses.
- LLM-powered "coach" that turns the per-move analysis into prose advice.
- Stockfish-bot mode: play against the engine at a configurable Elo (UCI_LimitStrength).
- Shareable game URL with the analysis embedded (not just exercises).

## UX — next steps (from the 2026-10 ergonomics review)

Benchmarked against Lichess, chess.com Game Review and En Croissant. Already shipped: five parts (Aujourd'hui · Parties · Entraînement · Théorie · Progrès) from a single model, hub pages instead of menus, phone top bar with the way up, filter chip + sheet, tabbed analysis view (verdict strip, compact move list, engine arrow, keyboard shortcuts, key moments) with a pinned move bar on phones, accessible move-quality colours, visible ⌘K search, account menu, home tiles, hash router (back/forward, deep links down to the move), "Revoir mes erreurs" guided mode, eval graph markers.

- **Board tasks full screen on phones** (exercises, rush, drills) like the analysis: hide the tab bar, pinned contextual bar.
- **Répertoire: at most 4 tabs** (fold Trainer and SRS together).
- **Strategy panel in 2 levels** (3 bullets by default + "Détails"), Idée / Problème / Solution template (DecodeChess).
- **"Brillant" (!!) class** — needs sacrifice detection; colour-blind palette toggle in Settings.
- **Revoir mes erreurs → SRS**: send the positions you missed during a review to the exercise queue.
