import { useEffect, useState } from 'react'
import { getNote, setNote } from '../storage/notes'

interface Props {
  fen: string
  /** Optional compact mode — just shows a small chip if a note exists,
   *  click to expand. Used inside dense lists. */
  compact?: boolean
}

export default function PositionNote({ fen, compact = false }: Props) {
  const [text, setText] = useState(() => getNote(fen)?.text ?? '')
  const [editing, setEditing] = useState(false)

  // Hydrate when the position changes (parent navigates).
  useEffect(() => {
    setText(getNote(fen)?.text ?? '')
    setEditing(false)
  }, [fen])

  function save(next: string) {
    setText(next)
    setNote(fen, next)
  }

  const hasNote = text.trim().length > 0

  if (compact && !editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className={`text-[11px] px-1.5 py-0.5 rounded border ${
          hasNote
            ? 'border-amber-500/40 bg-amber-500/10 text-amber-200'
            : 'border-[var(--color-border)] text-neutral-500 hover:text-neutral-300'
        }`}
        title={hasNote ? text : 'Ajouter une note'}
      >
        {hasNote ? `📝 ${text.length > 24 ? text.slice(0, 24) + '…' : text}` : '+ note'}
      </button>
    )
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <h4 className="text-xs uppercase tracking-wider text-neutral-500">
          📝 Note personnelle
        </h4>
        {hasNote && (
          <button
            onClick={() => save('')}
            className="text-[11px] text-neutral-500 hover:text-red-300 underline"
          >Effacer</button>
        )}
      </div>
      <textarea
        value={text}
        onChange={e => save(e.target.value)}
        placeholder="Ce que tu as appris sur cette position…"
        rows={3}
        className="w-full px-2 py-1.5 text-sm rounded bg-neutral-900 border border-[var(--color-border)] focus:border-[var(--color-accent)] focus:outline-none resize-y"
      />
      <p className="text-[10px] text-neutral-600">
        Lié au FEN — la même position vue ailleurs (autre partie) affichera ta note.
      </p>
    </div>
  )
}
