// Pinned move bar of the game analysis on phones (< sm). There the analysis
// is a full-screen board task (the tab bar is hidden), so stepping through
// the game has to stay under the thumb, as in the Lichess app: big targets,
// ◀ / ▶ that keep stepping while held, and a jump to the next key moment.
// AnalysisView mounts it only while the board is on screen.

import { useCallback, useEffect, useRef, type MouseEvent, type PointerEvent, type ReactNode } from 'react'

/** A press held this long on ◀ / ▶ starts repeating… */
const HOLD_DELAY_MS = 350
/** …one move every this many ms. */
const REPEAT_MS = 110

interface Props {
  /** The shown position: "12... Rc8", "Départ", "Aperçu moteur". */
  label: string
  canGoBack: boolean
  canGoForward: boolean
  canJumpToKeyMoment: boolean
  onStart: () => void
  onPrev: () => void
  onNext: () => void
  onEnd: () => void
  onNextKeyMoment: () => void
}

export default function AnalysisMoveBar({
  label,
  canGoBack,
  canGoForward,
  canJumpToKeyMoment,
  onStart,
  onPrev,
  onNext,
  onEnd,
  onNextKeyMoment,
}: Props) {
  return (
    <div
      role="group"
      aria-label="Navigation dans la partie"
      className="sm:hidden fixed bottom-0 inset-x-0 z-30 select-none touch-manipulation bg-[var(--color-panel)] border-t border-[var(--color-border)] pb-[env(safe-area-inset-bottom)] [-webkit-touch-callout:none] [-webkit-tap-highlight-color:transparent]"
    >
      <div className="grid grid-cols-[2.75rem_3.25rem_minmax(0,1fr)_3.25rem_2.75rem_4rem] items-center gap-0.5 p-1">
        <BarButton label="Début" disabled={!canGoBack} onClick={onStart}>
          <Icon><path d="M6 5v14M18 5l-8 7 8 7" /></Icon>
        </BarButton>
        <HoldButton label="Coup précédent" disabled={!canGoBack} onStep={onPrev}>
          <Icon><path d="M15 5l-7 7 7 7" /></Icon>
        </HoldButton>
        <span className="min-w-0 truncate px-1 text-center font-mono text-sm text-neutral-100">{label}</span>
        <HoldButton label="Coup suivant" disabled={!canGoForward} onStep={onNext}>
          <Icon><path d="M9 5l7 7-7 7" /></Icon>
        </HoldButton>
        <BarButton label="Fin" disabled={!canGoForward} onClick={onEnd}>
          <Icon><path d="M18 5v14M6 5l8 7-8 7" /></Icon>
        </BarButton>
        <BarButton label="Moment clé suivant" disabled={!canJumpToKeyMoment} onClick={onNextKeyMoment} color={ACCENT}>
          <Icon size={20}><path d="M6 21V4M6 4h11l-2.5 4 2.5 4H6" /></Icon>
          <span className="mt-0.5 text-[10px] leading-none whitespace-nowrap">Moment clé</span>
        </BarButton>
      </div>
    </div>
  )
}

const BUTTON_CLASS =
  'flex h-12 flex-col items-center justify-center rounded-md hover:bg-neutral-800 active:bg-neutral-700 disabled:opacity-40 disabled:hover:bg-transparent'
const NEUTRAL = 'text-neutral-200'
const ACCENT = 'text-[var(--color-accent-hover)]'

function Icon({ children, size = 24 }: { children: ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  )
}

function BarButton({ label, disabled, onClick, color = NEUTRAL, children }: {
  label: string
  disabled: boolean
  onClick: () => void
  color?: string
  children: ReactNode
}) {
  return (
    <button type="button" aria-label={label} disabled={disabled} onClick={onClick} className={`${BUTTON_CLASS} ${color}`}>
      {children}
    </button>
  )
}

/** ◀ / ▶: one move per tap, and the game scrubs while the button is held. */
function HoldButton({ label, disabled, onStep, children }: {
  label: string
  disabled: boolean
  onStep: () => void
  children: ReactNode
}) {
  const hold = useHoldRepeat(onStep, !disabled)
  return (
    <button type="button" aria-label={label} disabled={disabled} className={`${BUTTON_CLASS} ${NEUTRAL}`} {...hold}>
      {children}
    </button>
  )
}

/** Handlers for a button that steps once per tap (on click, so the keyboard
 *  and assistive technologies work) and keeps stepping while it is held.
 *  The press stops on pointer up / leave / cancel and on unmount. */
function useHoldRepeat(onStep: () => void, enabled: boolean) {
  // Timers outlive renders: they read the latest props from a ref refreshed
  // after each commit, not the ones of the render that started the press.
  const latest = useRef({ onStep, enabled })
  useEffect(() => { latest.current = { onStep, enabled } })
  const delayTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const repeatTimer = useRef<ReturnType<typeof setInterval>>(undefined)
  // Set once a press has turned into a repeat: the click that ends it must
  // not step once more.
  const repeated = useRef(false)

  const stop = useCallback(() => {
    clearTimeout(delayTimer.current)
    clearInterval(repeatTimer.current)
    delayTimer.current = undefined
    repeatTimer.current = undefined
  }, [])
  useEffect(() => stop, [stop])

  // False when the button can't step any more (first / last move reached).
  const step = useCallback(() => {
    const { onStep: current, enabled: canStep } = latest.current
    if (canStep) current()
    return canStep
  }, [])

  return {
    onPointerDown: (e: PointerEvent<HTMLButtonElement>) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      stop()
      repeated.current = false
      delayTimer.current = setTimeout(() => {
        delayTimer.current = undefined
        repeated.current = true
        if (step()) repeatTimer.current = setInterval(() => { if (!step()) stop() }, REPEAT_MS)
      }, HOLD_DELAY_MS)
    },
    onPointerUp: stop,
    onPointerLeave: stop,
    onPointerCancel: stop,
    // A long press would open the context menu (Android) instead of repeating.
    onContextMenu: (e: MouseEvent<HTMLButtonElement>) => e.preventDefault(),
    onClick: (e: MouseEvent<HTMLButtonElement>) => {
      // detail 0 = keyboard / assistive technology: never the end of a hold.
      const endsHold = repeated.current && e.detail !== 0
      repeated.current = false
      if (!endsHold) onStep()
    },
  }
}
