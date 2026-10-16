import { describe, expect, it } from 'vitest'
import { NAV, allNavItems, hubGroup, parentOf, titleOf } from './navModel'

describe('navigation model', () => {
  it('has five parts, as one-word tabs', () => {
    expect(NAV.map(e => (e.kind === 'item' ? e.item.label : e.group.label)))
      .toEqual(['Aujourd\'hui', 'Parties', 'Entraînement', 'Théorie', 'Progrès'])
  })

  it('gives every tool a unique key and target', () => {
    const items = allNavItems().map(({ item }) => `${item.target.view}/${item.target.strategyTab ?? ''}`)
    expect(new Set(items).size).toBe(items.length)
  })

  it('leads each tool up to its part, and deep screens up to their list', () => {
    expect(parentOf('exercises')).toEqual({ title: 'Entraînement', target: { view: 'trainHub' } })
    expect(parentOf('strategy', 'atlas')).toEqual({ title: 'Théorie', target: { view: 'theoryHub' } })
    expect(parentOf('strategy', 'profile')).toEqual({ title: 'Progrès', target: { view: 'progressHub' } })
    expect(parentOf('analysis')).toEqual({ title: 'Parties', target: { view: 'games' } })
    expect(parentOf('book')).toEqual({ title: 'Bibliothèque', target: { view: 'library' } })
    expect(parentOf('library')).toEqual({ title: 'Théorie', target: { view: 'theoryHub' } })
    for (const top of ['home', 'games', 'trainHub', 'theoryHub', 'progressHub', 'settings']) expect(parentOf(top)).toBeNull()
  })

  it('names every screen like its menu entry', () => {
    expect(titleOf('trainHub')).toBe('Entraînement')
    expect(titleOf('roadmap')).toBe('Mon niveau')
    expect(titleOf('strategy', 'trainer')).toBe('Entraîneur stratégique')
    expect(titleOf('home')).toBe('Aujourd\'hui')
    expect(hubGroup('theoryHub')?.key).toBe('theory')
  })

  it('puts forward what is due on the training hub', () => {
    const train = hubGroup('trainHub')!
    expect(train.recommend!({ analyses: 9, exercises: 20, due: 4 })).toEqual({ key: 'exercises', why: '4 exercices à revoir aujourd\'hui' })
    expect(train.recommend!({ analyses: 9, exercises: 20, due: 0 })?.key).toBe('rush')
    expect(train.recommend!({ analyses: 1, exercises: 2, due: 0 })).toBeNull()
  })
})
