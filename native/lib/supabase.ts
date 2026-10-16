// The Supabase client (sync between devices, Google sign-in), or null when
// the app is built without its settings: EXPO_PUBLIC_SUPABASE_URL and
// EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY (in .env.local, and GitHub Actions
// variables for the website). Both are public by design: row level security
// protects the data (supabase/migrations/).
import { AppState, Platform } from 'react-native'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = process.env.EXPO_PUBLIC_SUPABASE_URL
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY

export const supabase: SupabaseClient | null = url && key
  ? createClient(url, key, {
    auth: {
      storage: localStorage,
      autoRefreshToken: true,
      persistSession: true,
      // The website reads the session from the URL Google sends it back to.
      detectSessionInUrl: Platform.OS === 'web',
    },
  })
  : null

// Phones: refresh the session only while the app is in the foreground.
if (supabase && Platform.OS !== 'web') {
  AppState.addEventListener('change', state => {
    if (state === 'active') supabase.auth.startAutoRefresh()
    else supabase.auth.stopAutoRefresh()
  })
}
