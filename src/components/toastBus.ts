// Toast event bus. Anywhere in the app can call toast.success(...) /
// toast.error(...) / toast.info(...); the ToastHost mounted once at the App
// root subscribes and renders them. The listener set lives here, at module
// level, so every caller and the host share a single queue.

export type ToastKind = 'success' | 'error' | 'info'

export interface Toast {
  id: number
  kind: ToastKind
  message: string
}

const listeners = new Set<(t: Toast) => void>()
let nextId = 1

export const toast = {
  success(message: string) { emit('success', message) },
  error(message: string) { emit('error', message) },
  info(message: string) { emit('info', message) },
}

function emit(kind: ToastKind, message: string) {
  const t: Toast = { id: nextId++, kind, message }
  for (const l of listeners) l(t)
}

/** Receive every toast emitted from now on. Returns the unsubscribe. */
export function subscribeToasts(listener: (t: Toast) => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
