// Phones: the shared storage modules use localStorage, which must exist
// before any of them loads — expo-sqlite provides it on iOS and Android
// (a no-op on the web, which has the real one).
import 'expo-sqlite/localStorage/install'
import 'expo-router/entry'
