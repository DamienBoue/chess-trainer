import { useSyncExternalStore } from 'react'

// Tailwind's `sm` breakpoint (40rem). The CSS side of the layout keys off
// `sm:`; this hook is for the few places where the DOM itself differs between
// a phone and a wider screen (so that a control is never rendered twice).
const SM_AND_UP = '(min-width: 40rem)'

function mediaQuery(): MediaQueryList | null {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(SM_AND_UP)
    : null
}

function subscribe(onChange: () => void): () => void {
  const mql = mediaQuery()
  if (!mql) return () => {}
  mql.addEventListener('change', onChange)
  return () => mql.removeEventListener('change', onChange)
}

function getSnapshot(): boolean {
  const mql = mediaQuery()
  return mql ? !mql.matches : false
}

/** True while the viewport is narrower than Tailwind's `sm` breakpoint.
 *  Without `matchMedia` (jsdom, no window) it reports false: the roomy layout. */
export function useIsPhone(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}
