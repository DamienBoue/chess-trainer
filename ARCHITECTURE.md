# Architecture

The codebase is small enough to keep a flat layout, but the *intent* follows DDD-style layering. This document maps current folders to layers and documents the dependency rules.

## Layers

| Layer | Rule | Current folders |
|---|---|---|
| **Domain** | Pure business logic. No DOM. No `fetch`. No `localStorage` (with one tolerated exception, see *Tech debt*). Tested with pure-function tests. | `src/analysis/`, `src/skill/`, `src/concepts/`, `src/coach/` (prompt builders + config), `src/library/` (validation + types — but not `storage.ts`), `src/players/` |
| **Infrastructure** | Adapters to external systems. Implements ports for the domain. | `src/api/` (chess.com + Lichess HTTP), `src/storage/` (IDB + localStorage), `src/engine/` (Stockfish worker), `src/coach/client.ts` (Anthropic/OpenAI HTTP), `src/library/storage.ts`, `src/players/storage.ts` |
| **UI** | React components. May import from any layer; depends only on the domain's public types. | `src/components/`, `src/audio/` |
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

### `src/skill/` — adaptivity domain
Elo + bracket + roadmap. The trainer's "adaptive" layer. Pure logic.

### `src/concepts/` — knowledge base domain
In-app chess theory dictionary (fork, IQP, Lucena, …). Pure data + lookup.

### `src/coach/` — LLM-coach domain
Prompt construction + config (BYO API key). Pure logic, except `client.ts` which is the HTTP adapter to Anthropic / OpenAI — that one is infrastructure.

### `src/library/` and `src/players/` — feature modules (mixed)
Bigger feature modules that bundle a small domain (types, import validators) and their storage adapter. The storage file in each is infrastructure; the rest is domain.

### `src/api/` — infrastructure (HTTP)
- `chesscom.ts` — public API client (game fetch)
- `lichess.ts` — Explorer + Tablebase
- `share.ts` — share-URL encoding (browser-only, no network)

### `src/storage/` — infrastructure (persistence)
- IDB-backed: `db.ts`, `games.ts`, `analyses.ts`
- localStorage-backed: `daily.ts`, `notes.ts`, `plan.ts`, `settings.ts`, `persist.ts` (SRS), `json.ts` (shared helper)
- `exportImport.ts` — backup/restore JSON dump

### `src/engine/` — infrastructure (worker)
Stockfish 17 lite WASM wrapped in a Web Worker. Single port: `evaluate(fen, depth)`.

### `src/components/` — UI (React)
Tree of components. ~50 files. Imports from any layer.

### `src/utils/` — shared
Tiny pure helpers (move normalization, date formatting). Could be a domain folder; lives in `shared/` because it's used by every layer.

## Tech debt: domain ↔ infrastructure leaks

Some domain modules currently call infrastructure directly. Fixing these requires introducing repository ports + dependency injection. Documented here so we don't pretend the layering is clean:

| Domain module | Infrastructure call | Fix sketch |
|---|---|---|
| `src/analysis/plan.ts` | `import { isDue } from '../storage/persist'` | Pass `progress` map already loaded by caller — done; isDue takes the map. The import is just a pure helper using stored shape. **Acceptable** since `isDue` is logically pure. |
| `src/skill/elo.ts`, `src/skill/roadmap.ts` | `loadJson/saveJson` from `storage/` | Move state mgmt to a repository port. **Defer** — small scope, low cost today. |
| `src/coach/config.ts` | `loadJson/saveJson` | Same as skill. |
| `src/concepts/lookup.ts` | None ✓ | Already clean. |

`json.ts` is technically shared (a tiny `localStorage` adapter) — small enough that the leak is acceptable until the codebase grows.

## When to promote a module to its own layer

- A folder has both pure-logic and I/O files (current: `library/`, `players/`, `coach/`) → split when the I/O grows past one file.
- A pure-logic module starts pulling from `storage/` for state → introduce a repository port (`type StorageOf<T>`) and inject it.
- Adding a second persistence backend (e.g. cloud sync) → mandatory port for the affected stores.

## Test layout

| Test type | Location | Examples |
|---|---|---|
| Pure-function | `<module>.test.ts` next to the source | `aggregate.test.ts`, `motifs.test.ts` |
| Catalog integrity | Static checks on data | `concepts/catalog.test.ts`, `library/import.test.ts` (audits bundled books) |
| Storage roundtrip | Mock `localStorage` via `vi.stubGlobal` | `storage/daily.test.ts`, `storage/notes.test.ts` |
| Network calls | Mock `fetch` via `vi.stubGlobal` | `coach/coach.test.ts` |

Component tests not yet wired (React Testing Library out of scope so far).

## Why no full DDD reorg yet

The cost (rewrite of ~250 import statements across ~90 files) outweighs today's pain. The current flat layout works as long as:
- Every new module knows which layer it belongs to (see this doc).
- The leak table above doesn't grow.

A bulk reorg into `src/domain/`, `src/infrastructure/`, `src/shared/` is queued for whenever the leak table becomes painful (probably when we add a cloud sync backend).
