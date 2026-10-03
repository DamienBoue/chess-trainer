// Replaying the first-visit tour from anywhere (Settings) without importing
// the component: clear the "done" flag Onboarding checks, then reload.

import { KEYS } from '../storage/keys'

/** Programmatically replay the tour (e.g. from Settings). */
export function resetOnboarding() {
  localStorage.removeItem(KEYS.onboardingDone)
  window.location.reload()
}
