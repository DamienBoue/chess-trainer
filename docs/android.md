# Android app (APK, installed by hand)

The same app as the website, installed on the phone: it also checks chess.com in the background, notifies new games and prepares the day's exercise session before you open it. Not on the Play Store: the APK is built on the Mac and installed from the file.

## Build

Needs the Android SDK (`ANDROID_HOME`) and a JDK 21. The SDK fetches the NDK and CMake by itself the first time.

```sh
cd native
npm run apk        # → android/app/build/outputs/apk/release/app-release.apk
```

`npm run apk` regenerates `android/` (gitignored, never edited by hand: settings live in `app.json`) and builds for `arm64-v8a`, the architecture of current phones and of the Apple Silicon emulator. The Supabase keys come from `native/.env.local`, read at build time.

The APK is signed with the debug key of Expo's template: fine for your own phone, not for the Play Store. Every build has the same key, so a new APK installs over the old one and keeps the data.

## Install on the phone

- **USB**: phone in developer mode with USB debugging, plugged in, then `adb install -r android/app/build/outputs/apk/release/app-release.apk`.
- **Without cable**: send the file to the phone (Google Drive, mail…), open it, allow "Install unknown apps" for the app that opens it.

Then: sign in with the chess.com username, and in Préférences:
- **Notifications**: "Me prévenir de mes nouvelles parties" (Android asks for the permission). Android decides when the task runs (every hour at best, less when the battery is low).
- **Sync**: "Se connecter avec Google" to find the website's data (analyses, progress) on the phone. The redirect `chesstrainer://**` must be in Supabase's redirect URLs (see `supabase.md`).

## Updates (EAS Update)

The APK updates itself: at each launch it asks Expo's update server for the latest JavaScript of the `production` channel, downloads it, and runs it from the next launch (Préférences → "Version de l'appli" shows which one runs, and "Rechercher une mise à jour" applies it at once).

- **Published by GitHub** on every push to `master` (`.github/workflows/android-update.yml`), with the repository secret `EXPO_TOKEN`: expo.dev → Account settings → Access tokens → create one, then GitHub → Settings → Secrets and variables → Actions → *New repository secret*. Without it the job only says it skipped.
- **By hand**: `cd native && npx eas-cli@latest update --channel production --platform android --environment production --message "…"` (uses `native/.env.local`).
- Project: [@damienboue/chess-trainer](https://expo.dev/accounts/damienboue/projects/chess-trainer); the channel is set in `app.json` (`updates.requestHeaders`), as the APK isn't built by EAS Build.

**Native changes** (a new native module, an `app.json` change that ends up in the native project) can't travel this way: bump `version` in `native/app.json` (the runtime version follows it), build a new APK and install it over the old one. The old APK keeps running its last compatible update until then.
