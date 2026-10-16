// The web build has no background tasks nor local notifications without a
// server: it checks for new games when the page is opened or shown again.
export function isBackgroundSyncEnabled(): boolean {
  return false
}

export async function enableBackgroundSync(): Promise<boolean> {
  return false
}

export async function disableBackgroundSync(): Promise<void> {}

export const backgroundSyncSupported = false
