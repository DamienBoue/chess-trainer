import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import AnalysisMoveBar from './AnalysisMoveBar'

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

function setup(over: Partial<ComponentProps<typeof AnalysisMoveBar>> = {}) {
  const fns = { onStart: vi.fn(), onPrev: vi.fn(), onNext: vi.fn(), onEnd: vi.fn(), onNextKeyMoment: vi.fn() }
  const props = { label: '12... Rc8', canGoBack: true, canGoForward: true, canJumpToKeyMoment: true, ...fns, ...over }
  const view = render(<AnalysisMoveBar {...props} />)
  return { ...fns, props, ...view }
}

const button = (name: string) => screen.getByRole('button', { name })
const advance = (ms: number) => act(() => { vi.advanceTimersByTime(ms) })

describe('AnalysisMoveBar', () => {
  it('is a named group that shows the current position', () => {
    setup()
    expect(screen.getByRole('group', { name: 'Navigation dans la partie' })).toBeTruthy()
    expect(screen.getByText('12... Rc8')).toBeTruthy()
  })

  it('runs the matching action once per tap', () => {
    const fns = setup()
    fireEvent.click(button('Début'))
    fireEvent.click(button('Coup précédent'))
    fireEvent.click(button('Coup suivant'))
    fireEvent.click(button('Fin'))
    fireEvent.click(button('Moment clé suivant'))
    for (const fn of [fns.onStart, fns.onPrev, fns.onNext, fns.onEnd, fns.onNextKeyMoment]) {
      expect(fn).toHaveBeenCalledTimes(1)
    }
  })

  it('moves exactly one ply per tap, with the pointer events a real tap brings', () => {
    const { onNext, onPrev } = setup()
    const next = button('Coup suivant')
    fireEvent.pointerDown(next)
    fireEvent.pointerUp(next)
    fireEvent.click(next, { detail: 1 })
    expect(onNext).toHaveBeenCalledTimes(1)
    // The pending hold timer died with the pointer up: nothing repeats later.
    advance(2000)
    expect(onNext).toHaveBeenCalledTimes(1)

    const prev = button('Coup précédent')
    fireEvent.pointerDown(prev)
    advance(100)
    fireEvent.pointerUp(prev)
    fireEvent.click(prev, { detail: 1 })
    advance(2000)
    expect(onPrev).toHaveBeenCalledTimes(1)
  })

  it('repeats ▶ after 350 ms, then every 110 ms, and the click ending the hold adds nothing', () => {
    const { onNext } = setup()
    const next = button('Coup suivant')
    fireEvent.pointerDown(next)
    advance(349)
    expect(onNext).not.toHaveBeenCalled()
    advance(1) // 350 ms: the hold starts repeating
    expect(onNext).toHaveBeenCalledTimes(1)
    advance(109)
    expect(onNext).toHaveBeenCalledTimes(1)
    advance(1) // 460 ms
    expect(onNext).toHaveBeenCalledTimes(2)
    advance(220) // 570 and 680 ms
    expect(onNext).toHaveBeenCalledTimes(4)

    fireEvent.pointerUp(next)
    fireEvent.click(next, { detail: 1 }) // the click that closes the press
    advance(2000)
    expect(onNext).toHaveBeenCalledTimes(4)
  })

  it('repeats ◀ the same way', () => {
    const { onPrev, onNext } = setup()
    const prev = button('Coup précédent')
    fireEvent.pointerDown(prev)
    advance(350 + 110 * 2)
    expect(onPrev).toHaveBeenCalledTimes(3)
    fireEvent.pointerUp(prev)
    advance(2000)
    expect(onPrev).toHaveBeenCalledTimes(3)
    expect(onNext).not.toHaveBeenCalled()
  })

  it('the other buttons do not repeat', () => {
    const { onStart, onEnd, onNextKeyMoment } = setup()
    for (const name of ['Début', 'Fin', 'Moment clé suivant']) {
      fireEvent.pointerDown(button(name))
    }
    advance(2000)
    for (const fn of [onStart, onEnd, onNextKeyMoment]) expect(fn).not.toHaveBeenCalled()
  })

  it.each([
    ['leaves the button', (el: Element) => fireEvent.pointerLeave(el)],
    ['is cancelled (the page scrolls)', (el: Element) => fireEvent.pointerCancel(el)],
    ['is released', (el: Element) => fireEvent.pointerUp(el)],
  ])('stops repeating when the pointer %s', (_when, release) => {
    const { onNext } = setup()
    const next = button('Coup suivant')
    fireEvent.pointerDown(next)
    advance(350 + 110)
    expect(onNext).toHaveBeenCalledTimes(2)
    release(next)
    advance(2000)
    expect(onNext).toHaveBeenCalledTimes(2)
  })

  it('does not start a hold from a secondary mouse button', () => {
    const { onNext } = setup()
    fireEvent.pointerDown(button('Coup suivant'), { pointerType: 'mouse', button: 2 })
    advance(2000)
    expect(onNext).not.toHaveBeenCalled()
  })

  it('still steps on a keyboard / assistive click, even right after a hold', () => {
    const { onNext } = setup()
    const next = button('Coup suivant')
    fireEvent.pointerDown(next)
    advance(350)
    fireEvent.pointerUp(next)
    expect(onNext).toHaveBeenCalledTimes(1)
    fireEvent.click(next) // detail 0: Enter / Space / VoiceOver, not the end of the hold
    expect(onNext).toHaveBeenCalledTimes(2)
  })

  it('stops by itself once the end of the game is reached', () => {
    const { onNext, props, rerender } = setup()
    const next = button('Coup suivant')
    fireEvent.pointerDown(next)
    advance(350 + 110)
    expect(onNext).toHaveBeenCalledTimes(2)
    // The last move is now shown: ▶ can't go on (and the browser stops sending pointer events to it).
    rerender(<AnalysisMoveBar {...props} canGoForward={false} />)
    advance(2000)
    expect(onNext).toHaveBeenCalledTimes(2)
    expect((button('Coup suivant') as HTMLButtonElement).disabled).toBe(true)
  })

  it('repeats with the latest handler, not the one of the render that started the hold', () => {
    const { onNext, props, rerender } = setup()
    fireEvent.pointerDown(button('Coup suivant'))
    advance(350)
    expect(onNext).toHaveBeenCalledTimes(1)
    const replacement = vi.fn()
    rerender(<AnalysisMoveBar {...props} onNext={replacement} />)
    advance(110 * 2)
    expect(onNext).toHaveBeenCalledTimes(1)
    expect(replacement).toHaveBeenCalledTimes(2)
  })

  it('stops repeating when the bar goes away', () => {
    const { onNext, unmount } = setup()
    fireEvent.pointerDown(button('Coup suivant'))
    advance(350 + 110)
    expect(onNext).toHaveBeenCalledTimes(2)
    unmount()
    advance(2000)
    expect(onNext).toHaveBeenCalledTimes(2)
  })

  it('disables what cannot move: nothing before the start, nothing after the end, no key moment left', () => {
    const { rerender, props } = setup({ canGoBack: false, canJumpToKeyMoment: false })
    const disabled = () => ['Début', 'Coup précédent', 'Coup suivant', 'Fin', 'Moment clé suivant']
      .filter(name => (button(name) as HTMLButtonElement).disabled)
    expect(disabled()).toEqual(['Début', 'Coup précédent', 'Moment clé suivant'])
    rerender(<AnalysisMoveBar {...props} canGoBack canGoForward={false} canJumpToKeyMoment />)
    expect(disabled()).toEqual(['Coup suivant', 'Fin'])
  })

  it('shows the start position as the label it is given', () => {
    setup({ label: 'Départ', canGoBack: false })
    expect(screen.getByText('Départ')).toBeTruthy()
  })
})
