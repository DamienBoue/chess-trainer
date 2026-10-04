// Modal sheet anchored to the bottom of the screen, for scoped, closable
// tasks (filters, account actions) — never for page-to-page navigation,
// which goes through the hub pages. Escape, the backdrop or × close it;
// focus moves into it and back to the opener.

import { useEffect, useRef } from 'react'

interface Props {
  title: string
  onClose: () => void
  children: React.ReactNode
}

export default function BottomSheet({ title, onClose, children }: Props) {
  const panelRef = useRef<HTMLDivElement>(null)
  // The latest onClose, so that a parent re-render doesn't reset the focus.
  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose })

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    panelRef.current?.focus()
    // Capture phase: the sheet is modal, Escape must not also reach the
    // page's own shortcuts.
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      onCloseRef.current()
    }
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      opener?.focus()
    }
  }, [])

  return (
    <div className="fixed inset-0 z-40 bg-black/60" onClick={() => onCloseRef.current()}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-xl bg-[var(--color-panel)] border-t border-[var(--color-border)] pb-[env(safe-area-inset-bottom)] outline-none sm:max-w-md sm:mx-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pl-4 pr-1 pt-2">
          <h2 className="text-sm font-semibold">{title}</h2>
          <button onClick={onClose} aria-label="Fermer" className="w-11 h-11 grid place-items-center text-xl text-neutral-400 hover:text-white">×</button>
        </div>
        {children}
      </div>
    </div>
  )
}
