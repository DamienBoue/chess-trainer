// Move keyboard focus into a modal when it opens; restore focus to the
// element that had it before, on close. Also traps Tab / Shift+Tab so
// the user can't escape the modal with the keyboard.
//
// Returns a ref to attach to the modal container.

import { useEffect, useRef } from 'react'

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), ' +
  'select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

function focusableInside(el: HTMLElement): HTMLElement[] {
  return Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
    .filter(node => !node.hasAttribute('aria-hidden'))
}

export function useFocusOnOpen<T extends HTMLElement>(open: boolean) {
  const ref = useRef<T | null>(null)
  const previousActive = useRef<Element | null>(null)

  useEffect(() => {
    if (!open) return
    previousActive.current = document.activeElement
    // Focus on the next animation frame so the modal element is in the DOM.
    const id = requestAnimationFrame(() => {
      if (!ref.current) return
      const focusables = focusableInside(ref.current)
      const target = focusables[0] ?? ref.current
      target?.focus?.()
    })

    // Trap Tab + Shift+Tab inside the modal so the keyboard can't escape.
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Tab' || !ref.current) return
      const focusables = focusableInside(ref.current)
      if (focusables.length === 0) {
        e.preventDefault()
        ref.current.focus?.()
        return
      }
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      const active = document.activeElement as HTMLElement | null
      if (e.shiftKey) {
        if (active === first || !ref.current.contains(active)) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (active === last || !ref.current.contains(active)) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)

    return () => {
      cancelAnimationFrame(id)
      document.removeEventListener('keydown', onKey)
      // Return focus to whoever opened the modal.
      const prev = previousActive.current
      if (prev instanceof HTMLElement) prev.focus?.()
    }
  }, [open])

  return ref
}
