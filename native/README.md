# Chess Trainer — appli mobile (React Native / Expo)

La même appli que le site (`../`), en native pour iOS et Android, et aussi en site web via React Native Web. Le code métier est partagé : il reste dans `../src` (analyse, stratégie, concepts, exercices, stockage) et s'importe en `@shared/…`.

## Lancer

```bash
cd native
npm install          # copie aussi Stockfish (../public) dans public/ pour le web
npx expo start       # puis i (simulateur iOS), a (Android) ou w (web)
```

Sur un téléphone : installer **Expo Go** et scanner le QR code affiché par `expo start`.

## Architecture

- **Navigation** : Expo Router. `app/(tabs)/` porte les 5 parties (Aujourd'hui, Parties, Entraînement, Théorie, Progrès) ; les outils sont des écrans de la pile racine (`app/*.tsx`). Les pages-sommaires sont générées depuis le modèle de navigation du site (`../src/components/navModel.ts`) ; `lib/routes.ts` dit quels outils sont déjà portés.
- **Code partagé** : `metro.config.js` surveille `../src` et y résout les paquets depuis `native/node_modules` (une seule copie de chess.js…). TypeScript résout les variantes `.native.ts` en priorité.
- **Stockfish** : `../src/engine/transport*.ts`. Sur le web, un Web Worker ; sur téléphone, un Worker dans une WebView cachée (`components/EngineHost.tsx`) qui charge le build WASM du site (GitHub Pages) — la première analyse demande le réseau. Diagnostic : `chesstrainer://dev/engine`.
- **Stockage** : `localStorage` est fourni par SQLite (`expo-sqlite/localStorage/install`, importé dans `index.js`), et `../src/storage/db.native.ts` remplace IndexedDB pour les parties et analyses.

## Vérifier

```bash
npx tsc --noEmit
npx expo export --platform web   # ou --platform ios
```
