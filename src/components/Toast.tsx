// Minimal toast notification system.
//
// Single global queue, mounted once at the App root. Anywhere in the app
// can call toast.success(...) / toast.error(...) / toast.info(...) to
// surface feedback. No external dependency.

import { useEffect, useState } from 'react'

export type ToastKind = 'success' | 'error' | 'info'

interface Toast {
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

export function ToastHost() {
  const [items, setItems] = useState<Toast[]>([])
  useEffect(() => {
    function onToast(t: Toast) {
      setItems(prev => [...prev, t])
      // Auto-dismiss after 3.5s (errors stick a touch longer).
      const ttl = t.kind === 'error' ? 5000 : 3500
      window.setTimeout(() => {
        setItems(prev => prev.filter(i => i.id !== t.id))
      }, ttl)
    }
    listeners.add(onToast)
    return () => { listeners.delete(onToast) }
  }, [])
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {items.map(t => (
        <div
          key={t.id}
          className={`pointer-events-auto px-4 py-2 rounded-md shadow-lg text-sm max-w-sm border ${
            t.kind === 'success' ? 'bg-green-900/90 border-green-700 text-green-100' :
            t.kind === 'error'   ? 'bg-red-900/90 border-red-700 text-red-100' :
            'bg-neutral-900/90 border-neutral-700 text-neutral-100'
          } animate-[slideInRight_180ms_ease-out]`}
        >
          {t.kind === 'success' && <span className="mr-2">✓</span>}
          {t.kind === 'error' && <span className="mr-2">⚠</span>}
          {t.message}
        </div>
      ))}
    </div>
  )
}
