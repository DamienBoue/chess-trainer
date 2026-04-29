# Roadmap

## Deferred (yes-but-not-now)

These were proposed and explicitly held off by the user. Don't drop them; pick them up when there's appetite.

- **Lichess support** — fetch games from `lichess.org/api/games/user/{username}` (NDJSON), same engine pipeline. The user only plays chess.com today; revisit when that changes.

## Ideas (not yet committed to)

- Cloud sync of analyses across devices (Supabase / Cloudflare KV / a tiny self-hosted endpoint).
- Stockfish full (NNUE) build for deeper analysis on capable machines, with a setting toggle.
- Multi-engine pool to run several Stockfish workers in parallel during batch analyses.
- LLM-powered "coach" that turns the per-move analysis into prose advice.
- Stockfish-bot mode: play against the engine at a configurable Elo (UCI_LimitStrength).
- Shareable game URL with the analysis embedded (not just exercises).
