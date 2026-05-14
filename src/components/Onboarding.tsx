// First-visit guided tour.
//
// 5 simple cards shown over the home screen until the user dismisses
// or finishes. State stored in localStorage so we never nag again.

import { useEffect, useState } from 'react'

const STORAGE_KEY = 'chess.onboarding.completed'

const STEPS: Array<{ title: string; body: string }> = [
  {
    title: 'Bienvenue 👋',
    body: 'Chess Trainer importe tes parties chess.com, les analyse 100% en local avec Stockfish, et te génère un programme d\'entraînement personnalisé adapté à ton niveau.',
  },
  {
    title: '1. Importe tes parties',
    body: 'Saisis ton pseudo chess.com sur l\'accueil. Les 20 dernières parties sont chargées. Tu peux aussi coller un PGN si tu joues ailleurs.',
  },
  {
    title: '2. Lance l\'analyse',
    body: 'Dans Parties, clique "Tout analyser". Stockfish tourne dans ton navigateur (1-2 min pour 10 parties). Rien n\'est envoyé à un serveur.',
  },
  {
    title: '3. Suis le Plan du jour',
    body: 'Après l\'analyse, l\'accueil devient ton Plan du jour : 10-15 min de SRS, drills par motif raté, erreur récurrente, trou du répertoire. Adapté à ton palier Elo (onglet "Mon niveau").',
  },
  {
    title: '4. Lab d\'ouverture + Concepts',
    body: 'Compare ply à ply ce que tu joues vs les maîtres (Répertoire → 🔬 Opening Lab). Et 53 fiches concepts (fork, IQP, Lucena, en passant…) accessibles via Étudier → Concepts ou les chips 📖 partout dans l\'app.',
  },
  {
    title: '5. Optionnel : coach IA',
    body: 'Préférences → colle une clé Anthropic ou OpenAI pour activer "Expliquer ce coup" sur tes blunders et "Revue de partie" sur tes analyses. La clé reste dans ton navigateur, jamais envoyée à un serveur tiers. Appuie sur ? n\'importe où pour les raccourcis.',
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
