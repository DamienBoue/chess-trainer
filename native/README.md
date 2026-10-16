# Chess Trainer — appli mobile (React Native / Expo)

L'appli Chess Trainer : iOS, Android et le web (React Native Web, publié sur GitHub Pages à chaque push sur `master`). Le code métier est dans `../src` (analyse, stratégie, concepts, exercices, stockage) et s'importe en `@shared/…`.

## Lancer

```bash
cd native
npm install          # copie aussi Stockfish (public/) dans assets/engine/, embarqué dans l'appli
npx expo start       # puis i (simulateur iOS), a (Android) ou w (web)
```

Sur un téléphone : installer **Expo Go** et scanner le QR code affiché par `expo start`.

## Architecture

- **Navigation** : Expo Router. `app/(tabs)/` porte les 5 parties (Aujourd'hui, Parties, Entraînement, Théorie, Progrès) ; les outils sont des écrans de la pile racine (`app/*.tsx`). Les pages-sommaires sont générées depuis le modèle de navigation du site (`../src/components/navModel.ts`) ; `lib/routes.ts` dit quels outils sont déjà portés.
- **Code partagé** : `metro.config.js` surveille `../src` et y résout les paquets depuis `native/node_modules` (une seule copie de chess.js…). TypeScript résout les variantes `.native.ts` en priorité.
- **Stockfish** : `../src/engine/transport*.ts`. Sur le web, un Web Worker (`public/stockfish.js`) ; sur téléphone, un Worker dans une WebView cachée (`components/EngineHost.tsx`) qui démarre le moteur embarqué dans l'appli (hors ligne) et le relance si le système tue la page. Diagnostics (utiles sur un simulateur sans clavier) : `chesstrainer://dev/engine` (Stockfish répond-il ?), `chesstrainer://dev/login?u=<pseudo>`, `chesstrainer://dev/analyze` (analyse de bout en bout de la dernière partie). Dans Expo Go : `exp://127.0.0.1:8081/--/dev/engine`.
- **Stockage** : `localStorage` est fourni par SQLite (`expo-sqlite/localStorage/install`, importé dans `index.js`), et `../src/storage/db.native.ts` remplace IndexedDB pour les parties et analyses.

## Vérifier

```bash
npx tsc --noEmit
npm run export:web               # le site de GitHub Pages (dist/, base /chess-trainer)
npx expo export --platform ios
```
