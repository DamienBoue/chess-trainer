import { useMemo, useState } from 'react'
import { Chess } from 'chess.js'
import { Chessboard } from 'react-chessboard'
import type { GameAnalysis } from '../types'
import {
  buildRepertoire, topLines, alternativesAt, rollupString,
  critiqueRepertoire, type RepertoireRoot, type RepertoireCritique,
} from '../analysis/repertoire'

interface Props { analyses: GameAnalysis[] }

type Tab = 'lines' | 'critiques' | 'trainer'

export default function RepertoireView({ analyses }: Props) {
  const roots = useMemo(() => buildRepertoire(analyses), [analyses])
  const critiques = useMemo(() => critiqueRepertoire(roots), [roots])
  const [tab, setTab] = useState<Tab>('lines')
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const active = roots.find(r => keyOf(r) === activeKey) ?? roots[0] ?? null

  if (analyses.length < 3) {
    return (
      <div className="p-8 max-w-3xl mx-auto text-neutral-400">
        Analyse au moins 3 parties pour voir ton répertoire émerger (regroupé par ouverture et couleur).
      </div>
    )
  }
  if (roots.length === 0) {
    return (
      <div className="p-8 max-w-3xl mx-auto text-neutral-400">
        Aucune ouverture jouée plus d'une fois pour l'instant.
      </div>
    )
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-baseline justify-between mb-2 flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-semibold">Répertoire</h2>
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
        </div>
      </div>

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
        <CritiquesPanel critiques={critiques} />
      )}

      {tab === 'trainer' && (
        <TrainerPanel roots={roots} />
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

function CritiquesPanel({ critiques }: { critiques: RepertoireCritique[] }) {
  if (critiques.length === 0) {
    return (
      <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-6 text-sm text-neutral-400">
        Aucun mauvais réflexe détecté pour l'instant. Continue à analyser des parties pour que des habitudes se dessinent.
      </div>
    )
  }
  return (
    <div className="space-y-3">
      <p className="text-sm text-neutral-400">
        Des coups que tu joues souvent mais qui méritent d'être étudiés : soit Stockfish n'est pas d'accord (perte cp moyenne élevée), soit ton score y est mauvais.
      </p>
      <ul className="space-y-3">
        {critiques.slice(0, 12).map((c, i) => (
          <li key={i} className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-3">
            <div className="flex items-baseline justify-between gap-3 flex-wrap">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="font-medium">{c.parent}</span>
                <span className={`text-xs px-2 py-0.5 rounded ${c.color === 'white' ? 'bg-neutral-100/10 text-neutral-200' : 'bg-neutral-700/50 text-neutral-300'}`}>
                  {c.color === 'white' ? 'Blancs' : 'Noirs'}
                </span>
                <span className="text-xs text-neutral-500">après {c.oppPrev === '<start>' ? 'le début' : c.oppPrev} · coup {c.ply}</span>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded ${
                c.reason === 'high-cploss' ? 'bg-orange-500/20 text-orange-300'
                : c.reason === 'low-winrate' ? 'bg-red-500/20 text-red-300'
                : 'bg-purple-500/20 text-purple-300'
              }`}>
                {c.reason === 'high-cploss' ? 'Imprécis' : c.reason === 'low-winrate' ? 'Mauvais score' : 'Imprécis + mauvais score'}
              </span>
            </div>
            <div className="mt-2 text-sm">
              Tu joues d'habitude <span className="font-mono text-neutral-100">{c.san}</span> ({c.count}×, {rollupString({ wins: 0, losses: 0, draws: 0 })}…
              <span className="text-neutral-500"> CPL moyen {c.avgCpLoss.toFixed(0)} cp · WR {(c.winRate * 100).toFixed(0)}% sur {c.total} parties</span>).
              {c.engineSuggestion && (
                <div className="text-xs text-neutral-400 mt-1">
                  Stockfish a souvent préféré <span className="font-mono text-green-400">{c.engineSuggestion.san}</span> ({c.engineSuggestion.count}× dans tes parties).
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

interface TrainerState {
  rootKey: string
  // Composite keys ("oppPrev|san") visited so far, deepest last.
  pathKeys: string[]
  currentFen: string
  status: 'pending' | 'wrong' | 'correct' | 'finished'
  feedback: string | null
}

function TrainerPanel({ roots }: { roots: RepertoireRoot[] }) {
  const trainable = useMemo(() => roots.filter(r => r.total >= 2), [roots])
  const [rootKey, setRootKey] = useState<string | null>(trainable[0] ? keyOf(trainable[0]) : null)
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
      pathKeys: [],
      currentFen: startFen,
      status: 'pending',
      feedback: null,
    })
  }

  return (
    <div className="space-y-4">
      <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-3">
        <p className="text-sm text-neutral-300 mb-2">
          Sélectionne une ouverture à drill. L'app jouera les coups d'adversaire que tu as déjà rencontrés et tu dois reproduire ton coup-habituel.
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

  // Most-played user move at the current depth = expected answer.
  const expectedUserMove = useMemo(() => {
    if (currentChildren.size === 0) return null
    const arr = Array.from(currentChildren.entries())
    const total = arr.reduce((s, [, n]) => s + n.count, 0)
    const [composite, top] = arr.reduce((a, b) => (a[1].count >= b[1].count ? a : b))
    const oppPrev = composite.split('|')[0]
    return { san: top.san, oppPrev, count: top.count, total, key: composite, node: top }
  }, [currentChildren])

  function tryMove(from: string, to: string) {
    if (!expectedUserMove || session.status === 'finished') return false
    const c = new Chess(session.currentFen)
    let attempt
    try { attempt = c.move({ from, to, promotion: 'q' }) } catch { return false }
    if (!attempt) return false

    if (attempt.san !== expectedUserMove.san) {
      setSession({
        ...session,
        status: 'wrong',
        feedback: `✗ ${attempt.san} ≠ ton coup habituel ${expectedUserMove.san} (${expectedUserMove.count}/${expectedUserMove.total}).`,
      })
      return false
    }

    // Correct: descend to the matched node, then play the engine's most-likely
    // reply (most-popular opp prefix among the node's children) so the user
    // can be asked the next move.
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
    setSession({
      rootKey: session.rootKey,
      pathKeys: newPathKeys,
      currentFen: nextFen,
      status: finished ? 'finished' : 'correct',
      feedback: finished
        ? `✓ ${attempt.san}. Fin de la ligne mémorisée.`
        : `✓ ${attempt.san} — ton coup habituel. Adversaire joue ${nextOppSan}.`,
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
      <div className="flex justify-center">
        <div className="w-[min(70vw,440px)]">
          <Chessboard
            options={{
              position: session.currentFen,
              boardOrientation: root.color,
              allowDragging: session.status !== 'finished',
              animationDurationInMs: 200,
              darkSquareStyle: { backgroundColor: '#769656' },
              lightSquareStyle: { backgroundColor: '#eeeed2' },
              onPieceDrop: ({ sourceSquare, targetSquare }) => {
                if (!targetSquare) return false
                return tryMove(sourceSquare, targetSquare)
              },
            }}
          />
        </div>
      </div>
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
