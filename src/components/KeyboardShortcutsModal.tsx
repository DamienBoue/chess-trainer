// Global keyboard shortcut help modal.
// `?` opens it from anywhere (ignored when typing in an input).

import { useEffect, useState } from 'react'
import { useFocusOnOpen } from './useFocusOnOpen'

interface Shortcut {
  keys: string[]
  label: string
}

const SECTIONS: Array<{ title: string; shortcuts: Shortcut[] }> = [
  {
    title: 'Global',
    shortcuts: [
      { keys: ['?'], label: 'Ouvrir cette aide' },
      { keys: ['⌘', 'K'], label: 'Recherche rapide (vues / parties / livres)' },
      { keys: ['Esc'], label: 'Fermer une modale / annuler' },
    ],
  },
  {
    title: 'Analyse / Lecture de partie',
    shortcuts: [
      { keys: ['←', '→'], label: 'Coup précédent / suivant' },
      { keys: ['F'], label: 'Retourner l\'échiquier' },
    ],
  },
  {
    title: 'Exercices & drills',
    shortcuts: [
      { keys: ['H'], label: 'Révéler la solution' },
      { keys: ['R'], label: 'Recommencer l\'exercice' },
      { keys: ['←', '→'], label: 'Naviguer entre exercices' },
    ],
  },
  {
    title: 'Trainer de calcul',
    shortcuts: [
      { keys: ['Ctrl', 'Entrée'], label: 'Soumettre la séquence' },
    ],
  },
]

/** Programmatic opener — header button calls this. */
export function openShortcutsHelp() {
  window.dispatchEvent(new CustomEvent('open-shortcuts'))
}

export default function KeyboardShortcutsModal() {
  const [open, setOpen] = useState(false)
  const dialogRef = useFocusOnOpen<HTMLDivElement>(open)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      const inField = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')
      if (e.key === '?' && !inField) {
        e.preventDefault()
        setOpen(o => !o)
      } else if (e.key === 'Escape' && open) {
        setOpen(false)
      }
    }
    function onOpenEvent() { setOpen(true) }
    window.addEventListener('keydown', onKey)
    window.addEventListener('open-shortcuts', onOpenEvent)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('open-shortcuts', onOpenEvent)
    }
  }, [open])

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/60"
      onClick={() => setOpen(false)}
    >
      <div
        ref={dialogRef}
        aria-label="Raccourcis clavier"
        className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-lg shadow-2xl max-w-lg w-full max-h-[80vh] overflow-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
          <h2 className="font-semibold">Raccourcis clavier</h2>
          <button
            onClick={() => setOpen(false)}
            className="text-neutral-400 hover:text-white text-xl leading-none px-2"
            aria-label="Fermer"
          >×</button>
        </div>
        <div className="px-5 py-4 space-y-4">
          {SECTIONS.map(s => (
            <div key={s.title}>
              <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                {s.title}
              </h3>
              <ul className="space-y-1.5">
                {s.shortcuts.map((sc, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-neutral-300">{sc.label}</span>
                    <span className="flex gap-1">
                      {sc.keys.map(k => (
                        <kbd
                          key={k}
                          className="px-2 py-0.5 rounded border border-neutral-700 bg-neutral-900 text-xs font-mono text-neutral-200"
                        >{k}</kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="px-5 py-3 border-t border-[var(--color-border)] text-xs text-neutral-500">
          Astuce : appuie sur <kbd className="px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-700">?</kbd> n'importe où pour rouvrir cette aide.
        </div>
      </div>
    </div>
  )
}
