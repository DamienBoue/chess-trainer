import { useEffect, useMemo, useRef, useState } from 'react'
import { Chess } from 'chess.js'
import TrainingBoard from './TrainingBoard'
import EmptyState from './EmptyState'
import type { GameAnalysis } from '../types'
import { extractExercises } from '../analysis/exercises'
import { playSuccess, playWrong } from '../audio/sounds'

interface Props {
  analyses: GameAnalysis[]
  onExit: () => void
}

interface Puzzle {
  id: string
  fen: string
  userColor: 'white' | 'black'
  expectedLine: string[]      // SAN moves, user-side first (we drop opp replies handled implicitly)
  context: { opponent: string; ply: number; moveLabel: string }
  cpSwing: number
}

const MIN_LINE_PLIES = 4

// SAN-ish regex: capture pieces letters + file/rank + optional checks/promotion.
const SAN_RE = /(O-O(?:-O)?[+#]?|[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?[+#]?)/g

function parseUserInput(raw: string): string[] {
  // Strip move numbers ("1.", "1...") then extract SAN tokens.
  const cleaned = raw.replace(/\b\d+\.\.?\.?/g, ' ').replace(/[!?]+/g, '')
  const tokens = cleaned.match(SAN_RE) ?? []
  return tokens
}

function buildPool(analyses: GameAnalysis[]): Puzzle[] {
  const exs = extractExercises(analyses, { minMissedCpLoss: 180, maxPerGame: 3 })
  const out: Puzzle[] = []
  for (const e of exs) {
    if (!e.bestLineSan) continue
    // bestLineSan is the engine's main line as a space-separated SAN string.
    const moves = e.bestLineSan.trim().split(/\s+/).filter(Boolean)
    if (moves.length < MIN_LINE_PLIES) continue
    out.push({
      id: e.id,
      fen: e.fen,
      userColor: e.userColor,
      expectedLine: moves,
      context: e.context,
      cpSwing: e.cpSwing,
    })
  }
  // Bigger cpSwing first — usually the most clear-cut tactics.
  out.sort((a, b) => b.cpSwing - a.cpSwing)
  return out
}

interface AttemptResult {
  played: string[]
  divergedAt: number          // index of first wrong move (length if perfect)
  expected: string[]
  parseFen: string            // FEN reached up to the first wrong move
}

export default function CalcDepthView({ analyses, onExit }: Props) {
  const pool = useMemo(() => buildPool(analyses), [analyses])
  const [idx, setIdx] = useState(0)
  const [input, setInput] = useState('')
  const [result, setResult] = useState<AttemptResult | null>(null)
  const [score, setScore] = useState({ solved: 0, attempts: 0 })
  const inputRef = useRef<HTMLTextAreaElement | null>(null)

  const current = pool[idx] ?? null

  useEffect(() => {
    setInput('')
    setResult(null)
    inputRef.current?.focus()
  }, [current?.id])

  function submit() {
    if (!current || result) return
    const played = parseUserInput(input)
    if (played.length === 0) return
    const expected = current.expectedLine
    const board = new Chess(current.fen)
    let diverge = played.length          // assume perfect
    let lastValidFen = board.fen()
    for (let i = 0; i < played.length; i++) {
      const exp = (expected[i] ?? '').replace(/[+#]+$/, '').replace(/[!?]+$/, '')
      const got = played[i].replace(/[+#]+$/, '').replace(/[!?]+$/, '')
      // Try to apply the user's move first (validate that it's a legal move).
      let mv
      try { mv = board.move(played[i]) }
      catch { mv = null }
      if (!mv) { diverge = i; break }
      lastValidFen = board.fen()
      if (got !== exp) { diverge = i; break }
    }
    const ok = diverge >= Math.min(expected.length, played.length)
      && played.length >= MIN_LINE_PLIES
    setScore(s => ({
      solved: s.solved + (ok ? 1 : 0),
      attempts: s.attempts + 1,
    }))
    if (ok) playSuccess(); else playWrong()
    setResult({ played, divergedAt: diverge, expected, parseFen: lastValidFen })
  }

  function next() {
    setIdx(i => i + 1)
  }

  if (pool.length === 0) {
    return (
      <EmptyState
        icon="🧮"
        title="Pas encore de séquence à calculer"
        description={`Aucune position de ton pool n'a une ligne d'engine ≥${MIN_LINE_PLIES} demi-coups. Les meilleures sources sont les blunders forcés sur lesquels Stockfish a calculé une suite nette.`}
        cta={{ label: '← Retour', onClick: onExit }}
      />
    )
  }
  if (!current) {
    const acc = score.attempts > 0 ? (score.solved / score.attempts) * 100 : 0
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <h2 className="text-2xl font-semibold mb-4">Session terminée</h2>
        <div className="grid grid-cols-3 gap-3 mb-6">
          <Stat label="Résolus" value={score.solved} />
          <Stat label="Tentés" value={score.attempts} />
          <Stat label="Précision" value={`${acc.toFixed(0)}%`} />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setIdx(0); setScore({ solved: 0, attempts: 0 }); setResult(null) }}
            className="flex-1 px-4 py-2 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white rounded-md"
          >Rejouer</button>
          <button onClick={onExit} className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 rounded-md">Sortir</button>
        </div>
      </div>
    )
  }

  const expectedHidden = !result
  const fenToShow = result ? result.parseFen : current.fen

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <button onClick={onExit} className="text-sm text-neutral-400 hover:text-white">← Sortir</button>
        <div className="text-sm">
          <span className="font-mono text-green-300">{score.solved}</span>
          <span className="text-neutral-500"> / {score.attempts} · puzzle {idx + 1}/{pool.length}</span>
        </div>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_360px] gap-4">
        <div className="mx-auto w-full max-w-[500px]">
          <TrainingBoard
            position={fenToShow}
            orientation={current.userColor}
            allowDragging={false}
            id={current.id}
            maxWidth={500}
          />
          <div className="mt-2 text-xs text-neutral-500 text-center">
            {result
              ? 'Position atteinte après tes coups corrects.'
              : `Visualise ${current.expectedLine.length} demi-coups dans ta tête. Trait aux ${current.userColor === 'white' ? 'Blancs' : 'Noirs'}.`}
          </div>
        </div>

        <aside className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-4 space-y-3">
          <h3 className="font-semibold text-sm">Calcul en tête</h3>
          <p className="text-xs text-neutral-400 leading-relaxed">
            Écris la séquence en notation algébrique : le tien, puis la réponse adverse, ton suivant, etc.
            Séparé par des espaces ou des virgules. Les annotations <code>!?</code> sont ignorées.
          </p>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            disabled={!!result}
            placeholder="ex: 1.Rxh2+ Kxh2 2.Rh8#"
            rows={3}
            className="w-full px-3 py-2 bg-neutral-900 border border-[var(--color-border)] rounded font-mono text-sm focus:outline-none focus:border-[var(--color-accent)] disabled:opacity-50"
            onKeyDown={e => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submit()
            }}
          />
          {!result && (
            <button
              onClick={submit}
              disabled={!input.trim()}
              className="w-full px-3 py-2 text-sm rounded bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white disabled:opacity-40"
            >Vérifier (Ctrl+Entrée)</button>
          )}

          {result && (
            <ResultPanel result={result} onNext={next} hasNext={idx + 1 < pool.length} />
          )}

          {expectedHidden && (
            <p className="text-[10px] text-neutral-500 mt-3">
              Indice contexte : {current.context.moveLabel} vs {current.context.opponent}.
              Pas le droit de bouger les pièces.
            </p>
          )}
        </aside>
      </div>
    </div>
  )
}

