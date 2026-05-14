import { useEffect, useMemo, useState } from 'react'
import { Chess } from 'chess.js'
import TrainingBoard from './TrainingBoard'
import type { GameAnalysis } from '../types'
import {
  buildRepertoire, topLines, alternativesAt, rollupString,
  critiqueRepertoire, enumerateDrillCards,
  type RepertoireRoot, type DrillCard,
} from '../analysis/repertoire'
import HolesPanel from './HolesPanel'
import CritiquesPanel from './CritiquesPanel'
import ExplorerPanel from './ExplorerPanel'
import TrainerPanel from './TrainerPanel'
import {
  loadRepertoireProgress, saveRepertoireProgress,
  updateProgressAfterAttempt, isDue,
  type ExerciseProgress,
} from '../storage/persist'
import EmptyState from './EmptyState'
import { tryUserMove } from '../utils/move'

interface Props {
  analyses: GameAnalysis[]
  onGoToGames?: () => void
  onOpenLab?: () => void
}

type Tab = 'lines' | 'critiques' | 'trainer' | 'srs' | 'explorer'

export default function RepertoireView({ analyses, onGoToGames, onOpenLab }: Props) {
  const roots = useMemo(() => buildRepertoire(analyses), [analyses])
  const critiques = useMemo(() => critiqueRepertoire(roots), [roots])
  const [tab, setTab] = useState<Tab>('lines')
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const active = roots.find(r => keyOf(r) === activeKey) ?? roots[0] ?? null

  if (analyses.length < 3) {
    return (
      <EmptyState
        icon="📖"
        title="Pas encore de répertoire"
        description={`Le répertoire émerge de tes parties analysées (regroupées par ouverture parent + couleur). Il te faut au moins 3 parties (tu en as ${analyses.length}).`}
        cta={onGoToGames ? { label: 'Voir mes parties', onClick: onGoToGames } : undefined}
      />
    )
  }
  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-baseline justify-between mb-2 flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-semibold flex items-center gap-2 flex-wrap">
            Répertoire
            {onOpenLab && (
              <button
                onClick={onOpenLab}
                className="text-xs px-2 py-0.5 rounded bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 border border-purple-500/30"
                title="Comparer tes lignes aux masters"
              >🔬 Opening Lab</button>
            )}
          </h2>
          <p className="text-sm text-neutral-400">
            Tes lignes principales par ouverture, construites à partir des parties analysées.
          </p>
        </div>
        <div className="inline-flex rounded-md border border-[var(--color-border)] bg-[var(--color-panel)] p-0.5 text-sm">
          <TabBtn active={tab === 'lines'} onClick={() => setTab('lines')}>Lignes</TabBtn>
          <TabBtn active={tab === 'critiques'} onClick={() => setTab('critiques')}>
            Critiques {critiques.length > 0 && `(${critiques.length})`}
          </TabBtn>
          <TabBtn active={tab === 'trainer'} onClick={() => setTab('trainer')}>Trainer</TabBtn>
          <TabBtn active={tab === 'srs'} onClick={() => setTab('srs')}>SRS</TabBtn>
          <TabBtn active={tab === 'explorer'} onClick={() => setTab('explorer')}>Explorer</TabBtn>
        </div>
      </div>

      {roots.length === 0 && (
        <div className="p-8 text-neutral-400">
          Aucune ouverture jouée plus d'une fois pour ce filtre.
        </div>
      )}
      {roots.length > 0 && (
        <>

      {tab === 'lines' && (
        <div className="grid lg:grid-cols-[300px_1fr] gap-4">
          <aside className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-3 max-h-[80vh] overflow-auto">
            <h3 className="text-sm font-semibold text-neutral-300 mb-2">Ouvertures</h3>
            <ul className="space-y-1">
              {roots.map(r => {
                const k = keyOf(r)
                return (
                  <li key={k}>
                    <button
                      onClick={() => setActiveKey(k)}
                      className={`w-full text-left px-2 py-1.5 rounded text-sm transition-colors ${
                        active && keyOf(active) === k ? 'bg-[var(--color-accent)] text-white' : 'hover:bg-neutral-800 text-neutral-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${r.color === 'white' ? 'bg-neutral-100' : 'bg-neutral-700 border border-neutral-500'}`} />
                        <span className="flex-1 truncate">{r.parent}</span>
                        <span className="text-xs text-neutral-500">{r.total}×</span>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          </aside>

          {active ? (
            <RootDetail key={keyOf(active)} root={active} />
          ) : null}
        </div>
      )}

      {tab === 'critiques' && (
        <>
          <HolesPanel roots={roots} />
          <CritiquesPanel critiques={critiques} />
        </>
      )}

      {tab === 'trainer' && (
        <TrainerPanel roots={roots} />
      )}

      {tab === 'srs' && (
        <SrsPanel roots={roots} />
      )}

      {tab === 'explorer' && (
        <ExplorerPanel roots={roots} />
      )}
        </>
      )}
    </div>
  )
}

function TabBtn({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded transition-colors ${
        active ? 'bg-[var(--color-accent)] text-white' : 'text-neutral-300 hover:bg-neutral-800'
      }`}
    >
      {children}
    </button>
  )
}



// ---------------------------------------------------------------------------
// Spaced-repetition panel.
// Walks the user's habit tree, turns each decision point into a "card", and
// schedules reviews via the existing SM-2 helpers.
// ---------------------------------------------------------------------------

type SrsMode = 'habits' | 'improve'

function SrsPanel({ roots }: { roots: RepertoireRoot[] }) {
  const [mode, setMode] = useState<SrsMode>('habits')
  const allCards = useMemo(() => enumerateDrillCards(roots, { mode }), [roots, mode])
  const [progress, setProgress] = useState<Record<string, ExerciseProgress>>(() => loadRepertoireProgress())
  useEffect(() => { saveRepertoireProgress(progress) }, [progress])

  const due = useMemo(() => allCards.filter(c => isDue(progress[c.id])), [allCards, progress])
  const [current, setCurrent] = useState<DrillCard | null>(null)
  const [status, setStatus] = useState<'pending' | 'wrong' | 'correct'>('pending')
  const [feedback, setFeedback] = useState<string>('')
  const [position, setPosition] = useState<string>('')
  const [revealed, setRevealed] = useState(false)

  // Pick a card when the queue changes (and we don't have one yet).
  useEffect(() => {
    if (current) return
    pickNext()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [due.length, current])

  // Reset on mode change.
  useEffect(() => {
    setCurrent(null); setStatus('pending'); setFeedback(''); setRevealed(false)
  }, [mode])

  function pickNext() {
    if (due.length === 0) { setCurrent(null); return }
    // Order: oldest-due first, then shallower decisions first (foundations).
    const sorted = [...due].sort((a, b) => {
      const da = progress[a.id]?.nextDueAt ?? 0
      const db = progress[b.id]?.nextDueAt ?? 0
      if (da !== db) return da - db
      return a.depth - b.depth
    })
    const next = sorted[0]
    setCurrent(next)
    setPosition(next.fen)
    setStatus('pending')
    setFeedback('')
    setRevealed(false)
  }

  function onPieceDrop({ sourceSquare, targetSquare, piece }: {
    sourceSquare: string; targetSquare: string | null; piece: { pieceType: string }
  }): boolean {
    if (!current || status === 'correct') return false
    const c = new Chess(position)
    const mv = tryUserMove(c, { sourceSquare, targetSquare, piece })
    if (!mv) return false
    if (mv.san.replace(/[+#]$/, '') === current.expectedSan.replace(/[+#]$/, '')) {
      setPosition(c.fen())
      setStatus('correct')
      setFeedback(revealed ? `✓ ${mv.san} — révélé.` : `✓ ${mv.san}.`)
      const outcome = revealed ? 'after-retry' : 'first-try'
      setProgress(prev => ({ ...prev, [current.id]: updateProgressAfterAttempt(prev[current.id], outcome) }))
      return true
    }
    // Wrong: undo and signal.
    c.undo()
    setStatus('wrong')
    setFeedback(`✗ ${mv.san} ≠ ${current.expectedSan}.`)
    return false
  }

  function reveal() {
    if (!current) return
    setRevealed(true)
    setFeedback(`Coup attendu : ${current.expectedSan}. Joue-le sur l'échiquier pour valider.`)
  }

  function skip() {
    if (!current) return
    setProgress(prev => ({ ...prev, [current.id]: updateProgressAfterAttempt(prev[current.id], 'failed') }))
    setCurrent(null)  // useEffect picks the next due card
  }

  function nextCard() {
    setCurrent(null)
  }

  const stats = useMemo(() => {
    const seen = Object.keys(progress).filter(k => allCards.some(c => c.id === k)).length
    const total = allCards.length
    const dueNow = due.length
    return { seen, total, dueNow }
  }, [progress, allCards, due])

  if (allCards.length === 0) {
    return (
      <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-6 text-sm text-neutral-400">
        Pas assez de répétitions dans le répertoire pour générer un drill SRS. Analyse au moins 2-3 parties dans une même ouverture.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-3 flex flex-wrap items-center gap-3 justify-between">
        <div className="text-sm text-neutral-300">
          <span className="font-mono text-green-300">{stats.dueNow}</span>
          <span className="text-neutral-500"> dus / {stats.total} cartes · </span>
          <span className="text-neutral-400">{stats.seen} déjà vues</span>
        </div>
        <div className="inline-flex rounded-md border border-[var(--color-border)] bg-neutral-900 p-0.5 text-xs">
          <button
            onClick={() => setMode('habits')}
            className={`px-2 py-1 rounded ${mode === 'habits' ? 'bg-[var(--color-accent)] text-white' : 'text-neutral-300 hover:bg-neutral-800'}`}
          >Habitudes</button>
          <button
            onClick={() => setMode('improve')}
            className={`px-2 py-1 rounded ${mode === 'improve' ? 'bg-[var(--color-accent)] text-white' : 'text-neutral-300 hover:bg-neutral-800'}`}
            title="Drille les corrections recommandées par Stockfish au lieu de tes habitudes"
          >Améliorer</button>
        </div>
      </div>

      {!current ? (
        <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-6 text-sm text-neutral-300">
          ✓ Tu as fini la file. Reviens demain pour les prochaines révisions, ou change de mode.
        </div>
      ) : (
        <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-4 space-y-3">
          <div className="text-sm text-neutral-300 flex flex-wrap items-baseline gap-2">
            <span className="font-semibold">{current.rootParent}</span>
            <span className="text-neutral-500 text-xs">
              {current.rootColor === 'white' ? '♔ Blancs' : '♚ Noirs'} · coup {current.depth} · {current.count} parties observées
            </span>
            {current.isSfRecommended && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-blue-900/40 text-blue-300">SF correction</span>
            )}
          </div>
          <TrainingBoard
            position={position}
            orientation={current.rootColor}
            allowDragging={status !== 'correct'}
            maxWidth={440}
            onPieceDrop={onPieceDrop}
            id={current.id}
          />
          <div className="min-h-[1.5rem] text-sm">
            {feedback && (
              <span className={
                status === 'correct' ? 'text-green-400' :
                status === 'wrong' ? 'text-red-400' : 'text-neutral-300'
              }>{feedback}</span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {status === 'correct' ? (
              <button
                onClick={nextCard}
                className="px-3 py-1.5 text-sm rounded bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white"
              >Suivant ({stats.dueNow - 1} restant{stats.dueNow - 1 > 1 ? 's' : ''})</button>
            ) : (
              <>
                <button
                  onClick={reveal}
                  disabled={revealed}
                  className="px-3 py-1.5 text-sm rounded bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40"
                >Révéler</button>
                <button
                  onClick={skip}
                  className="px-3 py-1.5 text-sm rounded bg-neutral-800 hover:bg-neutral-700"
                  title="Marque comme échec et passe à la suivante"
                >Passer</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function RootDetail({ root }: { root: RepertoireRoot }) {
  const main = useMemo(() => topLines(root, 8), [root])
  const [openAt, setOpenAt] = useState<number | null>(null)

  return (
    <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-4 space-y-4">
      <div>
        <h3 className="font-semibold text-lg">{root.parent}</h3>
        <p className="text-xs text-neutral-500">
          {root.total} partie{root.total > 1 ? 's' : ''} avec les {root.color === 'white' ? 'Blancs' : 'Noirs'}
        </p>
      </div>

      <div>
        <h4 className="text-sm font-medium text-neutral-300 mb-1">Ligne principale (la plus jouée à chaque coup)</h4>
        <p className="text-xs text-neutral-500 mb-2">
          Tes coups habituels — pas forcément les meilleurs. Le code couleur signale la qualité moyenne (CPL) selon Stockfish.
        </p>
        <ol className="space-y-1">
          {main.moves.length === 0 && <li className="text-sm text-neutral-500">Pas assez de données.</li>}
          {main.moves.map((m, i) => {
            const path = main.moves.slice(0, i + 1).map(x => x.san)
            const alts = alternativesAt(root, path).filter(a => a.san !== m.san)
            const isOpen = openAt === i
            const cpColor = qualityColor(m.avgCpLoss)
            const stockfishDisagrees = !!m.engineSuggestion && m.engineSuggestion.san !== m.san
            return (
              <li key={i} className="text-sm">
                <button
                  className="w-full text-left flex items-center gap-2 hover:bg-neutral-800/50 rounded px-2 py-1"
                  onClick={() => setOpenAt(isOpen ? null : i)}
                >
                  <span className="text-neutral-500 w-7 text-right">{i + 1}.</span>
                  <span className={`font-mono ${cpColor}`}>{m.san}</span>
                  <span className="text-xs text-neutral-500">×{m.count}</span>
                  <span className="text-xs text-neutral-500">{rollupString({ wins: m.w, losses: m.l, draws: m.d })}</span>
                  <span className={`text-xs ${cpColor}`} title="CPL moyen sur tes parties — plus bas = plus précis">
                    ⌀ {m.avgCpLoss.toFixed(0)} cp
                  </span>
                  {stockfishDisagrees && (
                    <span className="text-xs text-orange-300" title={`Stockfish a préféré ${m.engineSuggestion!.san} ${m.engineSuggestion!.count}× dans tes parties`}>
                      ⚠ SF préfère {m.engineSuggestion!.san}
                    </span>
                  )}
                  {alts.length > 0 && (
                    <span className="text-xs text-blue-400 ml-auto">
                      {isOpen ? '▾' : '▸'} {alts.length} alternative{alts.length > 1 ? 's' : ''}
                    </span>
                  )}
                </button>
                {isOpen && alts.length > 0 && (
                  <ul className="ml-12 mt-1 space-y-1">
                    {alts.slice(0, 6).map(a => {
                      const aCp = a.count > 0 ? a.cpLossSum / a.count : 0
                      return (
                        <li key={a.san} className="flex items-baseline gap-2 text-xs text-neutral-400">
                          <span className={`font-mono ${qualityColor(aCp)}`}>{a.san}</span>
                          <span className="text-neutral-500">×{a.count}</span>
                          <span className="text-neutral-500">{rollupString(a)}</span>
                          <span className={`${qualityColor(aCp)}`}>⌀ {aCp.toFixed(0)} cp</span>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}

function keyOf(r: RepertoireRoot): string { return `${r.parent}::${r.color}` }


// Color a CPL value: green (precise), neutral (ok), orange (loose), red (poor).
function qualityColor(cp: number): string {
  if (cp <= 15) return 'text-green-400'
  if (cp <= 35) return 'text-neutral-200'
  if (cp <= 70) return 'text-orange-300'
  return 'text-red-400'
}
