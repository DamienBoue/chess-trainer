import { describe, expect, it } from 'vitest'
import { cssSafeBoardId } from './boardId'

describe('cssSafeBoardId', () => {
  it('turns URLs and card keys into valid CSS selectors', () => {
    for (const raw of ['https://www.chess.com/game/live/123#42-missed', 'Italian Game::white::<start>|e4/e5::srs', '42', '-x']) {
      const id = cssSafeBoardId(raw)!
      expect(() => document.querySelector(`#${id}-square-e4`)).not.toThrow()
    }
  })

  it('keeps simple ids untouched and passes undefined through', () => {
    expect(cssSafeBoardId('strategy-trainer')).toBe('strategy-trainer')
    expect(cssSafeBoardId(undefined)).toBeUndefined()
  })
})
