import { useEffect, useMemo, useRef, useState } from 'react'
import { Chess } from 'chess.js'
import { Chessboard } from 'react-chessboard'
import type { Book, BookExercise, BookProgress, ExerciseOutcome } from '../library/types'
import { getBook, getProgress, recordOutcome } from '../library/storage'
import { playMove, playCapture, playSuccess, playWrong } from '../audio/sounds'
import BookRushView from './BookRushView'

type Status = 'pending' | 'wrong' | 'in-progress' | 'solved' | 'revealed'

interface Props {
  bookId: string
  onBack: () => void
}

function cleanSan(san: string): string {
  return san.replace(/[!?]+$/, '')
}

function sanMatches(played: string, expected: string): boolean {
  const a = cleanSan(played).replace(/[+#]$/, '')
  const b = cleanSan(expected).replace(/[+#]$/, '')
  return a === b
}

export default function BookView({ bookId, onBack }: Props) {
  const [book, setBook] = useState<Book | null>(null)
  const [progress, setProgress] = useState<BookProgress | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [subMode, setSubMode] = useState<'browse' | 'rush'>('browse')

  useEffect(() => {
    let alive = true
    Promise.all([getBook(bookId), getProgress(bookId)])
      .then(([b, p]) => {
        if (!alive) return
        if (!b) {
          setLoadError(`Livre introuvable : ${bookId}`)
        } else {
          setBook(b)
          setProgress(p)
        }
      })
      .catch(e => alive && setLoadError(String(e)))
    return () => { alive = false }
  }, [bookId])

  if (loadError) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <button onClick={onBack} className="text-sm text-neutral-400 hover:text-white mb-4">← Bibliothèque</button>
        <p className="text-red-400">{loadError}</p>
      </div>
    )
  }
  if (!book || !progress) {
    return <div className="p-8 max-w-3xl mx-auto text-neutral-400">Chargement…</div>
  }

  if (subMode === 'rush') {
    return (
      <BookRushView
        book={book}
        progress={progress}
        onProgressChange={setProgress}
        onExit={() => setSubMode('browse')}
      />
    )
  }

  return (
    <BrowseMode
      book={book}
      progress={progress}
      onProgressChange={setProgress}
      onBack={onBack}
      onStartRush={() => setSubMode('rush')}
    />
  )
}

interface BrowseProps {
  book: Book
  progress: BookProgress
  onProgressChange: (p: BookProgress) => void
  onBack: () => void
  onStartRush: () => void
}

function BrowseMode({ book, progress, onProgressChange, onBack, onStartRush }: BrowseProps) {
  // Optional chapter filter, auto-detected from BookExercise.chapter.
  const chapters = useMemo(() => {
    const set = new Set<string>()
    for (const e of book.exercises) if (e.chapter) set.add(e.chapter)
    return Array.from(set)
  }, [book])
  const [chapterFilter, setChapterFilter] = useState<string>('all')

  const filtered = useMemo(() => {
    if (chapterFilter === 'all') return book.exercises
    return book.exercises.filter(e => e.chapter === chapterFilter)
  }, [book, chapterFilter])

  const [activeIdx, setActiveIdx] = useState(0)
  const active = filtered[activeIdx] ?? null

  const [status, setStatus] = useState<Status>('pending')
  const [position, setPosition] = useState<string>('')
  const [feedback, setFeedback] = useState<string>('')
  const [playedMoves, setPlayedMoves] = useState<string[]>([])
  const cleanRunRef = useRef(true)
  const chessRef = useRef<Chess | null>(null)
  const opponentTimerRef = useRef<number | null>(null)

  // Reset on exercise change.
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

  useEffect(() => () => {
    if (opponentTimerRef.current) window.clearTimeout(opponentTimerRef.current)
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
        setFeedback("La suite annoncée par le livre n'est pas applicable ici.")
      }
      opponentTimerRef.current = null
    }, 450)
  }

  async function persistOutcome(outcome: ExerciseOutcome) {
    if (!active) return
    const updated = await recordOutcome(book.id, active.id, outcome)
    onProgressChange(updated)
  }

  function onPieceDrop({ sourceSquare, targetSquare, piece }: {
    sourceSquare: string; targetSquare: string | null; piece: { pieceType: string }
  }): boolean {
    if (!active || !chessRef.current || !targetSquare) return false
    if (status === 'solved' || status === 'revealed') return false

    const c = chessRef.current
    const userIdx = playedMoves.length
    if (userIdx >= active.moves.length) return false
    if (userIdx % 2 !== 0) return false

    const promotion = piece.pieceType.endsWith('P') &&
      (targetSquare[1] === '1' || targetSquare[1] === '8') ? 'q' : undefined
    let mv
    try {
      mv = c.move({ from: sourceSquare, to: targetSquare, promotion })
    } catch { return false }
    if (!mv) return false

    const expected = active.moves[userIdx]
    if (!sanMatches(mv.san, expected)) {
      c.undo()
      setStatus('wrong')
      setFeedback(`✗ ${mv.san} — réessaie (H pour la solution)`)
      playWrong()
      cleanRunRef.current = false
      void persistOutcome('wrong')
      return false
    }

    setPosition(c.fen())
    setPlayedMoves(prev => [...prev, mv.san])
    if (mv.captured) playCapture(); else playMove()

    const nextIdx = userIdx + 1
    if (nextIdx >= active.moves.length) {
      setStatus('solved')
      setFeedback(cleanRunRef.current ? '✓ Bravo, séquence complète !' : '✓ Séquence complétée.')
      playSuccess()
      void persistOutcome(cleanRunRef.current ? 'solved' : 'wrong')
    } else {
      setStatus('in-progress')
      setFeedback(`✓ ${mv.san} — continue !`)
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
    const c = chessRef.current
    let idx = playedMoves.length
    setStatus('revealed')
    function step() {
      if (!chessRef.current || !active) return
      if (idx >= active.moves.length) {
        setFeedback('Solution complète révélée.')
        void persistOutcome('revealed')
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
        setFeedback(`Solution : ${active.moves.slice(playedMoves.length).join(' ')} (non rejouable)`)
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
    cleanRunRef.current = false
  }

  function goNext() {
    if (filtered.length === 0) return
    setActiveIdx(i => Math.min(filtered.length - 1, i + 1))
  }
  function goPrev() {
    setActiveIdx(i => Math.max(0, i - 1))
  }
  function jumpToFirstUnsolved() {
    const idx = filtered.findIndex(e => {
      const st = progress.byExercise[e.id]
      return !st || st.outcome === 'wrong'
    })
    if (idx >= 0) setActiveIdx(idx)
  }

  const solvedCount = filtered.filter(e => progress.byExercise[e.id]?.outcome === 'solved').length

  function renderMoveList() {
    if (!active) return null
    const out: React.ReactNode[] = []
    const total = active.moves.length
    for (let i = 0; i < total; i++) {
      const isUser = i % 2 === 0
      const isPlayed = i < playedMoves.length
      const isExpectedNext = i === playedMoves.length && status !== 'solved'
      const san = isPlayed
        ? playedMoves[i]
        : (status === 'solved' || status === 'revealed' ? active.moves[i] : '?')
      out.push(
        <span
          key={i}
          className={
            isExpectedNext ? 'px-1.5 py-0.5 rounded bg-[var(--color-accent)]/30 text-white font-mono text-xs' :
            isPlayed && isUser ? 'font-mono text-xs text-green-300' :
            isPlayed ? 'font-mono text-xs text-neutral-300' :
            'font-mono text-xs text-neutral-600'
          }
        >{san}</span>,
      )
      if (i < total - 1) out.push(<span key={`s${i}`} className="text-neutral-700">·</span>)
    }
    return <div className="flex flex-wrap items-center gap-1">{out}</div>
  }

  const currentBadge = active && progress.byExercise[active.id]
  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-4 flex items-baseline justify-between flex-wrap gap-3">
        <div>
          <button onClick={onBack} className="text-sm text-neutral-400 hover:text-white mb-1">← Bibliothèque</button>
          <h2 className="text-2xl font-semibold">{book.title}</h2>
          <p className="text-sm text-neutral-400">
            {book.exercises.length} exercices · Importé le {new Date(book.importedAt).toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm text-neutral-400">
            {solvedCount} / {filtered.length} résolus
          </span>
          <button
            onClick={onStartRush}
            className="px-3 py-1.5 text-sm rounded bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white font-medium"
          >
            ⚡ Rush
          </button>
        </div>
      </div>

      {chapters.length > 1 && (
        <div className="mb-3 inline-flex rounded-md border border-[var(--color-border)] bg-[var(--color-panel)] p-0.5 text-sm flex-wrap">
          <ChapterTab active={chapterFilter === 'all'} onClick={() => { setChapterFilter('all'); setActiveIdx(0) }} count={book.exercises.length}>Tous</ChapterTab>
          {chapters.map(c => (
            <ChapterTab
              key={c}
              active={chapterFilter === c}
              onClick={() => { setChapterFilter(c); setActiveIdx(0) }}
              count={book.exercises.filter(e => e.chapter === c).length}
            >{c}</ChapterTab>
          ))}
        </div>
      )}

      {!active ? (
        <p className="text-neutral-400">Aucun exercice pour ce filtre.</p>
      ) : (
        <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-4">
          <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-4">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div className="text-sm text-neutral-300 flex items-center gap-2 flex-wrap">
                <span className="font-medium">#{active.n}</span>
                {currentBadge && (
                  <span className={
                    currentBadge.outcome === 'solved' ? 'text-xs text-green-400' :
                    currentBadge.outcome === 'revealed' ? 'text-xs text-orange-300' :
                    'text-xs text-red-400'
                  }>
                    {currentBadge.outcome === 'solved' ? '✓ résolu' :
                     currentBadge.outcome === 'revealed' ? '👁 révélé' : '✗ raté'}
                  </span>
                )}
                <span className="text-neutral-500">
                  {active.side === 'w' ? '⚪ Trait aux blancs' : '⚫ Trait aux noirs'}
                </span>
                <span className="text-neutral-500">
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

            <div className="mt-3">{renderMoveList()}</div>

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
                {active.solutionProse || '(pas de prose dans le PDF source)'}
              </div>
            ) : (
              <p className="text-sm text-neutral-500">
                Trouve le bon coup pour révéler la suite.{' '}
                <kbd className="px-1.5 py-0.5 bg-neutral-800 rounded text-xs">H</kbd> solution,{' '}
                <kbd className="px-1.5 py-0.5 bg-neutral-800 rounded text-xs">R</kbd> reset,{' '}
                <kbd className="px-1.5 py-0.5 bg-neutral-800 rounded text-xs">←/→</kbd> nav.
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

// Re-export so other components can also import BookExercise from here.
export type { BookExercise }
