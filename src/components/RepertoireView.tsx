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


type TrainerMode = 'habits' | 'improve'

interface TrainerState {
  rootKey: string
  mode: TrainerMode
  // Composite keys ("oppPrev|san") visited so far, deepest last.
  pathKeys: string[]
  currentFen: string
  status: 'pending' | 'wrong' | 'correct' | 'finished'
  feedback: string | null
}

function TrainerPanel({ roots }: { roots: RepertoireRoot[] }) {
  const trainable = useMemo(() => roots.filter(r => r.total >= 2), [roots])
  const [rootKey, setRootKey] = useState<string | null>(trainable[0] ? keyOf(trainable[0]) : null)
  const [mode, setMode] = useState<TrainerMode>('habits')
  const [session, setSession] = useState<TrainerState | null>(null)

  if (trainable.length === 0) {
    return (
      <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-6 text-sm text-neutral-400">
        Pas assez de répétitions pour s'entraîner. Joue (et analyse) au moins 2 parties dans une même ouverture.
      </div>
    )
  }

  function start(key: string) {
    const root = trainable.find(r => keyOf(r) === key)
    if (!root) return
    // Use the first user-node's stored fenBeforeSamples as the starting
    // position; if missing, fall back to the standard initial position.
    const arr = Array.from(root.children.values())
    const top = arr.reduce<typeof arr[number] | null>(
      (a, b) => (!a || b.count > a.count ? b : a), null,
    )
    const startFen = top?.fenBeforeSamples[0]
      ?? 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    setRootKey(key)
    setSession({
      rootKey: key,
      mode,
      pathKeys: [],
      currentFen: startFen,
      status: 'pending',
      feedback: null,
    })
  }

  return (
    <div className="space-y-4">
      <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-3">
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <p className="text-sm text-neutral-300">
            Sélectionne une ouverture à drill. L'app joue l'adversaire ; tu dois trouver le coup attendu à chaque position.
          </p>
          <div className="inline-flex rounded-md border border-[var(--color-border)] bg-neutral-900 p-0.5 text-xs">
            <button
              onClick={() => setMode('habits')}
              className={`px-2 py-1 rounded ${mode === 'habits' ? 'bg-[var(--color-accent)] text-white' : 'text-neutral-300 hover:bg-neutral-800'}`}
              title="Reproduire ton coup le plus joué"
            >
              Habitudes
            </button>
            <button
              onClick={() => setMode('improve')}
              className={`px-2 py-1 rounded ${mode === 'improve' ? 'bg-[var(--color-accent)] text-white' : 'text-neutral-300 hover:bg-neutral-800'}`}
              title="Reproduire le coup recommandé par Stockfish"
            >
              Améliorer
            </button>
          </div>
        </div>
        <p className="text-xs text-neutral-500 mb-3">
          {mode === 'habits'
            ? <>Mode <b>Habitudes</b> : tu dois rejouer ton coup-le-plus-joué à chaque position.</>
            : <>Mode <b>Améliorer</b> : tu dois trouver le coup que Stockfish recommandait dans tes anciennes parties à cette position. Idéal pour corriger les mauvaises habitudes.</>}
        </p>
        <div className="flex flex-wrap gap-2">
          {trainable.map(r => {
            const k = keyOf(r)
            return (
              <button
                key={k}
                onClick={() => start(k)}
                className={`px-3 py-1.5 text-sm rounded border ${
                  session && session.rootKey === k
                    ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10'
                    : 'border-[var(--color-border)] hover:bg-neutral-800'
                }`}
              >
                <span className="text-xs text-neutral-500 mr-1">{r.color === 'white' ? '♔' : '♚'}</span>
                {r.parent} <span className="text-xs text-neutral-500">({r.total})</span>
              </button>
            )
          })}
        </div>
      </div>

      {session && (
        <TrainerBoard
          key={session.rootKey + session.pathKeys.length}
          root={trainable.find(r => keyOf(r) === session.rootKey)!}
          session={session}
          setSession={setSession}
        />
      )}
      {!session && rootKey && (
        <p className="text-sm text-neutral-500">Clique sur "{trainable.find(r => keyOf(r) === rootKey)?.parent}" pour démarrer.</p>
      )}
    </div>
  )
}

