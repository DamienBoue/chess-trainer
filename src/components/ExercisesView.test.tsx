import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import ExercisesView from './ExercisesView'
import { buildGame, sampleCorpus } from '../analysis/__fixtures__'
import { extractExercises } from '../analysis/exercises'
import type { ExerciseProgress } from '../storage/persist'

// TrainingBoard requires real DOM measurement (react-chessboard).
vi.mock('./TrainingBoard', () => ({
  default: () => <div data-testid="training-board" />,
}))
vi.mock('../audio/sounds', () => ({
  playForMove: () => {}, playSuccess: () => {}, playWrong: () => {},
}))

afterEach(cleanup)

describe('ExercisesView', () => {
  it('shows the empty state when no analyses exist', () => {
    render(
      <ExercisesView
        analyses={[]}
        progress={{}}
        onAttempt={() => {}}
      />,
    )
    expect(screen.getByText(/Pas encore d'exercices/)).toBeTruthy()
  })

  it("exposes a CTA that fires onGoToGames in the empty state", () => {
    const go = vi.fn()
    render(
      <ExercisesView
        analyses={[]}
        progress={{}}
        onAttempt={() => {}}
        onGoToGames={go}
      />,
    )
    fireEvent.click(screen.getByText(/Voir mes parties/))
    expect(go).toHaveBeenCalled()
  })

  it('shows the "no key move detected" state when analyses produce 0 exercises', () => {
    // All moves are book/best with 0 cpLoss → no exercise extracted.
    const games = [
      buildGame({
        userColor: 'white', opponent: 'bob',
        moves: [
          { ply: 1, san: 'e4', cpLoss: 0, classification: 'book' },
          { ply: 3, san: 'Nf3', cpLoss: 0, classification: 'best' },
        ],
      }),
    ]
    render(
      <ExercisesView
        analyses={games}
        progress={{}}
        onAttempt={() => {}}
      />,
    )
    expect(screen.getByText(/Aucun coup-clé détecté/)).toBeTruthy()
  })

  it('renders the heading and the filter pills when exercises exist', () => {
    render(
      <ExercisesView
        analyses={sampleCorpus()}
        progress={{}}
        onAttempt={() => {}}
      />,
    )
    expect(screen.getByText('Exercices')).toBeTruthy()
    expect(screen.getByText(/À réviser/)).toBeTruthy()
    expect(screen.getByText(/Jamais vus/)).toBeTruthy()
    expect(screen.getByText(/Toutes catégories/)).toBeTruthy()
    expect(screen.getByText(/Difficulté/)).toBeTruthy()
  })

  it('switches the category filter on click', () => {
    render(
      <ExercisesView
        analyses={sampleCorpus()}
        progress={{}}
        onAttempt={() => {}}
      />,
    )
    const all = screen.getByText(/Toutes catégories/)
    // The pill becomes a different style when active. We just verify clicking
    // it doesn't crash and that the heading is still there.
    fireEvent.click(all)
    expect(screen.getByText('Exercices')).toBeTruthy()
  })

  it('export button is disabled when the filtered list is empty', () => {
    // Build analyses with a blunder, then filter to "Déjà réussis" with no
    // progress — should produce 0 filtered exercises.
    render(
      <ExercisesView
        analyses={sampleCorpus()}
        progress={{}}
        onAttempt={() => {}}
      />,
    )
    fireEvent.click(screen.getByText(/Déjà réussis/))
    const exportBtn = screen.getByText(/Export Lichess/) as HTMLButtonElement
    expect(exportBtn.disabled).toBe(true)
  })
})

// ─── Layout: filter chips, navigation row, phone disclosure ───────────────

const DEFAULT_SUMMARY = 'À réviser · Toutes catégories · Toutes difficultés'

function progressFor(over: Partial<ExerciseProgress> = {}): ExerciseProgress {
  return {
    attempts: 1, successes: 1, failures: 0, lastFirstTry: true,
    lastSeenAt: Date.now(), nextDueAt: Date.now() + 3 * 86_400_000, easeFactor: 2.5,
    ...over,
  }
}

// jsdom has no matchMedia: left alone, the view renders its wide-screen layout.
// This stub answers the one query the view asks (Tailwind's `sm` breakpoint,
// `(min-width: 40rem)`) and returns a function that "resizes" the viewport.
function stubViewport(startAsPhone: boolean) {
  let phone = startAsPhone
  const listeners = new Set<() => void>()
  vi.stubGlobal('matchMedia', (media: string) => ({
    media,
    get matches() { return !phone },
    addEventListener: (_type: string, listener: () => void) => { listeners.add(listener) },
    removeEventListener: (_type: string, listener: () => void) => { listeners.delete(listener) },
  }))
  return (nextIsPhone: boolean) => {
    phone = nextIsPhone
    act(() => { listeners.forEach(l => l()) })
  }
}

function renderView(props: Partial<React.ComponentProps<typeof ExercisesView>> = {}) {
  const analyses = sampleCorpus()
  const exercises = extractExercises(analyses)
  const utils = render(
    <ExercisesView analyses={analyses} progress={{}} onAttempt={() => {}} {...props} />,
  )
  return { exercises, ...utils }
}

describe('ExercisesView filter chips', () => {
  it('shows a count on every chip, including "Toutes" in the difficulty row', () => {
    const { exercises } = renderView()
    const difficulty = screen.getByRole('group', { name: 'Difficulté' })
    expect(within(difficulty).getByRole('button', { name: `Toutes (${exercises.length})` })).toBeTruthy()
    for (const [label, key] of [['Facile', 'easy'], ['Moyen', 'medium'], ['Difficile', 'hard']] as const) {
      const n = exercises.filter(e => e.difficulty === key).length
      expect(within(difficulty).getByRole('button', { name: `${label} (${n})` })).toBeTruthy()
    }
    // No chip is left with an empty "()" count.
    expect(screen.queryByText(/\(\)/)).toBeNull()
  })

  it('counts each status and category over the whole pool', () => {
    const analyses = sampleCorpus()
    const exercises = extractExercises(analyses)
    render(
      <ExercisesView
        analyses={analyses}
        progress={{ [exercises[0].id]: progressFor() }}
        onAttempt={() => {}}
      />,
    )
    const n = exercises.length
    expect(screen.getByRole('button', { name: `À réviser (${n - 1})` })).toBeTruthy()
    expect(screen.getByRole('button', { name: `Jamais vus (${n - 1})` })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Déjà réussis (1)' })).toBeTruthy()
    expect(screen.getByRole('button', { name: `Tous (${n})` })).toBeTruthy()
    expect(screen.getByRole('button', { name: `Toutes catégories (${n})` })).toBeTruthy()
  })

  it('flags the selected chip with aria-pressed', () => {
    renderView()
    expect(screen.getByRole('button', { name: /À réviser/, pressed: true })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Jamais vus/ }))
    expect(screen.getByRole('button', { name: /Jamais vus/, pressed: true })).toBeTruthy()
    expect(screen.getByRole('button', { name: /À réviser/, pressed: false })).toBeTruthy()
  })
})

describe('ExercisesView exercise navigation', () => {
  it('walks the filtered list with the labelled arrow buttons', () => {
    const { exercises } = renderView()
    const n = exercises.length
    expect(screen.getByText(`Exercice 1 / ${n}`)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Exercice suivant' }))
    expect(screen.getByText(`Exercice 2 / ${n}`)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Exercice précédent' }))
    expect(screen.getByText(`Exercice 1 / ${n}`)).toBeTruthy()
    // Previous wraps around to the last exercise.
    fireEvent.click(screen.getByRole('button', { name: 'Exercice précédent' }))
    expect(screen.getByText(`Exercice ${n} / ${n}`)).toBeTruthy()
  })

  it('keeps previous / counter / share / next on one non-wrapping row of 40px-tall targets', () => {
    renderView()
    const prev = screen.getByRole('button', { name: 'Exercice précédent' })
    const next = screen.getByRole('button', { name: 'Exercice suivant' })
    const share = screen.getByRole('button', { name: 'Partager cet exercice' })
    expect(prev.parentElement).toBe(next.parentElement)
    expect(prev.parentElement!.className).not.toMatch(/flex-wrap/)
    expect(prev.parentElement!.contains(share)).toBe(true)
    for (const button of [prev, next, share]) {
      expect(button.className).toMatch(/\bmin-h-10\b/)
      expect(button.getAttribute('title')).toBeTruthy()
    }
  })

  it('copies a share link and announces it', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    try {
      renderView()
      fireEvent.click(screen.getByRole('button', { name: 'Partager cet exercice' }))
      expect(writeText).toHaveBeenCalledTimes(1)
      expect(writeText.mock.calls[0][0]).toContain('#share?')
      await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Lien copié'))
    } finally {
      delete (navigator as { clipboard?: unknown }).clipboard
    }
  })
})

describe('ExercisesView on a phone', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('puts the title row and one "Filtres" line above the board, chips collapsed', () => {
    stubViewport(true)
    const { exercises } = renderView()
    expect(screen.getByText('Exercices')).toBeTruthy()
    expect(screen.getByText(`${exercises.length} au total`)).toBeTruthy()
    // The long description is a wide-screen luxury.
    expect(screen.queryByText(/Trouve le bon coup/)).toBeNull()

    const toggle = screen.getByRole('button', { name: /^Filtres/ })
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(within(toggle).getByText(DEFAULT_SUMMARY)).toBeTruthy()
    expect(within(toggle).getByText(`${exercises.length} exercices`)).toBeTruthy()

    // Chips are not rendered (so not in the accessibility tree either).
    expect(screen.queryByRole('group', { name: 'Statut' })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Jamais vus/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Toutes catégories/ })).toBeNull()
    // ...but the exercise is right there.
    expect(screen.getByText(/Exercice 1 \//)).toBeTruthy()
    expect(screen.getByTestId('training-board')).toBeTruthy()
  })

  it('reveals the chip rows when opened and hides them again when closed', () => {
    stubViewport(true)
    renderView()
    const toggle = screen.getByRole('button', { name: /^Filtres/ })

    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    const panel = document.getElementById(toggle.getAttribute('aria-controls')!)!
    expect(panel).toBeTruthy()
    for (const name of ['Statut', 'Catégorie', 'Difficulté']) {
      expect(within(panel).getByRole('group', { name })).toBeTruthy()
    }
    expect(within(panel).getByRole('button', { name: /Jamais vus/ })).toBeTruthy()
    expect(within(panel).getByRole('button', { name: /Défense trouvée/ })).toBeTruthy()

    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('button', { name: /Jamais vus/ })).toBeNull()
  })

  it('keeps the summary and the count in sync with the chosen chips', () => {
    stubViewport(true)
    const analyses = sampleCorpus()
    const exercises = extractExercises(analyses)
    // One exercise already solved (and not due again for days).
    render(
      <ExercisesView
        analyses={analyses}
        progress={{ [exercises[0].id]: progressFor() }}
        onAttempt={() => {}}
      />,
    )
    const toggle = screen.getByRole('button', { name: /^Filtres/ })
    expect(within(toggle).getByText(`${exercises.length - 1} exercices`)).toBeTruthy()

    fireEvent.click(toggle)
    fireEvent.click(screen.getByRole('button', { name: /Déjà réussis/ }))
    expect(within(toggle).getByText('Déjà réussis · Toutes catégories · Toutes difficultés')).toBeTruthy()
    expect(within(toggle).getByText('1 exercice')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /^Tous \(/ }))
    fireEvent.click(screen.getByRole('button', { name: /Coup raté/ }))
    expect(within(toggle).getByText('Tous statuts · Coup raté · Toutes difficultés')).toBeTruthy()

    const difficultyKey = exercises[0].difficulty
    const difficultyLabel = { easy: 'Facile', medium: 'Moyen', hard: 'Difficile' }[difficultyKey]
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${difficultyLabel} \\(`) }))
    expect(within(toggle).getByText(`Tous statuts · Coup raté · ${difficultyLabel}`)).toBeTruthy()
    const expected = exercises.filter(e => e.category === 'missed' && e.difficulty === difficultyKey).length
    expect(within(toggle).getByText(`${expected} exercice${expected > 1 ? 's' : ''}`)).toBeTruthy()

    // The summary survives closing the panel.
    fireEvent.click(toggle)
    expect(within(toggle).getByText(`Tous statuts · Coup raté · ${difficultyLabel}`)).toBeTruthy()
  })

  it('moves the Lichess export into the filters panel', () => {
    stubViewport(true)
    renderView()
    expect(screen.queryByText(/Export Lichess/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /^Filtres/ }))
    const exportBtn = screen.getByText(/Export Lichess/) as HTMLButtonElement
    expect(exportBtn.disabled).toBe(false)
    // Nothing solved yet: exporting the "Déjà réussis" selection is pointless.
    fireEvent.click(screen.getByRole('button', { name: /Déjà réussis/ }))
    expect((screen.getByText(/Export Lichess/) as HTMLButtonElement).disabled).toBe(true)
  })

  it('shows an active motif in the summary and lets the panel remove it', () => {
    stubViewport(true)
    renderView({ initialMotif: 'fork' })
    const toggle = screen.getByRole('button', { name: /^Filtres/ })
    expect(within(toggle).getByText(`${DEFAULT_SUMMARY} · Motif : Fourchette`)).toBeTruthy()
    fireEvent.click(toggle)
    fireEvent.click(screen.getByRole('button', { name: /Retirer le filtre motif/ }))
    expect(within(toggle).getByText(DEFAULT_SUMMARY)).toBeTruthy()
  })

  it('follows the viewport: no disclosure on a wide screen, and the open state survives', () => {
    const setPhone = stubViewport(true)
    renderView()
    fireEvent.click(screen.getByRole('button', { name: /^Filtres/ }))
    expect(screen.getByRole('group', { name: 'Statut' })).toBeTruthy()

    setPhone(false)
    expect(screen.queryByRole('button', { name: /^Filtres/ })).toBeNull()
    expect(screen.getByRole('group', { name: 'Statut' })).toBeTruthy()
    expect(screen.getByText(/Trouve le bon coup/)).toBeTruthy()
    expect((screen.getByText(/Export Lichess/) as HTMLButtonElement).disabled).toBe(false)

    setPhone(true)
    const toggle = screen.getByRole('button', { name: /^Filtres/ })
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
  })
})

describe('ExercisesView on a wide screen', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('keeps every chip row expanded, with the export in the header', () => {
    stubViewport(false)
    renderView()
    expect(screen.queryByRole('button', { name: /^Filtres/ })).toBeNull()
    for (const name of ['Statut', 'Catégorie', 'Difficulté']) {
      expect(screen.getByRole('group', { name })).toBeTruthy()
    }
    expect(screen.getByText(/Trouve le bon coup/)).toBeTruthy()
    expect(screen.getByText(/Export Lichess/)).toBeTruthy()
  })
})
