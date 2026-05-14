import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { SkeletonBox, SkeletonLine, SkeletonListItem, SkeletonBoard } from './Skeleton'

afterEach(cleanup)

describe('Skeleton variants', () => {
  it('SkeletonBox renders a div with the shimmer keyframe class', () => {
    const { container } = render(<SkeletonBox className="w-10 h-3" />)
    const el = container.firstChild as HTMLElement
    expect(el.className).toContain('shimmer')
    expect(el.className).toContain('w-10')
  })

  it('SkeletonLine adds the h-3 height', () => {
    const { container } = render(<SkeletonLine />)
    const el = container.firstChild as HTMLElement
    expect(el.className).toContain('h-3')
  })

  it('SkeletonListItem renders an icon placeholder + 2 lines', () => {
    const { container } = render(<SkeletonListItem />)
    // First level: container with bordered card
    expect(container.querySelector('.border')).toBeTruthy()
    // 3 SkeletonBox children inside (icon, line1, line2)
    expect(container.querySelectorAll('.animate-\\[shimmer_1\\.4s_infinite\\]').length).toBe(3)
  })

  it('SkeletonBoard renders a square shape', () => {
    const { container } = render(<SkeletonBoard />)
    expect(container.querySelector('.aspect-square')).toBeTruthy()
  })

  it('SkeletonBoard respects custom maxWidth', () => {
    const { container } = render(<SkeletonBoard maxWidth={300} />)
    const outer = container.firstChild as HTMLElement
    expect(outer.style.maxWidth).toBe('300px')
  })
})