function TrainerBoard({
  root, session, setSession,
}: {
  root: RepertoireRoot
  session: TrainerState
  setSession: (s: TrainerState) => void
}) {
  // Resolve the current node + the children to choose from for the user's
  // next move by walking root.children with session.pathKeys.
  const { currentChildren, currentNode } = useMemo(() => {
    let cur: Map<string, import('../analysis/repertoire').RepertoireNode> = root.children
    let last: import('../analysis/repertoire').RepertoireNode | null = null
    for (const k of session.pathKeys) {
      const found = cur.get(k)
      if (!found) return { currentChildren: cur, currentNode: last }
      last = found
      cur = found.children
    }
    return { currentChildren: cur, currentNode: last }
  }, [root, session.pathKeys])

  // The "expected user move" depends on the chosen mode:
  //   - habits: the most-played child = your top habit
  //   - improve: if that habit-child has a more-popular Stockfish suggestion
  //     in past games, expect THAT instead. We only "improve" when SF's
  //     advice differs from the habit; otherwise habit IS the engine pick.
  const expectedUserMove = useMemo(() => {
    if (currentChildren.size === 0) return null
    const arr = Array.from(currentChildren.entries())
    const total = arr.reduce((s, [, n]) => s + n.count, 0)
    const [composite, top] = arr.reduce((a, b) => (a[1].count >= b[1].count ? a : b))
    const oppPrev = composite.split('|')[0]
    let san = top.san
    let isSf = false
    if (session.mode === 'improve' && top.engineSuggestions.size > 0) {
      const [sfSan] = Array.from(top.engineSuggestions.entries())
        .reduce((a, b) => (a[1] >= b[1] ? a : b))
      if (sfSan && sfSan !== top.san) {
        san = sfSan
        isSf = true
      }
    }
    return {
      san, oppPrev,
      count: top.count, total,
      key: composite,
      node: top,
      isSfRecommended: isSf,
      habitualSan: top.san,
    }
  }, [currentChildren, session.mode])

  function tryMove(from: string, to: string) {
    if (!expectedUserMove || session.status === 'finished') return false
    const c = new Chess(session.currentFen)
    let attempt
    try { attempt = c.move({ from, to, promotion: 'q' }) } catch { return false }
    if (!attempt) return false

    if (attempt.san !== expectedUserMove.san) {
      const expectedDescriptor = expectedUserMove.isSfRecommended
        ? `${expectedUserMove.san} (recommandé par Stockfish ; tu joues d'habitude ${expectedUserMove.habitualSan})`
        : `${expectedUserMove.san} (${expectedUserMove.count}/${expectedUserMove.total})`
      setSession({
        ...session,
        status: 'wrong',
        feedback: `✗ ${attempt.san} ≠ ${expectedDescriptor}.`,
      })
      return false
    }

    // Correct: descend through the *habitual* node (so the next position
    // matches the games we have data for) but the user's actual on-board move
    // may differ in 'improve' mode — they played the SF move while we still
    // walk the habit tree. We resolve this by: for the chess-board position,
    // we re-derive from the SF move; for the tree-walk, we still descend the
    // habit child (its children represent how opponents reacted to *your*
    // habitual move historically). Both meet again at the next user-move
    // decision point.
    const newPathKeys = [...session.pathKeys, expectedUserMove.key]
    const matchedNode = expectedUserMove.node
    let nextFen = c.fen()
    let nextOppSan: string | null = null
    if (matchedNode.children.size > 0) {
      const childArr = Array.from(matchedNode.children.entries())
      const [nextComposite] = childArr.reduce((a, b) => (a[1].count >= b[1].count ? a : b))
      const oppCandidate = nextComposite.split('|')[0]
      if (oppCandidate && oppCandidate !== '<start>') {
        const c2 = new Chess(c.fen())
        try {
          const mv = c2.move(oppCandidate)
          if (mv) { nextOppSan = oppCandidate; nextFen = c2.fen() }
        } catch { /* noop */ }
      }
    }

    const finished = matchedNode.children.size === 0 || !nextOppSan
    const correctLabel = expectedUserMove.isSfRecommended
      ? `${attempt.san} — recommandé par Stockfish (au lieu de ton habitude ${expectedUserMove.habitualSan})`
      : `${attempt.san} — ton coup habituel`
    setSession({
      rootKey: session.rootKey,
      mode: session.mode,
      pathKeys: newPathKeys,
      currentFen: nextFen,
      status: finished ? 'finished' : 'correct',
      feedback: finished
        ? `✓ ${attempt.san}. Fin de la ligne mémorisée.`
        : `✓ ${correctLabel}. Adversaire joue ${nextOppSan}.`,
    })
    return true
  }

  function reveal() {
    if (!expectedUserMove) return
    setSession({
      ...session,
      status: 'pending',
      feedback: `Ton coup habituel ici : ${expectedUserMove.san}.`,
    })
  }

  if (!expectedUserMove) {
    return (
      <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-4 text-sm">
        ✓ Tu as parcouru toute la ligne mémorisée pour cette ouverture.
      </div>
    )
  }
  void currentNode  // referenced only to keep the useMemo wired up

  return (
    <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-4 space-y-3">
      <div className="text-sm text-neutral-300">
        {root.parent} — {root.color === 'white' ? 'Blancs' : 'Noirs'} · coup {session.pathKeys.length + 1}
      </div>
      <TrainingBoard
        position={session.currentFen}
        orientation={root.color}
        allowDragging={session.status !== 'finished'}
        maxWidth={440}
        onPieceDrop={({ sourceSquare, targetSquare }) => {
          if (!targetSquare) return false
          return tryMove(sourceSquare, targetSquare)
        }}
      />
      {session.feedback && (
        <div className={`text-sm rounded p-2 ${
          session.status === 'correct' || session.status === 'finished' ? 'text-green-400 bg-green-500/10'
          : session.status === 'wrong' ? 'text-red-400 bg-red-500/10'
          : 'text-neutral-300 bg-neutral-800'
        }`}>{session.feedback}</div>
      )}
      <div className="flex gap-2">
        <button onClick={reveal} className="px-3 py-1 text-sm bg-neutral-800 hover:bg-neutral-700 rounded">
          Indice
        </button>
      </div>
    </div>
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

// ----------------------------------------------------------------------------
// Variation Explorer: walk any position with on-the-fly Stockfish multi-PV
// candidates. Click a candidate move to play it on the board and re-query.
// ----------------------------------------------------------------------------

import { evaluateMultiPV, type EvalLine } from '../engine/multipv'

interface ExplorerProps { roots: RepertoireRoot[] }

interface ExplorerCandidate {
  san: string
  uci: string
  scoreCp: number      // from side-to-move POV
  isMate: boolean
  pvSan: string        // first ~5 plies of the PV in SAN
}

function ExplorerPanel({ roots }: ExplorerProps) {
  // Default starts: one button per root + a "From scratch" button.
  const startOptions = useMemo(() => {
    const list: { label: string; fen: string; orientation: 'white' | 'black' }[] = [
      { label: 'Position de départ (Blancs)', fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', orientation: 'white' },
      { label: 'Position de départ (Noirs)', fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', orientation: 'black' },
    ]
    for (const r of roots.slice(0, 6)) {
      const arr = Array.from(r.children.values())
      const top = arr.reduce<typeof arr[number] | null>(
        (a, b) => (!a || b.count > a.count ? b : a), null,
      )
      if (top?.fenBeforeSamples[0]) {
        list.push({
          label: `${r.parent} (${r.color === 'white' ? 'B' : 'N'})`,
          fen: top.fenBeforeSamples[0],
          orientation: r.color,
        })
      }
    }
    return list
  }, [roots])

  const [history, setHistory] = useState<{ fen: string; san?: string }[]>(
    [{ fen: startOptions[0].fen }],
  )
  const [orientation, setOrientation] = useState<'white' | 'black'>(startOptions[0].orientation)
  const [candidates, setCandidates] = useState<ExplorerCandidate[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [n, setN] = useState(4)
  const currentFen = history[history.length - 1].fen

  // Fetch top-N candidates whenever the current position changes.
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setCandidates(null)
    evaluateMultiPV(currentFen, n, 12, 600)
      .then(lines => {
        if (cancelled) return
        setCandidates(lines.map(l => toCandidate(l, currentFen)).filter((c): c is ExplorerCandidate => !!c))
        setLoading(false)
      })
      .catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [currentFen, n])

  function reset(fen: string, orient: 'white' | 'black') {
    setHistory([{ fen }])
    setOrientation(orient)
  }

  function playUci(uci: string) {
    const c = new Chess(currentFen)
    let mv
    try {
      mv = c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci.length > 4 ? uci.slice(4, 5) : undefined })
    } catch { return }
    if (!mv) return
    setHistory(h => [...h, { fen: c.fen(), san: mv.san }])
  }

  function back() {
    setHistory(h => h.length > 1 ? h.slice(0, -1) : h)
  }

  function manualMove(from: string, to: string): boolean {
    const c = new Chess(currentFen)
    let mv
    try { mv = c.move({ from, to, promotion: 'q' }) } catch { return false }
    if (!mv) return false
    setHistory(h => [...h, { fen: c.fen(), san: mv.san }])
    return true
  }

  return (
    <div className="space-y-4">
      <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-3">
        <p className="text-sm text-neutral-300 mb-2">
          Explore n'importe quelle position : Stockfish te propose ses {n} meilleurs coups avec leurs évals. Clique pour les jouer et continuer la variation. Idéal pour étudier les options théoriques après un coup spécifique de l'adversaire.
        </p>
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-neutral-500 mr-1">Démarrer depuis :</span>
          {startOptions.map((o, i) => (
            <button
              key={i}
              onClick={() => reset(o.fen, o.orientation)}
              className="px-2 py-1 text-xs rounded border border-[var(--color-border)] hover:bg-neutral-800"
            >
              {o.label}
            </button>
          ))}
          <span className="text-xs text-neutral-500 ml-3">Candidats :</span>
          <select
            value={n}
            onChange={e => setN(parseInt(e.target.value, 10))}
            className="bg-neutral-900 border border-[var(--color-border)] rounded px-2 py-1 text-xs"
          >
            <option value={2}>2</option>
            <option value={3}>3</option>
            <option value={4}>4</option>
            <option value={5}>5</option>
          </select>
        </div>
      </div>

      <div className="grid lg:grid-cols-[auto_1fr] gap-4">
        <div className="mx-auto w-full max-w-[440px]">
          <TrainingBoard
            position={currentFen}
            orientation={orientation}
            allowDragging={true}
            maxWidth={440}
            onPieceDrop={({ sourceSquare, targetSquare }) => {
              if (!targetSquare) return false
              return manualMove(sourceSquare, targetSquare)
            }}
          />
          <div className="flex items-center gap-2 mt-2 text-xs">
            <button onClick={back} disabled={history.length <= 1} className="px-2 py-1 bg-neutral-800 rounded disabled:opacity-30">← Retour</button>
            <button onClick={() => setOrientation(o => o === 'white' ? 'black' : 'white')} className="px-2 py-1 bg-neutral-800 rounded">⇅ Flip</button>
            <span className="text-neutral-500 ml-auto">
              {history.length > 1 ? `${history.length - 1} coup${history.length - 1 > 1 ? 's' : ''} joué${history.length - 1 > 1 ? 's' : ''}` : 'Position initiale'}
            </span>
          </div>
        </div>

        <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-3">
          <h4 className="font-semibold text-sm mb-2">Top {n} coups selon Stockfish</h4>
          {loading && !candidates && (
            <p className="text-sm text-neutral-500">Calcul en cours…</p>
          )}
          {candidates && (
            <ul className="space-y-1">
              {candidates.map((c, i) => {
                const evalLabel = formatScore(c.scoreCp, c.isMate)
                const tone = scoreToneFromStm(c.scoreCp, currentFen)
                return (
                  <li key={i}>
                    <button
                      onClick={() => playUci(c.uci)}
                      className="w-full text-left flex items-center gap-2 hover:bg-neutral-800 rounded px-2 py-1.5"
                    >
                      <span className="text-neutral-500 text-xs w-6">#{i + 1}</span>
                      <span className="font-mono text-base">{c.san}</span>
                      <span className={`text-xs font-mono ${tone}`}>{evalLabel}</span>
                      <span className="text-xs text-neutral-500 ml-2 truncate">{c.pvSan}</span>
                    </button>
                  </li>
                )
              })}
              {candidates.length === 0 && (
                <li className="text-sm text-neutral-500">Pas de candidats (position terminale ?)</li>
              )}
            </ul>
          )}

          {history.length > 1 && (
            <>
              <h4 className="font-semibold text-sm mt-4 mb-1">Ligne jouée</h4>
              <div className="text-xs font-mono text-neutral-300">
                {history.slice(1).map((h, i) => (
                  <span key={i}>{i % 2 === 0 ? `${Math.floor(i / 2) + 1}. ` : ''}{h.san} </span>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function toCandidate(line: EvalLine, fen: string): ExplorerCandidate | null {
  if (!line.moveUci) return null
  const c = new Chess(fen)
  let san: string | undefined
  try {
    const mv = c.move({
      from: line.moveUci.slice(0, 2),
      to: line.moveUci.slice(2, 4),
      promotion: line.moveUci.length > 4 ? line.moveUci.slice(4, 5) : undefined,
    })
    san = mv?.san
  } catch { return null }
  if (!san) return null
  // Build SAN PV (best-effort, up to 5 plies)
  let pvSan = ''
  try {
    const c2 = new Chess(fen)
    const sans: string[] = []
    for (const uci of line.pvUci.slice(0, 5)) {
      if (!uci || uci.length < 4) break
      try {
        const mv = c2.move({
          from: uci.slice(0, 2),
          to: uci.slice(2, 4),
          promotion: uci.length > 4 ? uci.slice(4, 5) : undefined,
        })
        if (!mv) break
        sans.push(mv.san)
      } catch { break }
    }
    pvSan = sans.join(' ')
  } catch { /* noop */ }
  return {
    san,
    uci: line.moveUci,
    scoreCp: line.scoreCp,
    isMate: line.isMate,
    pvSan,
  }
}

// Score from side-to-move's POV → human-readable string.
function formatScore(cpStm: number, isMate: boolean): string {
  if (isMate) {
    const mateIn = 100000 - Math.abs(cpStm)
    return cpStm > 0 ? `+M${mateIn}` : `-M${mateIn}`
  }
  const pawns = cpStm / 100
  return (pawns >= 0 ? '+' : '') + pawns.toFixed(2)
}

function scoreToneFromStm(cpStm: number, fen: string): string {
  // Convert STM → white's perspective for the colour scale (positive = white better)
  const stm = fen.split(' ')[1]
  const whitePov = stm === 'w' ? cpStm : -cpStm
  if (Math.abs(whitePov) > 50000) return whitePov > 0 ? 'text-green-400' : 'text-red-400'
  if (whitePov >= 100) return 'text-green-400'
  if (whitePov >= 30) return 'text-green-300'
  if (whitePov >= -30) return 'text-neutral-300'
  if (whitePov >= -100) return 'text-orange-300'
  return 'text-red-400'
}

// Color a CPL value: green (precise), neutral (ok), orange (loose), red (poor).
function qualityColor(cp: number): string {
  if (cp <= 15) return 'text-green-400'
  if (cp <= 35) return 'text-neutral-200'
  if (cp <= 70) return 'text-orange-300'
  return 'text-red-400'
}
