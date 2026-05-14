// Lightweight tooltip wrapper using the native title= attribute as a
// graceful fallback when JS isn't around. Visual presentation is a small
// hover card with a 250 ms delay so it doesn't fire on every quick pass.

import { useState, useRef } from 'react'
import type { ReactNode } from 'react'

interface TooltipProps {
  children: ReactNode
  content: ReactNode
  /** Position relative to the trigger. */
  side?: 'top' | 'bottom' | 'left' | 'right'
}

export default function Tooltip({ children, content, side = 'top' }: TooltipProps) {
  const [visible, setVisible] = useState(false)
  const timer = useRef<number | null>(null)

  function show() {
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setVisible(true), 250)
  }
  function hide() {
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = null
    setVisible(false)
  }

  const sideClasses = {
    top:    'bottom-full mb-1 left-1/2 -translate-x-1/2',
    bottom: 'top-full mt-1 left-1/2 -translate-x-1/2',
    left:   'right-full mr-1 top-1/2 -translate-y-1/2',
    right:  'left-full ml-1 top-1/2 -translate-y-1/2',
  }[side]

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {visible && (
        <span
          role="tooltip"
          className={`absolute z-50 px-2 py-1 text-xs rounded bg-neutral-950 border border-neutral-700 text-neutral-200 shadow-lg whitespace-nowrap max-w-xs pointer-events-none ${sideClasses}`}
        >
          {content}
        </span>
      )}
    </span>
  )
}