function ResultPanel({
  result, onNext, hasNext,
}: {
  result: AttemptResult; onNext: () => void; hasNext: boolean
}) {
  const correctCount = Math.min(result.divergedAt, result.played.length)
  const expectedLen = result.expected.length
  const isPerfect = result.divergedAt >= result.played.length && result.played.length >= expectedLen

  return (
    <div className={`p-3 rounded text-sm space-y-2 ${
      isPerfect
        ? 'bg-green-900/30 border border-green-700/50 text-green-200'
        : 'bg-orange-900/30 border border-orange-700/50 text-orange-200'
    }`}>
      <div className="font-bold">
        {isPerfect ? '✓ Calcul parfait !' : `${correctCount} / ${expectedLen} demi-coups corrects`}
      </div>
      <div className="text-xs">
        <div className="text-neutral-400 mb-1">Tu as écrit :</div>
        <div className="font-mono break-words">
          {result.played.map((m, i) => (
            <span key={i} className={
              i < result.divergedAt ? 'text-green-300 mr-1' : 'text-red-300 mr-1'
            }>{m}</span>
          ))}
        </div>
      </div>
      <div className="text-xs">
        <div className="text-neutral-400 mb-1">Ligne attendue :</div>
        <div className="font-mono break-words">
          {result.expected.map((m, i) => (
            <span key={i} className={
              i < result.divergedAt ? 'text-green-300 mr-1'
              : i === result.divergedAt ? 'text-yellow-300 mr-1 font-bold underline'
              : 'text-neutral-400 mr-1'
            }>{m}</span>
          ))}
        </div>
      </div>
      <button
        onClick={onNext}
        className="w-full px-3 py-1.5 text-sm rounded bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white"
      >{hasNext ? 'Suivant →' : 'Voir le bilan'}</button>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-3 text-center">
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-neutral-500">{label}</div>
    </div>
  )
}
