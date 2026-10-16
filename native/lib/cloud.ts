// Sync with Supabase: Google sign-in, and the remote store of the shared
// sync engine (@shared/sync/engine), with its state kept per account.
import { Platform } from 'react-native'
import * as Linking from 'expo-linking'
import * as WebBrowser from 'expo-web-browser'
import type { GameAnalysis } from '@shared/types'
import { EMPTY_SYNC_STATE, type RemoteRow, type RemoteStore, type SyncState } from '@shared/sync/engine'
import { supabase } from './supabase'

export const cloudEnabled = supabase !== null

/** Where Google sends you back: the site, or the app (chesstrainer://, exp:// in Expo Go). */
function redirectUrl(): string {
  if (Platform.OS === 'web') return `${window.location.origin}${process.env.EXPO_BASE_URL ?? ''}/`
  return Linking.createURL('auth-callback')
}

export async function signInWithGoogle(): Promise<void> {
  if (!supabase) throw new Error('Synchronisation non configurée')
  const redirectTo = redirectUrl()
  if (Platform.OS === 'web') {
    // Leaves the page; supabase-js reads the session when Google sends us back.
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } })
    if (error) throw error
    return
  }
  const { data, error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo, skipBrowserRedirect: true } })
  if (error) throw error
  const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo)
  if (res.type === 'success') await sessionFromUrl(res.url)
}

/** The session carried by the redirect URL: tokens in the #hash, or a ?code. */
export async function sessionFromUrl(url: string): Promise<void> {
  if (!supabase) return
  const params = new URLSearchParams([url.split('#')[1] ?? '', url.split('?')[1]?.split('#')[0] ?? ''].join('&'))
  const code = params.get('code')
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) throw error
    return
  }
  const access_token = params.get('access_token')
  const refresh_token = params.get('refresh_token')
  if (access_token && refresh_token) {
    const { error } = await supabase.auth.setSession({ access_token, refresh_token })
    if (error) throw error
  }
}

export async function signOut(): Promise<void> {
  await supabase?.auth.signOut()
}

const PAGE = 200

async function pull<T>(table: 'analyses' | 'documents', since: string | null): Promise<RemoteRow<T>[]> {
  if (!supabase) return []
  const rows: RemoteRow<T>[] = []
  for (let from = 0; ; from += PAGE) {
    let q = supabase.from(table).select('id, data, updated_at').order('updated_at').range(from, from + PAGE - 1)
    if (since) q = q.gt('updated_at', since)
    const { data, error } = await q
    if (error) throw error
    for (const r of data ?? []) rows.push({ id: r.id as string, data: r.data as T, updatedAt: r.updated_at as string })
    if (!data || data.length < PAGE) return rows
  }
}

async function push(table: 'analyses' | 'documents', rows: { id: string; data: unknown }[]): Promise<void> {
  if (!supabase || rows.length === 0) return
  const { error } = await supabase.from(table).upsert(rows, { onConflict: 'user_id,id' })
  if (error) throw error
}

export const supabaseRemote: RemoteStore = {
  pullAnalyses: since => pull<GameAnalysis>('analyses', since),
  pushAnalyses: rows => push('analyses', rows),
  pullDocuments: since => pull<unknown>('documents', since),
  pushDocuments: rows => push('documents', rows),
}

const stateKey = (userId: string) => `chess.sync.state.${userId}`

export function loadSyncState(userId: string): SyncState {
  try { return { ...EMPTY_SYNC_STATE, ...JSON.parse(localStorage.getItem(stateKey(userId)) ?? '{}') } } catch { return EMPTY_SYNC_STATE }
}

export function saveSyncState(userId: string, state: SyncState): void {
  localStorage.setItem(stateKey(userId), JSON.stringify(state))
}
