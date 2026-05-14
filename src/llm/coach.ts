// High-level "coach" functions that call the configured LLM with
// pre-built chess prompts. Views call these — they don't construct
// prompts themselves.

import type { GameAnalysis, MoveAnalysis } from '../types'
import { complete } from './client'
import { isLlmEnabled, loadLlmConfig } from './config'

const SYSTEM_COACH = [
  'Tu es un entraîneur d\'échecs francophone, concis et précis.',
  'Quand tu expliques un coup, parle de la position concrète : pièces, cases, menaces.',
  'Pas de remplissage. Une réponse tient en 3-6 phrases courtes.',
  'Quand tu cites un coup, utilise la notation algébrique (e.g. Nf3, Bxh6).',
  'Si la position est tactique, nomme le motif (fourchette, clouage, déviation, mat).',
].join(' ')

export function llmAvailable(): boolean {
  return isLlmEnabled(loadLlmConfig())
}

/** Explain why a given move was a blunder (or mistake) and what the engine wanted instead. */
export async function explainBlunder(
  analysis: GameAnalysis,
  move: MoveAnalysis,
  opts: { signal?: AbortSignal } = {},
): Promise<string> {
  const cfg = loadLlmConfig()
  const userColor = analysis.userColor === 'white' ? 'Blancs' : 'Noirs'
  const opening = analysis.opening ? `Ouverture : ${analysis.opening}. ` : ''
  const prompt = [
    `Position FEN : ${move.fenBefore}`,
    `Trait aux ${move.ply % 2 === 1 ? 'Blancs' : 'Noirs'}.`,
    `${opening}Je joue les ${userColor}.`,
    `J'ai joué : ${move.san} (classification "${move.classification}", cpLoss ${move.cpLoss}).`,
    move.bestMoveSan ? `L'engine voulait : ${move.bestMoveSan}.` : '',
    move.bestLineSan ? `Ligne principale du moteur : ${move.bestLineSan}.` : '',
    '',
    'Explique en 3-5 phrases :',
    '1. Pourquoi mon coup est mauvais (concrètement, sur quelle pièce/case).',
    '2. Ce que veut faire l\'engine et le motif tactique/stratégique sous-jacent.',
    '3. Une règle générale à retenir pour ne pas refaire cette erreur.',
  ].filter(Boolean).join('\n')

  return complete(cfg, SYSTEM_COACH, prompt, { maxTokens: 500, signal: opts.signal })
}
