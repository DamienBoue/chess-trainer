// First-visit guided tour.
//
// 5 simple cards shown over the home screen until the user dismisses
// or finishes. State stored in localStorage so we never nag again.

import { useEffect, useState } from 'react'

const STORAGE_KEY = 'chess.onboarding.completed'

const STEPS: Array<{ title: string; body: string }> = [
  {
    title: 'Bienvenue 👋',
    body: 'Chess Trainer importe tes parties chess.com, les analyse 100% en local avec Stockfish, et te génère un programme d\'entraînement personnalisé.',
  },
  {
    title: '1. Importe tes parties',
    body: 'Saisis ton pseudo chess.com sur l\'accueil. Les 20 dernières parties sont chargées. Tu peux aussi coller un PGN si tu joues ailleurs.',
  },
  {
    title: '2. Lance l\'analyse',
    body: 'Dans l\'onglet Parties, clique "Tout analyser". Stockfish tourne dans ton navigateur (1-2 minutes pour 10 parties). Rien n\'est envoyé à un serveur.',
  },
  {
    title: '3. Drill ce qu\'il faut',
    body: 'Une fois l\'analyse finie : exercices SM-2 sur tes erreurs, drill de réflexe blunder, calcul de séquences, répertoire SRS… Le dashboard te dit exactement quoi faire chaque jour.',
  },
  {
    title: '4. Au-delà',
    body: 'Importe un livre PDF, drill des puzzles Lichess, scoute un adversaire chess.com, joue une partie vs Stockfish — appuie sur ? n\'importe où pour les raccourcis.',
  },
]

export default function Onboarding() {
  const [step, setStep] = useState(0)
  const [visible, setVisible] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) !== '1' } catch { return false }
  })

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!visible) return
      if (e.key === 'Escape') finish()
      else if (e.key === 'ArrowRight' || e.key === 'Enter') next()
      else if (e.key === 'ArrowLeft') prev()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!visible) return null

  function finish() {
    try { localStorage.setItem(STORAGE_KEY, '1') } catch { /* noop */ }
    setVisible(false)
  }
  function next() {
    if (step < STEPS.length - 1) setStep(step + 1)
    else finish()
  }
  function prev() {
    if (step > 0) setStep(step - 1)
  }

  const s = STEPS[step]
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70"
    >
      <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-lg shadow-2xl max-w-md w-full">
        <div className="px-5 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
          <span className="text-xs text-neutral-500 uppercase tracking-wider">
            Étape {step + 1} / {STEPS.length}
          </span>
          <button onClick={finish} className="text-neutral-400 hover:text-white text-sm">
            Passer
          </button>
        </div>
        <div className="px-5 py-5">
          <h2 className="text-lg font-semibold mb-2">{s.title}</h2>
          <p className="text-sm text-neutral-300 leading-relaxed">{s.body}</p>
        </div>
        <div className="px-5 py-3 border-t border-[var(--color-border)] flex items-center justify-between">
          <button
            onClick={prev}
            disabled={step === 0}
            className="text-sm px-3 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 disabled:opacity-30"
          >← Précédent</button>
          <div className="flex gap-1">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={`w-1.5 h-1.5 rounded-full ${i === step ? 'bg-[var(--color-accent)]' : 'bg-neutral-700'}`}
              />
            ))}
          </div>
          <button
            onClick={next}
            className="text-sm px-3 py-1.5 rounded bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white"
          >
            {step === STEPS.length - 1 ? 'Démarrer' : 'Suivant →'}
          </button>
        </div>
      </div>
    </div>
  )
}

/** Programmatically replay the tour (e.g. from Settings). */
export function resetOnboarding() {
  localStorage.removeItem(STORAGE_KEY)
  window.location.reload()
}
