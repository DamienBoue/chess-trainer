# Chess Trainer

Web app to analyze your [chess.com](https://chess.com) games locally with Stockfish, identify mistakes, common patterns, and openings to study.

🌐 **Live demo: https://damienboue.github.io/chess-trainer/**

Just open the link and type your chess.com username — no install, no account, nothing leaves your browser.

## Features

- Fetches your recent games from the chess.com public API (no auth needed)
- Replays each game with a navigable board
- Move-by-move Stockfish evaluation (single-threaded WASM, runs entirely in your browser — nothing is sent to a server)
- Move classification: best / good / inaccuracy / mistake / blunder / book
- Eval graph and per-move best line
- Aggregate stats across analyzed games:
  - Mistake distribution by phase (opening / middlegame / endgame)
  - Average centipawn loss (you vs. opponents)
  - Win rate by color and by opening
  - Auto-derived strengths and weaknesses

## Stack

- **Vite + React + TypeScript**
- **chess.js** — game logic, PGN parsing
- **react-chessboard** — board UI
- **Stockfish 18 (lite, single-threaded WASM)** — engine, loaded as a Web Worker
- **Tailwind CSS v4** — styling

## Run

```bash
npm install
npm run dev
```

Open http://localhost:5173, enter your chess.com username, and start analyzing.

## Build

```bash
npm run build
npm run preview
```

## Notes

- The single-threaded Stockfish build avoids the COOP/COEP headers required by SharedArrayBuffer. Strength is sufficient for game review (depth 13 by default).
- The chess.com public API is rate-limited; the app fetches the most recent month archive and walks back as needed up to the requested number of games.
- Mobile: works in any modern mobile browser. A native wrapper (e.g. Capacitor) could be added later.
