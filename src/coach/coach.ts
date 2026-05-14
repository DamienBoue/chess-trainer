// High-level "coach" functions that call the configured LLM with
// pre-built chess prompts. Views call these — they don't construct
// prompts themselves.

import type { GameAnalysis, MoveAnalysis } from '../types'
import type { PlanItem } from '../analysis/plan'
import type { SkillBracket } from '../skill/elo'
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

/** Coach review of an entire analysed game — phase where the user
 *  bled, critical turning points, one concrete recommendation. */
export async function reviewGame(
  analysis: GameAnalysis,
  opts: { signal?: AbortSignal } = {},
): Promise<string> {
  const cfg = loadLlmConfig()
  const userIsWhite = analysis.userColor === 'white'
  const blunders = analysis.moves
    .filter(m => (m.ply % 2 === 1) === userIsWhite)
    .filter(m => m.classification === 'blunder' || m.classification === 'mistake')
    .sort((a, b) => b.cpLoss - a.cpLoss)
    .slice(0, 3)
  const blunderLines = blunders.map(m =>
    `- coup ${Math.ceil(m.ply / 2)}${m.ply % 2 === 1 ? '.' : '...'} ${m.san} (${m.classification}, -${m.cpLoss}cp). Engine voulait ${m.bestMoveSan}${m.bestLineSan ? ' (' + m.bestLineSan + ')' : ''}.`,
  ).join('\n')

  const opening = analysis.opening ? `Ouverture : ${analysis.opening}.` : ''
  const totalMoves = analysis.moves.length
  const userBlunders = analysis.moves.filter(m => (m.ply % 2 === 1) === userIsWhite && m.classification === 'blunder').length
  const userMistakes = analysis.moves.filter(m => (m.ply % 2 === 1) === userIsWhite && m.classification === 'mistake').length

  const prompt = [
    `Partie analysée : tu joues les ${userIsWhite ? 'Blancs' : 'Noirs'} contre ${analysis.opponent}${analysis.opponentRating ? ` (${analysis.opponentRating})` : ''}.`,
    opening,
    `Résultat : ${analysis.result}. ${totalMoves} demi-coups joués. ${userBlunders} gaffes + ${userMistakes} erreurs côté joueur.`,
    '',
    blunders.length > 0 ? `Erreurs principales (depuis Stockfish) :\n${blunderLines}` : 'Aucune grosse erreur — partie propre.',
    '',
    `Rédige une revue de partie en 4-6 phrases courtes :`,
    `1. La phase où le joueur a le plus souffert (et pourquoi).`,
    `2. Le moment charnière (un seul, choisi parmi les erreurs ci-dessus).`,
    `3. UNE recommandation concrète d'entraînement pour la prochaine fois.`,
    `Pas de flatterie ni de remplissage.`,
  ].filter(Boolean).join('\n')

  return complete(cfg, SYSTEM_COACH, prompt, { maxTokens: 600, signal: opts.signal })
}

/** A 2-3 sentence "today's focus" framing for the daily plan. */
export async function summariseDailyPlan(
  items: PlanItem[],
  bracket: SkillBracket,
  opts: { signal?: AbortSignal } = {},
): Promise<string> {
  const cfg = loadLlmConfig()
  const lines = items.map((it, i) =>
    `${i + 1}. [${it.kind}] ${it.title} — ${it.subtitle} (priorité ${it.priority}, ~${it.estMinutes} min)`,
  ).join('\n')
  const prompt = [
    `Palier du joueur : ${bracket.label} (${bracket.min}-${bracket.max}).`,
    `Plan calculé automatiquement pour aujourd'hui (trié par priorité décroissante) :`,
    lines,
    '',
    `Rédige une mise en bouche de 2-3 phrases en français pour ce joueur.`,
    `Désigne UN axe prioritaire (en justifiant pourquoi vu son palier),`,
    `et finis par une mini-règle d'attitude à garder pendant la session.`,
  ].join('\n')
  return complete(cfg, SYSTEM_COACH, prompt, { maxTokens: 300, signal: opts.signal })
}

