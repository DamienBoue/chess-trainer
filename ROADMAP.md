# Roadmap

## Deferred (yes-but-not-now)

These were proposed and explicitly held off by the user. Don't drop them; pick them up when there's appetite.

- **Lichess support** — fetch games from `lichess.org/api/games/user/{username}` (NDJSON), same engine pipeline. The user only plays chess.com today; revisit when that changes.
- **MultiPV "only-move" detection** — re-evaluate exercise positions with `setoption name MultiPV value 2` and tag puzzles where the gap between best and 2nd-best ≥ 200 cp as truly forcing. The engine already has the `evaluate()` API; the missing parts are: (a) extending it to surface the secondary line, (b) running the extra evaluation (lazily on exercise view, or eagerly during analyzeGame for already-flagged candidate positions), (c) storing `onlyMoveGap` in `MoveAnalysis`, (d) UI badge + filter.
- **Repertoire builder / deviation detector** — track the user's most-played opening lines (token tree of first ~12 plies grouped by ECO/parent), flag in-game positions where the user departed from their typical move with a "tu joues d'habitude X (12/15) ; là tu as joué Y" annotation. Heaviest of the deferred items because it needs an opening tree representation and a deviation-detection pass over each game.

## Ideas (not yet committed to)

- Cloud sync of analyses across devices (Supabase / Cloudflare KV / a tiny self-hosted endpoint).
- Stockfish full (NNUE) build for deeper analysis on capable machines, with a setting toggle.
- Multi-engine pool to run several Stockfish workers in parallel during batch analyses.
- LLM-powered "coach" that turns the per-move analysis into prose advice.
- Stockfish-bot mode: play against the engine at a configurable Elo (UCI_LimitStrength).
- Shareable game URL with the analysis embedded (not just exercises).
