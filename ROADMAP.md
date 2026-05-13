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
