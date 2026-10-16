# Architecture

One app — React Native / Expo in `native/` (iOS, Android and the web build served by GitHub Pages) — over a plain TypeScript domain in `src/`, imported as `@shared/…`. The domain keeps a flat layout whose *intent* follows DDD-style layering; this document maps folders to layers and documents the dependency rules.

## Layers

| Layer | Rule | Current folders |
|---|---|---|
| **Domain** | Pure business logic. No DOM. No `fetch`. No `localStorage` (with one tolerated exception, see *Tech debt*). Tested with pure-function tests. | `src/analysis/`, `src/strategy/`, `src/skill/`, `src/concepts/`, `src/nav/` (navigation model, game slugs), `src/library/` (validation + types — but not `storage.ts`), `src/players/` |
| **Infrastructure** | Adapters to external systems. Implements ports for the domain. Platform variants as `x.ts` (web) / `x.native.ts` (iOS, Android), picked by Metro. | `src/api/` (chess.com + Lichess HTTP), `src/storage/` (IndexedDB or its `db.native.ts` stand-in + localStorage), `src/engine/` (Stockfish through a transport), `src/library/storage.ts`, `src/players/storage.ts` |
| **UI** | React Native screens and components. May import from any layer. | `native/app/` (Expo Router screens), `native/components/`, `native/lib/` |
| **Shared** | Truly cross-cutting helpers that don't fit any single domain. | `src/utils/`, `src/types.ts` |

## Dependency rules

```
ui  ──→  domain  ──→  (nothing)
ui  ──→  infrastructure
infrastructure  ──→  domain  (it implements ports)
shared          ←  any
```

A domain module **must not** import from `infrastructure/` (`src/api/`, `src/storage/`, `src/engine/`).
Infrastructure **may** import domain types but **must not** import domain functions arbitrarily — only enough to implement an adapter.
UI may import from either.

## Folder responsibilities

### `src/analysis/` — game-analysis domain
Pure chess data: parsing PGN, classifying moves, building repertoires, detecting motifs, recurring mistakes, planning today's session, etc. Every module here can be unit-tested without a browser. Receives data via parameters; never reads from `localStorage` directly.

- `aggregate.ts` — per-game and global stats reductions
- `analyze.ts` — orchestrates Stockfish over a game (Stockfish itself lives in infra/engine; this module is technically a *use case* — it accepts an engine port instance and calls it). Skipped from coverage because it depends on the worker.
- `classify.ts` — cpLoss → MoveClassification thresholds
- `exercises.ts` — extracts SRS exercises from analyses + heuristic difficulty
- `motifs.ts`, `motifRadar.ts` — tactical pattern detection + per-user radar
- `openings.ts`, `openingLine.ts` — ECO grouping + most-played line extraction
- `pgn.ts`, `pgnExport.ts` — parsing + annotated export
- `plan.ts` — today's curated session
- `recurringMistakes.ts`, `recommendations.ts`, `strengths.ts` — analytics
- `repertoire.ts` — habit tree, critiques, holes, drill cards
- `summary.ts` — one-paragraph game prose
- `threats.ts` — anti-blunder reflex helper
- `timeline.ts`, `trend.ts` — weekly buckets + recent-vs-baseline deltas

### `src/strategy/` — positional-analysis domain
Deterministic strategic reading of positions and games (no engine, no LLM). Works on its own light board model (`board.ts`: FEN → 64 squares + attack maps) because it runs on every ply of every game.

- `board.ts` — FEN parsing, square helpers, attack maps, material, knight routes
- `pawns.ts` — pawn facts (isolated, backward, passed…), chains, levers, attack spans (Stockfish definitions)
- `squares.ts` — holes, weak squares, outposts (+ knight routes), colour complexes
- `center.ts` — centre types, pawn breaks (roles, readiness, prep move) and their structural consequences
- `structures.ts` — the named-structure catalogue (patterns written for side A as White, matched in both orientations; plan texts use `[sq]` relative squares) — `samples.ts` holds one legal reference position per structure
- `pieces.ts` — phase, development, king safety, bishops, rooks, space, minor-piece activity
- `insights.ts` / `plans.ts` — descriptive assets/weaknesses and prescriptive plans (why / how / first moves / timing)
- `report.ts` — `analyzePosition(fen)` (entry point) and `planMatchesMove` (engine cross-check)
- `game.ts` — `reviewGameStrategy(analysis)`: structure/centre timelines, strategic events per move, missed plans, lessons
- `profile.ts` — aggregate profile across games; `trainer.ts` — drills; `describe.ts` — compact text for LLM prompts; `text.ts` — French wording helpers

