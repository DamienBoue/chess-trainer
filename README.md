# Chess Trainer

App to analyse your [chess.com](https://chess.com) games with Stockfish, turn your mistakes into exercises and understand the strategy of your positions. One React Native (Expo) app for **iOS, Android and the web**.

🌐 **Web version: https://damienboue.github.io/chess-trainer/** — type your chess.com username, that's it: no account, nothing leaves your device. On a phone, "Add to Home Screen" installs it like an app.

🤖 **Android app**: an APK built on the Mac, installed by hand, then updated on its own (EAS Update) — see [docs/android.md](docs/android.md).

💬 **Feature requests, idées, discussions** : [Discussions du repo](https://github.com/DamienBoue/chess-trainer/discussions)

## What it does

- Fetches your recent games from the chess.com public API and analyses them move by move with Stockfish (on your device).
- Five parts: **Aujourd'hui** (the day's plan), **Parties** (analysis, "Revoir mes erreurs"), **Entraînement** (exercises from your mistakes in spaced repetition, daily puzzle, Puzzle Rush, blunder reflex, calculation, strategy trainer, play the engine), **Théorie** (repertoire, opening lab, mirror openings, pawn structures, concepts, books, opponent prep, PGN players), **Progrès** (level, statistics, strategic profile, compare with a friend).
- **Strategic analysis**: pawn structure, strong/weak squares, centre type, pawn breaks and their timing, 23 named structures with the plans of both sides.

See [FEATURES.md](FEATURES.md) for the details and [ARCHITECTURE.md](ARCHITECTURE.md) for how it is built.

## Layout

- `native/` — the app (Expo SDK 58, Expo Router, React Native, react-native-web). See [native/README.md](native/README.md) to run it.
- `src/` — the domain code the app imports as `@shared/…`: analysis, strategy, concepts, exercises, storage, engine transport. Plain TypeScript, unit-tested with Vitest.
- `scripts/` — Python tools that build the bundled books (`native/public/books/`).

## Run

```bash
npm install                 # domain code (src/) and its tests
cd native && npm install    # the app
npx expo start              # i: iOS simulator, a: Android, w: web — or scan the QR code with Expo Go
```

## Check

```bash
npm run lint && npm run typecheck && npm test   # src/
cd native && npx tsc --noEmit && npm run export:web
```

The web build (`npm run export:web`) is what GitHub Pages serves, deployed on every push to `master`.

## Notes

- Stockfish 18 lite (single-threaded WASM, no COOP/COEP headers needed): a Web Worker on the web; on phones, a Worker inside a hidden WebView, with the engine bundled in the app (works offline).
- The chess.com public API is rate-limited; the app fetches the most recent month archive and walks back as needed.
