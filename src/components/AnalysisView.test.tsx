import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import AnalysisView from './AnalysisView'
import type { StockfishEngine } from '../engine/stockfish'
import { fakeAnalysis, fakeChessComGame as fakeGame } from '../test-utils/fixtures'

afterEach(cleanup)

// A stub engine that never gets called because existingAnalysis is set.
const stubEngine = {} as StockfishEngine

describe('AnalysisView (existing analysis)', () => {
  it('renders the back button and exports button', () => {
    const onBack = vi.fn()
    render(
      <AnalysisView
        engine={stubEngine}
        username="alice"
        game={fakeGame()}
        existingAnalysis={fakeAnalysis(['e4', 'e5', 'Nf3'])}
        allAnalyses={[]}
        onAnalysisComplete={() => {}}
        onBack={onBack}
      />,
    )
    expect(screen.getByText(/Retour aux parties/i)).toBeTruthy()
    expect(screen.getByText(/Export PGN annoté/i)).toBeTruthy()
  })

  it('Retour button calls onBack', () => {
    const onBack = vi.fn()
    render(
      <AnalysisView
        engine={stubEngine}
        username="alice"
        game={fakeGame()}
        existingAnalysis={fakeAnalysis(['e4'])}
        allAnalyses={[]}
        onAnalysisComplete={() => {}}
        onBack={onBack}
      />,
    )
    fireEvent.click(screen.getByText(/Retour aux parties/i))
    expect(onBack).toHaveBeenCalled()
  })

  it('renders the Summary, Overview and Évaluation sections', () => {
    render(
      <AnalysisView
        engine={stubEngine}
        username="alice"
        game={fakeGame()}
        existingAnalysis={fakeAnalysis(['e4', 'e5', 'Nf3', 'Nc6'])}
        allAnalyses={[]}
        onAnalysisComplete={() => {}}
        onBack={() => {}}
      />,
    )
    expect(screen.getByText('Résumé')).toBeTruthy()
    expect(screen.getByText("Vue d'ensemble")).toBeTruthy()
    expect(screen.getByText('Évaluation')).toBeTruthy()
    expect(screen.getByText('Liste des coups')).toBeTruthy()
  })

  it('shows the opponent + opening in overview', () => {
    render(
      <AnalysisView
        engine={stubEngine}
        username="alice"
        game={fakeGame()}
        existingAnalysis={fakeAnalysis(['e4', 'e5'])}
        allAnalyses={[]}
        onAnalysisComplete={() => {}}
        onBack={() => {}}
      />,
    )
    expect(screen.getAllByText(/bob/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Italian Game/).length).toBeGreaterThan(0)
  })
})

describe('AnalysisView (loading)', () => {
  it('shows the "Analyse en cours" copy when no existing analysis', () => {
    // existingAnalysis = null triggers the analysis effect. The engine stub
    // doesn't actually do anything; the loading copy is rendered before
    // any data arrives.
    render(
      <AnalysisView
        engine={stubEngine}
        username="alice"
        game={fakeGame()}
        existingAnalysis={null}
        allAnalyses={[]}
        onAnalysisComplete={() => {}}
        onBack={() => {}}
      />,
    )
    expect(screen.getByText(/Analyse en cours/i)).toBeTruthy()
  })
})
