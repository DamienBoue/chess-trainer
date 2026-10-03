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

Benchmarked against Lichess, chess.com Game Review and En Croissant. Already shipped: 5-entry navigation from a single model, tabbed analysis view (verdict strip, compact move list, engine arrow, keyboard shortcuts, key moments), accessible move-quality colours, visible ⌘K search, account menu, home tiles.

- **Hash router** — `#/parties/{id}?ply=14&onglet=strategie`: browser back/forward, shareable deep links, reload without losing the position, breadcrumbs derived from the route.
- **Mobile bottom bar** with the 5 entries (hamburger menus cut discoverability by ~20 % per NN/g), fixed board ≤ 42vh in the analysis view, swipeable tabs.
- **"Revoir mes erreurs" guided mode** (Lichess "Learn from your mistakes"): interactive board, "find better than Cf3", solution / skip, your moves only, chronological, wired to the existing SRS.
- **Hub pages** for S'entraîner / Progresser / Ouvertures (cards with what each mode fixes and progress), instead of dropdowns only.
- **Filters as chips** in the page header (Progresser, Ouvertures, Parties) instead of a second header row.
- **Eval graph markers** — dots for every negative move, phase boundaries, key-moment badges.
- **Strategy panel in 2 levels** (3 bullets by default + "Détails"), Idée / Problème / Solution template (DecodeChess).
- **"Brillant" (!!) class** — needs sacrifice detection; colour-blind palette toggle in Settings.

