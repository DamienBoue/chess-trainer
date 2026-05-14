// Repertoire trainer: pick an opening, the app plays opponent moves, you
// must replay your most-played response (habits mode) or the Stockfish-
// recommended alternative (improve mode). Extracted from RepertoireView.

import { useMemo, useState } from 'react'
import { Chess } from 'chess.js'
import TrainingBoard from './TrainingBoard'
import type { RepertoireRoot, RepertoireNode } from '../analysis/repertoire'

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

function keyOf(r: RepertoireRoot): string { return `${r.parent}::${r.color}` }

export default function TrainerPanel({ roots }: { roots: RepertoireRoot[] }) {
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
    let cur: Map<string, RepertoireNode> = root.children
    let last: RepertoireNode | null = null
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
