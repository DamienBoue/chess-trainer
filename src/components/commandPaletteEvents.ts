// Opening the command palette from anywhere (header "Rechercher" button)
// without importing the component: a window event the palette listens to.

export const OPEN_COMMAND_PALETTE = 'open-command-palette'

export function openCommandPalette() {
  window.dispatchEvent(new Event(OPEN_COMMAND_PALETTE))
}
