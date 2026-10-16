// Phones: a periodic background task checks chess.com for new games and
// notifies you ("2 nouvelles parties"). The system decides when it runs
// (15 minutes at the soonest, often overnight on iOS). The analysis itself
// waits for the app to be opened (Stockfish needs it in the foreground).
// Defined at startup (index.js), as TaskManager requires.
import * as BackgroundTask from 'expo-background-task'
import * as TaskManager from 'expo-task-manager'
import * as Notifications from 'expo-notifications'
import { getResultForUser } from '@shared/analysis/pgn'
import { syncNewGames } from './sync'

const SYNC_TASK = 'chess-trainer-new-games'
const ENABLED_KEY = 'chess.notify.newGames'
const RESULT_FR = { win: 'victoire', loss: 'défaite', draw: 'nulle' } as const

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
})

TaskManager.defineTask(SYNC_TASK, async () => {
  try {
    const username = localStorage.getItem('chess.username')
    if (!username || !isBackgroundSyncEnabled()) return BackgroundTask.BackgroundTaskResult.Success
    const { added } = await syncNewGames(username)
    if (added.length > 0) {
      const me = username.toLowerCase()
      const lines = added.slice(0, 3).map(g => {
        const opp = g.white.username.toLowerCase() === me ? g.black : g.white
        return `vs ${opp.username} (${RESULT_FR[getResultForUser(g, username)]})`
      })
      await Notifications.scheduleNotificationAsync({
        content: {
          title: added.length > 1 ? `♞ ${added.length} nouvelles parties` : '♞ Nouvelle partie',
          body: `${lines.join(', ')}${added.length > 3 ? '…' : ''} — ouvre l'appli pour les analyser et revoir tes erreurs.`,
        },
        trigger: null,
      })
    }
    return BackgroundTask.BackgroundTaskResult.Success
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed
  }
})

export function isBackgroundSyncEnabled(): boolean {
  return localStorage.getItem(ENABLED_KEY) === '1'
}

/** Asks for the permission to notify, then registers the task. */
export async function enableBackgroundSync(): Promise<boolean> {
  const { granted } = await Notifications.requestPermissionsAsync()
  if (!granted) return false
  await BackgroundTask.registerTaskAsync(SYNC_TASK, { minimumInterval: 60 })
  localStorage.setItem(ENABLED_KEY, '1')
  return true
}

export async function disableBackgroundSync(): Promise<void> {
  localStorage.removeItem(ENABLED_KEY)
  if (await TaskManager.isTaskRegisteredAsync(SYNC_TASK)) await BackgroundTask.unregisterTaskAsync(SYNC_TASK)
}

export const backgroundSyncSupported = true
