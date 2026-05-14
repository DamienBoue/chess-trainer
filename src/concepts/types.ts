// In-app dictionary of chess concepts: short definitions, curated
// external resources, and positions to explore. Surfaced anywhere the
// app mentions a technical term (motif radar, roadmap modules, plan
// items, study hints).

export type ConceptCategory =
  | 'tactics'      // fork, pin, skewer, mate motifs
  | 'endgame'      // Lucena, Philidor, opposition, technique
  | 'structure'    // IQP, hanging pawns, doubled pawns, …
  | 'opening'      // Italian, Sicilian, French, …
  | 'strategy'     // prophylaxis, two weaknesses, initiative
  | 'mindset'      // checks-captures-threats, time mgmt

export interface ConceptLink {
  label: string
  url: string
  kind: 'wikipedia' | 'lichess' | 'youtube' | 'chesscom' | 'chessable' | 'book' | 'other'
}

export interface ConceptPosition {
  fen: string
  caption?: string
  /** SAN move(s) to play out as a demonstration after Explorer opens. */
  bestSan?: string
  bestLineSan?: string
}

export interface Concept {
  id: string
  title: string
  category: ConceptCategory
  /** 1-2 sentences. Always present — the rest is optional. */
  shortDef: string
  /** Longer text (3-8 sentences). */
  detail?: string
  /** Curated external resources. Limited to stable, reliable URLs. */
  links?: ConceptLink[]
  /** Sample positions to explore in the PositionExplorer modal. */
  positions?: ConceptPosition[]
  /** Cross-references to related concepts (by id). */
  related?: string[]
  /** Aliases (other names this concept is known by) used by lookup. */
  aliases?: string[]
}

export const CATEGORY_LABELS: Record<ConceptCategory, string> = {
  tactics:   'Tactique',
  endgame:   'Finale',
  structure: 'Structure',
  opening:   'Ouverture',
  strategy:  'Stratégie',
  mindset:   'Mental',
}

export const CATEGORY_COLORS: Record<ConceptCategory, string> = {
  tactics:   '#e08e3c',
  endgame:   '#5b88ba',
  structure: '#a8c074',
  opening:   '#c47aee',
  strategy:  '#5fa052',
  mindset:   '#bbbbbb',
}
