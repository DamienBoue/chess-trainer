// Static invariants on the roadmap module catalogue. These tests would
// have caught the regressions where a module had a `surface: 'book'`
// (stale-state route) or no actionable target at all.

import { describe, expect, it } from 'vitest'
import { MODULES_BY_BRACKET } from './roadmap'

const VALID_SURFACES = new Set([
  'exercises', 'blunder', 'calc', 'repertoire', 'library', 'play', 'stats',
  // 'book' deliberately excluded: routing to /book without an activeBookId
  // brings back whichever book was last opened, which is a dead-end UX.
])

describe('roadmap modules', () => {
  const all = Object.values(MODULES_BY_BRACKET).flat()

  it('has unique module ids', () => {
    const ids = all.map(m => m.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every module declares an actionable target: either surface or studyHint', () => {
    for (const m of all) {
      const hasAction = !!m.surface || !!m.studyHint
      expect(hasAction, `module ${m.id} has neither surface nor studyHint`).toBe(true)
    }
  })

  it('only uses surfaces that route to a real, content-bearing view', () => {
    for (const m of all) {
      if (m.surface == null) continue
      expect(
        VALID_SURFACES.has(m.surface),
        `module ${m.id} uses surface '${m.surface}' which routes to a dead-end (no specific content)`,
      ).toBe(true)
    }
  })

  it('every bracket has at least 3 modules', () => {
    for (const [bracket, modules] of Object.entries(MODULES_BY_BRACKET)) {
      expect(modules.length, `bracket ${bracket} only has ${modules.length} modules`).toBeGreaterThanOrEqual(3)
    }
  })

  it('every module has a non-empty title and why', () => {
    for (const m of all) {
      expect(m.title.trim().length, `module ${m.id} has empty title`).toBeGreaterThan(0)
      expect(m.why.trim().length, `module ${m.id} has empty why`).toBeGreaterThan(0)
    }
  })
})
