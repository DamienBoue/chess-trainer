import { useEffect, useMemo, useRef, useState } from 'react'
import { Chess } from 'chess.js'
import { Chessboard } from 'react-chessboard'
import { playMove, playCapture, playSuccess, playWrong } from '../audio/sounds'

interface WoodpeckerEntry {
  id: string
  chapter: 'easy' | 'intermediate' | 'advanced'
  n: number
  fen: string
  side: 'w' | 'b'
  moves: string[]      // full SAN sequence (user move, opponent move, user move, …)
  line: string         // truncated prose for the post-solution panel
}

type ChapterFilter = 'all' | 'easy' | 'intermediate' | 'advanced'
type Status = 'pending' | 'wrong' | 'in-progress' | 'solved' | 'revealed'

const CHAPTER_LABELS: Record<WoodpeckerEntry['chapter'], string> = {
  easy: 'Faciles',
  intermediate: 'Intermédiaires',
  advanced: 'Avancés',
}

function cleanSan(san: string): string {
  return san.replace(/[!?]+$/, '')
}

// Match a played SAN against an expected SAN, tolerating optional check/mate
// glyphs and !/? annotations.
function sanMatches(played: string, expected: string): boolean {
  const a = cleanSan(played).replace(/[+#]$/, '')
  const b = cleanSan(expected).replace(/[+#]$/, '')
  return a === b
}

export default function WoodpeckerView() {
  const [entries, setEntries] = useState<WoodpeckerEntry[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [chapterFilter, setChapterFilter] = useState<ChapterFilter>('easy')
  const [activeIdx, setActiveIdx] = useState(0)
  const [status, setStatus] = useState<Status>('pending')
  const [position, setPosition] = useState<string>('')
  const [feedback, setFeedback] = useState<string>('')
  const [playedMoves, setPlayedMoves] = useState<string[]>([])
  // Track whether the user has used "show solution" or made a wrong move on
  // this puzzle, so that ultimately solving it the hard way still flags it
  // as "revealed" / "wrong" rather than "solved" cleanly.
  const cleanRunRef = useRef(true)
  const chessRef = useRef<Chess | null>(null)
  const opponentTimerRef = useRef<number | null>(null)

  const [progress, setProgress] = useState<Record<string, 'solved' | 'wrong' | 'revealed'>>(() => {
    try {
      const raw = localStorage.getItem('woodpecker.progress')
      return raw ? JSON.parse(raw) : {}
    } catch { return {} }
  })
  useEffect(() => {
    localStorage.setItem('woodpecker.progress', JSON.stringify(progress))
  }, [progress])

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}woodpecker.json`)
      .then(r => {
        if (!r.ok) throw new Error(`${r.status}`)
        return r.json()
      })
      .then((d: WoodpeckerEntry[]) => setEntries(d))
      .catch(err => setLoadError(String(err)))
  }, [])

  const filtered = useMemo(() => {
    if (!entries) return []
    return chapterFilter === 'all' ? entries : entries.filter(e => e.chapter === chapterFilter)
  }, [entries, chapterFilter])

  const active = filtered[activeIdx] ?? null

  // Reset board state whenever we change exercise.
  useEffect(() => {
    if (!active) return
    if (opponentTimerRef.current) {
      window.clearTimeout(opponentTimerRef.current)
      opponentTimerRef.current = null
    }
    const c = new Chess(active.fen)
    chessRef.current = c
    setPosition(c.fen())
    setStatus('pending')
    setFeedback('')
    setPlayedMoves([])
    cleanRunRef.current = true
  }, [active?.id])

  // Cleanup pending opponent move on unmount.
  useEffect(() => {
    return () => {
      if (opponentTimerRef.current) window.clearTimeout(opponentTimerRef.current)
    }
  }, [])

  // Keyboard nav
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target && (e.target as HTMLElement).tagName === 'INPUT') return
      if (e.key === 'ArrowRight') goNext()
      else if (e.key === 'ArrowLeft') goPrev()
      else if (e.key.toLowerCase() === 'h') reveal()
      else if (e.key.toLowerCase() === 'r') reset()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  function scheduleOpponentMove(idx: number) {
    if (!active || idx >= active.moves.length) return
    opponentTimerRef.current = window.setTimeout(() => {
      if (!chessRef.current || !active) return
      const c = chessRef.current
      const expected = cleanSan(active.moves[idx])
      try {
        const mv = c.move(expected)
        if (mv) {
          setPosition(c.fen())
          setPlayedMoves(prev => [...prev, mv.san])
          if (mv.captured) playCapture(); else playMove()
        }
      } catch {
        // Opponent move parse failed: bail out gracefully.
        setFeedback('La suite jouée par le bouquin n\'est pas applicable ici.')
      }
      opponentTimerRef.current = null
    }, 450)
  }

  function onPieceDrop({ sourceSquare, targetSquare, piece }: {
    sourceSquare: string; targetSquare: string | null; piece: { pieceType: string }
  }): boolean {
    if (!active || !chessRef.current || !targetSquare) return false
    if (status === 'solved' || status === 'revealed') return false

    const c = chessRef.current
    const userIdx = playedMoves.length            // index in active.moves[] of expected user move
    if (userIdx >= active.moves.length) return false
    if (userIdx % 2 !== 0) return false           // not the user's turn

    const promotion = piece.pieceType.endsWith('P') &&
      (targetSquare[1] === '1' || targetSquare[1] === '8') ? 'q' : undefined
    let mv
    try {
      mv = c.move({ from: sourceSquare, to: targetSquare, promotion })
    } catch { return false }
    if (!mv) return false

    const expected = active.moves[userIdx]
    if (!sanMatches(mv.san, expected)) {
      // Wrong move: revert.
      c.undo()
      setStatus('wrong')
      setFeedback(`✗ ${mv.san} — réessaie (H pour la solution)`)
      playWrong()
      cleanRunRef.current = false
      setProgress(prev => prev[active.id] ? prev : { ...prev, [active.id]: 'wrong' })
      return false
    }

    // Correct user move.
    setPosition(c.fen())
    setPlayedMoves(prev => [...prev, mv.san])
    if (mv.captured) playCapture(); else playMove()

    const nextIdx = userIdx + 1
    if (nextIdx >= active.moves.length) {
      // Sequence done.
      setStatus('solved')
      setFeedback(cleanRunRef.current ? '✓ Bravo, séquence complète !' : '✓ Séquence complétée.')
      playSuccess()
      const outcome = cleanRunRef.current ? 'solved' : (progress[active.id] === 'revealed' ? 'revealed' : 'wrong')
      setProgress(prev => ({ ...prev, [active.id]: prev[active.id] === 'solved' ? 'solved' : outcome }))
    } else {
      setStatus('in-progress')
      setFeedback(`✓ ${mv.san} — continue !`)
      // Auto-play opponent's response after a short delay.
      scheduleOpponentMove(nextIdx)
    }
    return true
  }

  function reveal() {
    if (!active || !chessRef.current) return
    if (status === 'solved') return
    if (opponentTimerRef.current) {
      window.clearTimeout(opponentTimerRef.current)
      opponentTimerRef.current = null
    }
    cleanRunRef.current = false
    // Play out the rest of the sequence move-by-move with a short delay.
    const c = chessRef.current
    let idx = playedMoves.length
    setStatus('revealed')
    function step() {
      if (!chessRef.current || !active) return
      if (idx >= active.moves.length) {
        setFeedback('Solution complète révélée.')
        setProgress(prev => ({ ...prev, [active.id]: prev[active.id] === 'solved' ? 'solved' : 'revealed' }))
        return
      }
      const expected = cleanSan(active.moves[idx])
      try {
        const mv = c.move(expected)
        if (mv) {
          setPosition(c.fen())
          setPlayedMoves(prev => [...prev, mv.san])
          if (mv.captured) playCapture(); else playMove()
        }
      } catch {
        setFeedback(`Solution: ${active.moves.slice(playedMoves.length).join(' ')} (non rejouable)`)
        return
      }
      idx++
      opponentTimerRef.current = window.setTimeout(step, 500)
    }
    step()
  }

  function reset() {
    if (!active) return
    if (opponentTimerRef.current) {
      window.clearTimeout(opponentTimerRef.current)
      opponentTimerRef.current = null
    }
    const c = new Chess(active.fen)
    chessRef.current = c
    setPosition(c.fen())
    setStatus('pending')
    setFeedback('')
    setPlayedMoves([])
    cleanRunRef.current = false  // re-attempting after reset doesn't count as clean
  }

  function goNext() {
    if (filtered.length === 0) return
    setActiveIdx(i => Math.min(filtered.length - 1, i + 1))
  }
  function goPrev() {
    setActiveIdx(i => Math.max(0, i - 1))
  }
  function jumpToFirstUnsolved() {
    const idx = filtered.findIndex(e => !progress[e.id] || progress[e.id] === 'wrong')
    if (idx >= 0) setActiveIdx(idx)
  }

  if (loadError) {
    return (
      <div className="p-8 max-w-3xl mx-auto text-red-400">
        Échec du chargement de woodpecker.json : {loadError}
      </div>
    )
  }
  if (!entries) {
    return (
      <div className="p-8 max-w-3xl mx-auto text-neutral-400">
        Chargement des exercices…
      </div>
    )
  }

  const counts = {
    all: entries.length,
    easy: entries.filter(e => e.chapter === 'easy').length,
    intermediate: entries.filter(e => e.chapter === 'intermediate').length,
    advanced: entries.filter(e => e.chapter === 'advanced').length,
  }
  const solvedCount = filtered.filter(e => progress[e.id] === 'solved').length

  // Build a "moves played" display: bold the user moves, dim opponent moves.
  function renderMoveList() {
    if (!active) return null
    const out: React.ReactNode[] = []
    const total = active.moves.length
    for (let i = 0; i < total; i++) {
      const isUser = i % 2 === 0
      const isPlayed = i < playedMoves.length
      const isExpectedNext = i === playedMoves.length && status !== 'solved'
      const san = isPlayed ? playedMoves[i] : (status === 'solved' || status === 'revealed' ? active.moves[i] : '?')
      out.push(
        <span
          key={i}
          className={
            isExpectedNext ? 'px-1.5 py-0.5 rounded bg-[var(--color-accent)]/30 text-white font-mono text-xs' :
            isPlayed && isUser ? 'font-mono text-xs text-green-300' :
            isPlayed ? 'font-mono text-xs text-neutral-300' :
            'font-mono text-xs text-neutral-600'
          }
        >
          {isUser && (i === 0 || (i > 0 && playedMoves.length > 0)) ? '' : ''}{san}
        </span>,
      )
      if (i < total - 1) out.push(<span key={`s${i}`} className="text-neutral-700">·</span>)
    }
    return <div className="flex flex-wrap items-center gap-1">{out}</div>
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-4 flex items-baseline justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-semibold">The Woodpecker Method</h2>
          <p className="text-sm text-neutral-400">
            {entries.length} exercices tactiques d'Axel Smith &amp; Hans Tikkanen, importés depuis le PDF.
          </p>
        </div>
        <div className="text-sm text-neutral-400">
          {solvedCount} / {filtered.length} résolus
        </div>
      </div>

      <div className="mb-3 inline-flex rounded-md border border-[var(--color-border)] bg-[var(--color-panel)] p-0.5 text-sm">
        <ChapterTab active={chapterFilter === 'easy'} onClick={() => { setChapterFilter('easy'); setActiveIdx(0) }} count={counts.easy}>Faciles</ChapterTab>
        <ChapterTab active={chapterFilter === 'intermediate'} onClick={() => { setChapterFilter('intermediate'); setActiveIdx(0) }} count={counts.intermediate}>Intermédiaires</ChapterTab>
        <ChapterTab active={chapterFilter === 'advanced'} onClick={() => { setChapterFilter('advanced'); setActiveIdx(0) }} count={counts.advanced}>Avancés</ChapterTab>
        <ChapterTab active={chapterFilter === 'all'} onClick={() => { setChapterFilter('all'); setActiveIdx(0) }} count={counts.all}>Tous</ChapterTab>
      </div>

      {!active ? (
        <p className="text-neutral-400">Aucun exercice pour ce filtre.</p>
      ) : (
        <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-4">
          <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-4">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div className="text-sm text-neutral-300">
                <span className="font-medium">#{active.n}</span>
                <span className="text-neutral-500 ml-2">({CHAPTER_LABELS[active.chapter]})</span>
                <span className="text-neutral-500 ml-3">
                  {active.side === 'w' ? '⚪ Trait aux blancs' : '⚫ Trait aux noirs'}
                </span>
                <span className="text-neutral-500 ml-3">
                  {active.moves.length}-coup{active.moves.length > 1 ? 's' : ''}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={goPrev} disabled={activeIdx === 0}
                  className="px-2 py-1 text-xs rounded bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40">
                  ← Préc
                </button>
                <button onClick={goNext} disabled={activeIdx >= filtered.length - 1}
                  className="px-2 py-1 text-xs rounded bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40">
                  Suiv →
                </button>
              </div>
            </div>

            <div className="aspect-square max-w-[560px] mx-auto">
              <Chessboard
                options={{
                  position,
                  boardOrientation: active.side === 'w' ? 'white' : 'black',
                  allowDragging: status !== 'solved' && status !== 'revealed',
                  onPieceDrop,
                  id: active.id,
                }}
              />
            </div>

            <div className="mt-3 min-h-[2.5rem] text-sm">
              {feedback ? (
                <div className={
                  status === 'solved' ? 'text-green-400' :
                  status === 'wrong' ? 'text-red-400' :
                  status === 'revealed' ? 'text-orange-300' : 'text-neutral-300'
                }>{feedback}</div>
              ) : (
                <div className="text-neutral-500">Trouve le bon coup ; la suite se joue automatiquement.</div>
              )}
            </div>

            <div className="mt-3">
              {renderMoveList()}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={reset} className="px-3 py-1.5 text-sm rounded bg-neutral-800 hover:bg-neutral-700">
                ↺ Recommencer (R)
              </button>
              <button onClick={reveal} disabled={status === 'solved'}
                className="px-3 py-1.5 text-sm rounded bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40">
                Voir la solution (H)
              </button>
              <button onClick={jumpToFirstUnsolved}
                className="px-3 py-1.5 text-sm rounded bg-neutral-800 hover:bg-neutral-700 ml-auto">
                Aller au prochain non-résolu
              </button>
            </div>
          </div>

          <aside className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-4">
            <h3 className="font-semibold mb-2 text-sm">Continuation</h3>
            {(status === 'solved' || status === 'revealed') ? (
              <div className="text-sm text-neutral-300 whitespace-pre-line leading-relaxed">
                {active.line}
              </div>
            ) : (
              <p className="text-sm text-neutral-500">
                Trouve le bon coup pour révéler la suite. <kbd className="px-1.5 py-0.5 bg-neutral-800 rounded text-xs">H</kbd> solution, <kbd className="px-1.5 py-0.5 bg-neutral-800 rounded text-xs">R</kbd> reset, <kbd className="px-1.5 py-0.5 bg-neutral-800 rounded text-xs">←/→</kbd> nav.
              </p>
            )}
          </aside>
        </div>
      )}
    </div>
  )
}

function ChapterTab({
  children, active, onClick, count,
}: {
  children: React.ReactNode; active: boolean; onClick: () => void; count: number
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded transition-colors flex items-center gap-2 ${
        active ? 'bg-[var(--color-accent)] text-white' : 'text-neutral-300 hover:bg-neutral-800'
      }`}
    >
      <span>{children}</span>
      <span className="text-xs opacity-70">({count})</span>
    </button>
  )
}