UI pieces: `StrategyPanel` (tab Stratégie), `GameStrategyCard` (tab Bilan), `StrategyView` (+ `StrategyProfilePanel`, `StrategyTrainer`, `StructureAtlas`), `strategyBoard.ts` (report → board overlays), `useStrategyReviews` (batched, cached game reviews).

### `src/skill/` — adaptivity domain
Elo + bracket + roadmap. The trainer's "adaptive" layer. Pure logic.

### `src/concepts/` — knowledge base domain
In-app chess theory dictionary (fork, IQP, Lucena, …). Pure data + lookup.

### `src/nav/` — navigation model
`navModel.ts`: the five parts, their tools, labels, availability rules and "up" links — the app's tab bar and hub pages are generated from it. `gameSlug.ts`: short ids of games for routes.

### `src/library/` and `src/players/` — feature modules (mixed)
Bigger feature modules that bundle a small domain (types, import validators) and their storage adapter. The storage file in each is infrastructure; the rest is domain.

### `src/api/` — infrastructure (HTTP)
- `chesscom.ts` — public API client (game fetch)
- `lichess.ts` — Explorer + Tablebase

### `src/storage/` — infrastructure (persistence)
- IDB-backed: `db.ts`, `games.ts`, `analyses.ts`
- localStorage-backed: `daily.ts`, `settings.ts`, `persist.ts` (SRS), `strategyPrefs.ts`, `json.ts` (shared helper). On phones `localStorage` is provided by SQLite (expo-sqlite), and `db.native.ts` replaces IndexedDB with the same `dbTx` contract.
- `keys.ts` — central registry of every localStorage key the app uses (see below)

#### Key registry (`storage/keys.ts`)
All localStorage keys live in one typed `KEYS` object. Two reasons: (1) prevents accidental collisions or typos at compile time, and (2) makes future migrations (renames, version bumps) a single edit. When you add a new key, register it here first.

### `src/engine/` — infrastructure (engine)
Stockfish 18 lite WASM behind `StockfishEngine` (`evaluate(fen, depth, movetime, elo?)`, strength per request). It talks UCI through a transport: `transport.ts` (web: a Web Worker under the site's base URL) or `transport.native.ts` (phones: one Worker per engine inside a hidden WebView, `native/components/EngineHost.tsx`, which boots the engine bundled with the app and restarts it if the OS kills the page).

### `src/utils/` — shared
Tiny pure helpers (move normalization, date formatting). Could be a domain folder; lives in `shared/` because it's used by every layer.

## Tech debt: domain ↔ infrastructure leaks

Some domain modules currently call infrastructure directly. Fixing these requires introducing repository ports + dependency injection. Documented here so we don't pretend the layering is clean:

| Domain module | Infrastructure call | Fix sketch |
|---|---|---|
| `src/analysis/plan.ts` | `import { isDue } from '../storage/persist'` | Pass `progress` map already loaded by caller — done; isDue takes the map. The import is just a pure helper using stored shape. **Acceptable** since `isDue` is logically pure. |
| `src/skill/elo.ts`, `src/skill/roadmap.ts` | `loadJson/saveJson` from `storage/` | Move state mgmt to a repository port. **Defer** — small scope, low cost today. |
| `src/concepts/lookup.ts` | None ✓ | Already clean. |

`json.ts` is technically shared (a tiny `localStorage` adapter) — small enough that the leak is acceptable until the codebase grows.

## When to promote a module to its own layer

- A folder has both pure-logic and I/O files (current: `library/`, `players/`) → split when the I/O grows past one file.
- A pure-logic module starts pulling from `storage/` for state → introduce a repository port (`type StorageOf<T>`) and inject it.
- Adding a second persistence backend (e.g. cloud sync) → mandatory port for the affected stores.

## Test layout

| Test type | Location | Examples |
|---|---|---|
| Pure-function | `<module>.test.ts` next to the source | `aggregate.test.ts`, `motifs.test.ts` |
| Catalog integrity | Static checks on data | `concepts/catalog.test.ts`, `library/import.test.ts` (audits bundled books) |
| Storage roundtrip | Mock `localStorage` via `vi.stubGlobal` | `storage/daily.test.ts`, `storage/db.native.test.ts` |
| Engine | Fake transport / Worker | `engine/stockfish.test.ts`, `engine/stockfish.reset.test.ts`, `engine/transport.native.test.ts` |

The app (`native/`) is checked by `tsc` and its web export in CI; screens are verified in the iOS simulator and in a browser.

## Why no full DDD reorg yet

The cost (rewrite of ~250 import statements across ~90 files) outweighs today's pain. The current flat layout works as long as:
- Every new module knows which layer it belongs to (see this doc).
- The leak table above doesn't grow.

A bulk reorg into `src/domain/`, `src/infrastructure/`, `src/shared/` is queued for whenever the leak table becomes painful (probably when we add a cloud sync backend).
