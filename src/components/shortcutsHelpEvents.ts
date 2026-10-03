// Opening the keyboard-shortcuts help from anywhere (header menu, mobile
// menu) without importing the component: a window event that
// KeyboardShortcutsModal listens to.

export const OPEN_SHORTCUTS_HELP = 'open-shortcuts'

/** Programmatic opener — header button calls this. */
export function openShortcutsHelp() {
  window.dispatchEvent(new CustomEvent(OPEN_SHORTCUTS_HELP))
}
