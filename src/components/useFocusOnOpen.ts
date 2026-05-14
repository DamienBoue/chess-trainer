// Move keyboard focus into a modal when it opens; restore focus to the
// element that had it before, on close. Doesn't implement a full focus
// trap (Tab can still escape) — keep that simple until we hit a real
// a11y need. The two important behaviours people notice in screen-reader
// use are (a) focus actually entering the modal and (b) returning to the
// trigger on close.

import { useEffect, useRef } from 'react'

export function useFocusOnOpen<T extends HTMLElement>(open: boolean) {
  const ref = useRef<T | null>(null)
  const previousActive = useRef<Element | null>(null)

  useEffect(() => {
    if (!open) return
    previousActive.current = document.activeElement
    // Focus on the next animation frame so the modal element is in the DOM.
    const id = requestAnimationFrame(() => {
      const target = ref.current?.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      ) ?? ref.current
      target?.focus?.()
    })
    return () => {
      cancelAnimationFrame(id)
      // Return focus to whoever opened the modal.
      const prev = previousActive.current
      if (prev instanceof HTMLElement) prev.focus?.()
    }
  }, [open])

  return ref
}
