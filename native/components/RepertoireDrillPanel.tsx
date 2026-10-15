// "S'entraîner" tab of the repertoire. The website has two tabs (Trainer,
// SRS); on a phone they are folded: "Révisions" (spaced repetition, one due
// card at a time) and "Une ligne" (walk one opening, the app plays the
// opponent). Both share the Habitudes / Améliorer mode.
import { useMemo, useState } from 'react'
import { View } from 'react-native'
import { Chess } from 'chess.js'
import {
  enumerateDrillCards, type DrillCard, type RepertoireNode, type RepertoireRoot,
} from '@shared/analysis/repertoire'
import {
  isDue, loadRepertoireProgress, saveRepertoireProgress, updateProgressAfterAttempt, type ExerciseProgress,
} from '@shared/storage/persist'
import Board from '@/components/Board'
import {
  OpeningChips, OpeningFeedback, OpeningSegments, useOpeningBoardSize,
} from '@/components/OpeningKit'
import { rootKeyOf } from '@/components/RepertoireLinesPanel'
import { Button, Card, T } from '@/components/ui'

type Mode = 'habits' | 'improve'
type Part = 'srs' | 'line'
const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const strip = (san: string) => san.replace(/[+#]$/, '')

/** Plays from → to on a position (queen promotion); null when illegal. */
function playMove(fen: string, from: string, to: string): { san: string; fen: string } | null {
  try {
    const c = new Chess(fen)
    const mv = c.move({ from, to, promotion: 'q' })
    return mv ? { san: mv.san, fen: c.fen() } : null
  } catch { return null }
}

export default function RepertoireDrillPanel({ roots }: { roots: RepertoireRoot[] }) {
  const [part, setPart] = useState<Part>('srs')
  const [mode, setMode] = useState<Mode>('habits')
  return (
    <View style={{ gap: 12 }}>
      <OpeningSegments
        value={part}
        onChange={setPart}
        options={[{ key: 'srs', label: 'Révisions' }, { key: 'line', label: 'Une ligne' }]}
      />
      <OpeningSegments
        value={mode}
        onChange={setMode}
        options={[{ key: 'habits', label: 'Habitudes' }, { key: 'improve', label: 'Améliorer' }]}
      />
      <T tone="faint" style={{ fontSize: 12 }}>
        {mode === 'habits'
          ? 'Mode Habitudes : rejoue ton coup le plus joué à chaque position.'
          : 'Mode Améliorer : trouve le coup que Stockfish recommandait dans tes anciennes parties à cette position.'}
      </T>
      {part === 'srs' ? <SrsDrill roots={roots} mode={mode} /> : <LineDrill roots={roots} mode={mode} />}
    </View>
  )
}

// ---------------------------------------------------------------------------
// Spaced repetition: each decision point of the habit tree is a card.
// ---------------------------------------------------------------------------

interface Attempt { id: string; fen: string; status: 'pending' | 'wrong' | 'correct'; feedback: string; revealed: boolean }

function SrsDrill({ roots, mode }: { roots: RepertoireRoot[]; mode: Mode }) {
  const size = useOpeningBoardSize(true)
  const allCards = useMemo(() => enumerateDrillCards(roots, { mode }), [roots, mode])
  const [progress, setProgress] = useState<Record<string, ExerciseProgress>>(() => loadRepertoireProgress())
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [attempt, setAttempt] = useState<Attempt | null>(null)

  function commit(next: Record<string, ExerciseProgress>) {
    setProgress(next)
    saveRepertoireProgress(next)
  }

  const due = useMemo(() => allCards.filter(c => isDue(progress[c.id])), [allCards, progress])
  // Oldest due first, then shallower decisions (foundations).
  const pick = (): DrillCard | null => [...due].sort((a, b) => {
    const da = progress[a.id]?.nextDueAt ?? 0
    const db = progress[b.id]?.nextDueAt ?? 0
    return da !== db ? da - db : a.depth - b.depth
  })[0] ?? null

  let current = allCards.find(c => c.id === currentId) ?? null
  // No card yet (or the mode changed): pick one during render so it shows in the same commit.
  if (!current && due.length > 0) {
    current = pick()
    if (current) setCurrentId(current.id)
  }
  const att = current && attempt?.id === current.id ? attempt : null
  const fen = att?.fen ?? current?.fen ?? START_FEN
  const status = att?.status ?? 'pending'

  if (allCards.length === 0) {
    return <Card><T tone="muted">Pas assez de répétitions dans le répertoire pour générer des révisions. Analyse au moins 2-3 parties dans une même ouverture.</T></Card>
  }
  const seen = Object.keys(progress).filter(k => allCards.some(c => c.id === k)).length

  function onMove(from: string, to: string): boolean {
    if (!current || status === 'correct') return false
    const mv = playMove(fen, from, to)
    if (!mv) return false
    if (strip(mv.san) === strip(current.expectedSan)) {
      const revealed = att?.revealed ?? false
      setAttempt({ id: current.id, fen: mv.fen, status: 'correct', revealed, feedback: revealed ? `✓ ${mv.san} (révélé).` : `✓ ${mv.san}.` })
      commit({ ...progress, [current.id]: updateProgressAfterAttempt(progress[current.id], revealed ? 'after-retry' : 'first-try') })
      return true
    }
    setAttempt({ id: current.id, fen, status: 'wrong', revealed: att?.revealed ?? false, feedback: `✗ ${mv.san} ≠ ${current.expectedSan}.` })
    return false
  }

  return (
    <View style={{ gap: 12 }}>
      <T tone="muted">
        <T tone="win" style={{ fontWeight: '700' }}>{due.length}</T> dus / {allCards.length} cartes · {seen} déjà vues
      </T>
      {!current ? (
        <Card><T tone="muted">✓ Tu as fini la file. Reviens demain pour les prochaines révisions, ou change de mode.</T></Card>
      ) : (
        <Card style={{ gap: 10 }}>
          <T tone="strong" style={{ fontWeight: '600' }}>{current.rootParent}</T>
          <T tone="faint" style={{ fontSize: 12 }}>
            {current.rootColor === 'white' ? '♔ Blancs' : '♚ Noirs'} · coup {current.depth} · {current.count} parties observées
            {current.isSfRecommended ? ' · Correction SF' : ''}
          </T>
          <View style={{ alignItems: 'center' }}>
            <Board key={current.id} fen={fen} size={size} orientation={current.rootColor} onMove={status === 'correct' ? undefined : onMove} />
          </View>
          <OpeningFeedback status={status} text={att?.feedback ?? null} />
          {status === 'correct' ? (
            <Button label={`Suivant (${Math.max(0, due.length - 1)} restant${due.length - 1 > 1 ? 's' : ''})`} onPress={() => { setCurrentId(null); setAttempt(null) }} />
          ) : (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button
                label="Révéler" kind="secondary" style={{ flex: 1 }} disabled={att?.revealed}
                onPress={() => setAttempt({ id: current!.id, fen, status: 'pending', revealed: true, feedback: `Coup attendu : ${current!.expectedSan}. Joue-le sur l'échiquier pour valider.` })}
              />
              <Button
                label="Passer" kind="secondary" style={{ flex: 1 }}
                onPress={() => { commit({ ...progress, [current!.id]: updateProgressAfterAttempt(progress[current!.id], 'failed') }); setCurrentId(null); setAttempt(null) }}
              />
            </View>
          )}
        </Card>
      )}
    </View>
  )
}

// ---------------------------------------------------------------------------
// One line: pick an opening, the app plays the opponent, you answer.
// ---------------------------------------------------------------------------

interface LineSession {
  rootKey: string
  mode: Mode
  /** Composite keys ("oppPrev|san") visited so far, deepest last. */
  pathKeys: string[]
  fen: string
  status: 'pending' | 'wrong' | 'correct' | 'finished'
  feedback: string | null
}

function LineDrill({ roots, mode }: { roots: RepertoireRoot[]; mode: Mode }) {
  const trainable = useMemo(() => roots.filter(r => r.total >= 2), [roots])
  const [session, setSession] = useState<LineSession | null>(null)
  if (trainable.length === 0) {
    return <Card><T tone="muted">Pas assez de répétitions pour s'entraîner. Joue (et analyse) au moins 2 parties dans une même ouverture.</T></Card>
  }
  const root = session ? trainable.find(r => rootKeyOf(r) === session.rootKey) : undefined

  function start(key: string) {
    const r = trainable.find(x => rootKeyOf(x) === key)
    if (!r) return
    const top = Array.from(r.children.values()).reduce<RepertoireNode | null>((a, b) => (!a || b.count > a.count ? b : a), null)
    setSession({ rootKey: key, mode, pathKeys: [], fen: top?.fenBeforeSamples[0] ?? START_FEN, status: 'pending', feedback: null })
  }

  return (
    <View style={{ gap: 12 }}>
      <T tone="muted">Choisis une ouverture. L'app joue l'adversaire, tu dois trouver le coup attendu à chaque position.</T>
      <OpeningChips
        items={trainable.map(r => ({ key: rootKeyOf(r), label: `${r.color === 'white' ? '♔' : '♚'} ${r.parent}`, badge: `(${r.total})` }))}
        activeKey={session?.rootKey ?? null}
        onPick={start}
      />
      {session && root && <LineBoard key={session.rootKey + session.mode + session.pathKeys.length} root={root} session={session} setSession={setSession} />}
    </View>
  )
}

function LineBoard({ root, session, setSession }: { root: RepertoireRoot; session: LineSession; setSession: (s: LineSession) => void }) {
  const size = useOpeningBoardSize(true)
  // Walk the tree along the visited path to find the user's next choices.
  const children = useMemo(() => {
    let cur: Map<string, RepertoireNode> = root.children
    for (const k of session.pathKeys) {
      const found = cur.get(k)
      if (!found) break
      cur = found.children
    }
    return cur
  }, [root, session.pathKeys])

  // Habits: the most played child. Improve: Stockfish's most frequent
  // suggestion when it differs from the habit (the tree still descends the
  // habit child, whose children are how opponents reacted to it).
  const expected = useMemo(() => {
    if (children.size === 0) return null
    const arr = Array.from(children.entries())
    const total = arr.reduce((acc, [, n]) => acc + n.count, 0)
    const [key, top] = arr.reduce((a, b) => (a[1].count >= b[1].count ? a : b))
    let san = top.san
    let isSf = false
    if (session.mode === 'improve' && top.engineSuggestions.size > 0) {
      const [sf] = Array.from(top.engineSuggestions.entries()).reduce((a, b) => (a[1] >= b[1] ? a : b))
      if (sf && sf !== top.san) { san = sf; isSf = true }
    }
    return { san, key, node: top, count: top.count, total, isSf, habitual: top.san }
  }, [children, session.mode])

  if (!expected) return <Card><T tone="muted">✓ Tu as parcouru toute la ligne mémorisée pour cette ouverture.</T></Card>

  function onMove(from: string, to: string): boolean {
    if (!expected || session.status === 'finished') return false
    const mv = playMove(session.fen, from, to)
    if (!mv) return false
    if (mv.san !== expected.san) {
      const what = expected.isSf
        ? `${expected.san} (recommandé par Stockfish ; tu joues d'habitude ${expected.habitual})`
        : `${expected.san} (${expected.count}/${expected.total})`
      setSession({ ...session, status: 'wrong', feedback: `✗ ${mv.san} ≠ ${what}.` })
      return false
    }
    let nextFen = mv.fen
    let oppSan: string | null = null
    if (expected.node.children.size > 0) {
      const [nextKey] = Array.from(expected.node.children.entries()).reduce((a, b) => (a[1].count >= b[1].count ? a : b))
      const opp = nextKey.split('|')[0]
      if (opp && opp !== '<start>') {
        try {
          const c2 = new Chess(mv.fen)
          if (c2.move(opp)) { oppSan = opp; nextFen = c2.fen() }
        } catch { /* line no longer playable */ }
      }
    }
    const finished = expected.node.children.size === 0 || !oppSan
    const label = expected.isSf ? `${mv.san}, recommandé par Stockfish (au lieu de ${expected.habitual})` : `${mv.san}, ton coup habituel`
    setSession({
      ...session,
      pathKeys: [...session.pathKeys, expected.key],
      fen: nextFen,
      status: finished ? 'finished' : 'correct',
      feedback: finished ? `✓ ${mv.san}. Fin de la ligne mémorisée.` : `✓ ${label}. Adversaire joue ${oppSan}.`,
    })
    return true
  }

  return (
    <Card style={{ gap: 10 }}>
      <T tone="strong" style={{ fontWeight: '600' }}>{root.parent} · {root.color === 'white' ? 'Blancs' : 'Noirs'} · coup {session.pathKeys.length + 1}</T>
      <View style={{ alignItems: 'center' }}>
        <Board fen={session.fen} size={size} orientation={root.color} onMove={session.status === 'finished' ? undefined : onMove} />
      </View>
      <OpeningFeedback status={session.status} text={session.feedback} />
      <Button
        label="Indice" kind="secondary"
        onPress={() => setSession({ ...session, status: 'pending', feedback: `${expected.isSf ? 'Coup recommandé' : 'Ton coup habituel'} ici : ${expected.san}.` })}
      />
    </Card>
  )
}
