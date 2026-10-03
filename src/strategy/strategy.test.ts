import { describe, expect, it } from 'vitest'
import { analyzePosition, planMatchesMove } from './report'
import { computeAttacks, isLightSquare, knightRoute, parseFen, sqIndex, sqName } from './board'
import { analyzePawns, mainChain } from './pawns'
import { analyzeSquares } from './squares'
import { breakConsequences, classifyCenter, findPawnBreaks } from './center'
import { detectStructures, relSquare, renderRel, structureRole } from './structures'
import { analyzeBishops } from './pieces'
import { POSITIONS, fenAfter } from './__fixtures__'

const sq = sqIndex
const names = (xs: number[]) => xs.map(sqName).sort()

describe('board', () => {
  it('parses a FEN into pieces, turn and castling', () => {
    const b = parseFen('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1')
    expect(b.squares[sq('e4')]).toEqual({ color: 'w', type: 'p' })
    expect(b.squares[sq('e8')]).toEqual({ color: 'b', type: 'k' })
    expect(b.turn).toBe('b')
    expect(b.castling).toBe('KQkq')
  })

  it('knows square colours (a1 dark, h1 light)', () => {
    expect(isLightSquare(sq('a1'))).toBe(false)
    expect(isLightSquare(sq('h1'))).toBe(true)
    expect(isLightSquare(sq('d5'))).toBe(true)
  })

  it('counts attackers per side', () => {
    const atk = computeAttacks(parseFen(POSITIONS.italian))
    // e5 is hit by nothing white yet, d4 by the f3 knight; f7 by the c4 bishop.
    expect(atk.count.w[sq('f7')]).toBe(1)
    expect(atk.count.w[sq('d4')]).toBe(1)
    expect(atk.byPawn.b[sq('d4')]).toBe(1)
  })

  it('finds the shortest knight route, avoiding blocked squares', () => {
    expect(knightRoute(sq('g1'), sq('e5'), () => false)?.map(sqName)).toEqual(['f3', 'e5'])
    const route = knightRoute(sq('b1'), sq('d5'), s => s === sq('c3'))
    expect(route?.map(sqName).at(-1)).toBe('d5')
    expect(route?.map(sqName)).not.toContain('c3')
  })
})

describe('pawn structure', () => {
  it('flags the isolated d-pawn in the Panov', () => {
    const ps = analyzePawns(parseFen(POSITIONS.iqp))
    const d4 = ps.w.pawns.find(p => p.sq === sq('d4'))!
    expect(d4.isolated).toBe(true)
    expect(d4.opposed).toBe(false)
    expect(ps.w.islands.length).toBe(3)
  })

  it('flags the backward d6 pawn in the Najdorf', () => {
    const ps = analyzePawns(parseFen(POSITIONS.najdorf))
    expect(ps.b.pawns.find(p => p.sq === sq('d6'))!.backward).toBe(true)
    expect(ps.b.pawns.find(p => p.sq === sq('e5'))!.backward).toBe(false)
  })

  it('detects an outside passed pawn', () => {
    const ps = analyzePawns(parseFen(POSITIONS.outsidePasser))
    const b5 = ps.w.pawns.find(p => p.sq === sq('b5'))!
    expect(b5.passed).toBe(true)
    expect(b5.outsidePassed).toBe(true)
  })

  it('builds French chains pointing to opposite wings', () => {
    const ps = analyzePawns(parseFen(POSITIONS.french))
    const white = mainChain(ps, 'w')!
    const black = mainChain(ps, 'b')!
    expect(white.pointsTo).toBe('kingside')
    expect(names(white.squares)).toEqual(['c3', 'd4', 'e5'])
    expect(black.pointsTo).toBe('queenside')
    expect(sqName(black.base)).toBe('e6') // f7 still at home is not part of the chain
  })

  it('KID chains start at d6 / e4 (pawns on their starting rank excluded)', () => {
    const ps = analyzePawns(parseFen(POSITIONS.kid))
    expect(sqName(mainChain(ps, 'b')!.base)).toBe('d6')
    expect(mainChain(ps, 'w')!.pointsTo).toBe('queenside')
  })

  it('lists current pawn tensions as levers', () => {
    const ps = analyzePawns(parseFen(POSITIONS.french))
    expect(ps.levers.some(l => sqName(l.from) === 'c5' && sqName(l.target) === 'd4')).toBe(true)
  })
})

describe('squares', () => {
  it('finds the d5 outpost for White and the matching weakness for Black (Najdorf)', () => {
    const b = parseFen(POSITIONS.najdorf)
    const sa = analyzeSquares(b, analyzePawns(b))
    const d5 = sa.outposts.w.find(o => o.sq === sq('d5'))!
    expect(d5.pawnProtected).toBe(true)
    expect(d5.route).toBeDefined()
    expect(sa.weak.b.some(w => w.sq === sq('d5'))).toBe(true)
  })

  it('finds e5 as White\'s outpost against the Dutch Stonewall', () => {
    const b = parseFen(POSITIONS.dutch)
    const sa = analyzeSquares(b, analyzePawns(b))
    expect(sqName(sa.outposts.w[0].sq)).toBe('e5')
  })

  it('has no holes in the opening position', () => {
    const b = parseFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')
    const sa = analyzeSquares(b, analyzePawns(b))
    expect(sa.weak.w).toEqual([])
    expect(sa.outposts.w).toEqual([])
  })
})

describe('centre and breaks', () => {
  const center = (fen: string) => { const b = parseFen(fen); return classifyCenter(b, analyzePawns(b)) }

  it('classifies typical centres', () => {
    expect(center(POSITIONS.french).type).toBe('closed')
    expect(center(POSITIONS.kid).type).toBe('closed')
    expect(center(POSITIONS.carlsbad).type).toBe('fixed')
    expect(center(POSITIONS.iqp).type).toBe('open')
    expect(center(fenAfter('e4 e5 d4')).type).toBe('tension')
    expect(center(fenAfter('d4 Nf6 c4 g6 Nc3 d5 cxd5 Nxd5 e4 Nxc3 bxc3 Bg7')).type).toBe('mobile')
  })

  it('identifies c4-c5 as an attack on the base of Black\'s KID chain', () => {
    const b = parseFen(POSITIONS.kid)
    const ps = analyzePawns(b)
    const c5 = findPawnBreaks(b, ps, computeAttacks(b), 'w', classifyCenter(b, ps)).find(x => x.san === 'c5')!
    expect(c5.roles).toContain('attaque la base de la chaîne')
  })

  it('penalises breaks that drop the support of an attacked pawn (French c3-c4)', () => {
    const b = parseFen(POSITIONS.french)
    const ps = analyzePawns(b)
    const c4 = findPawnBreaks(b, ps, computeAttacks(b), 'w', classifyCenter(b, ps)).find(x => x.san === 'c4')!
    expect(sqName(c4.weakens!)).toBe('d4')
  })

  it('flags f-pawn breaks that open the diagonal to an uncastled king (Italian ...f5)', () => {
    const b = parseFen(POSITIONS.italian)
    const ps = analyzePawns(b)
    const f5 = findPawnBreaks(b, ps, computeAttacks(b), 'b', classifyCenter(b, ps)).find(x => x.san === 'f5')!
    expect(f5.weakensKing).toBe(true)
  })

  it('suggests a preparatory pawn move for an unsupported break (Italian c3 before d4)', () => {
    const b = parseFen(POSITIONS.italian)
    const ps = analyzePawns(b)
    const d4 = findPawnBreaks(b, ps, computeAttacks(b), 'w', classifyCenter(b, ps)).find(x => x.san === 'd4')!
    expect(d4.ready).toBe(false)
    expect(d4.prep?.map(sqName)).toEqual(['c2', 'c3'])
  })

  it('foresees the IQP left behind by e3-e4 in the Carlsbad', () => {
    const b = parseFen(POSITIONS.carlsbad)
    const ps = analyzePawns(b)
    const e4 = findPawnBreaks(b, ps, computeAttacks(b), 'w', classifyCenter(b, ps)).find(x => x.san === 'e4')!
    const cons = breakConsequences(b, e4)
    expect(cons.some(c => c.polarity === 'minus' && c.text.includes('d4 deviendrait isolé'))).toBe(true)
  })
})

describe('named structures', () => {
  const ids = (fen: string) => detectStructures(parseFen(fen)).map(m => `${m.pattern.id}:${m.sideA}`)

  it.each([
    ['carlsbad', 'carlsbad:w'],
    ['caroExchange', 'carlsbad:b'],
    ['iqp', 'iqp:w'],
    ['french', 'french-chain:w'],
    ['kid', 'kid-closed:w'],
    ['maroczy', 'maroczy:w'],
    ['najdorf', 'boleslavsky:w'],
    ['hedgehog', 'hedgehog:w'],
    ['dutch', 'stonewall:b'],
    ['benoni', 'benoni:w'],
  ] as const)('recognises %s', (name, expected) => {
    expect(ids(POSITIONS[name])).toContain(expected)
  })

  it('hedgehog supersedes the generic Maroczy', () => {
    expect(ids(POSITIONS.hedgehog)).not.toContain('maroczy:w')
  })

  it('mirrors relative squares for Black', () => {
    expect(relSquare('b4', 'b')).toBe('b5')
    expect(renderRel('pousse [b4]-[b5]', 'b')).toBe('pousse b5-b4')
  })

  it('renders the reversed Carlsbad plans from Black\'s point of view', () => {
    const m = detectStructures(parseFen(POSITIONS.caroExchange)).find(x => x.pattern.id === 'carlsbad')!
    const black = structureRole(m, 'b')
    expect(black.plans[0]).toContain('b5-b4')
    expect(names(black.breaks.map(([, to]) => to))).toContain('b4')
    const white = structureRole(m, 'w')
    expect(white.plans[0]).toContain('cavalier en e5')
  })
})

describe('bishops', () => {
  it('French: both c-bishops are bad, the c8 one classically so', () => {
    const b = parseFen(POSITIONS.french)
    const ps = analyzePawns(b)
    expect(analyzeBishops(b, 'b', ps).find(x => sqName(x.sq) === 'c8')!.verdict).toBe('bad')
    expect(analyzeBishops(b, 'w', ps).find(x => sqName(x.sq) === 'c1')!.verdict).toBe('bad')
  })

  it('does not call opening bishops bad (Italian)', () => {
    const b = parseFen(POSITIONS.italian)
    const ps = analyzePawns(b)
    expect(analyzeBishops(b, 'w', ps).every(x => x.verdict !== 'bad')).toBe(true)
  })

  it('a bad bishop outside its chain is flagged as active (Carlsbad Bg5)', () => {
    const b = parseFen(POSITIONS.carlsbad)
    const g5 = analyzeBishops(b, 'w', analyzePawns(b)).find(x => sqName(x.sq) === 'g5')!
    expect(g5.verdict).toBe('bad')
    expect(g5.activeDespiteBad).toBe(true)
  })
})

describe('full report', () => {
  it('Najdorf: White aims at d5, Black is told about d6 and the d5 hole', () => {
    const r = analyzePosition(POSITIONS.najdorf)
    expect(r.plans.w.some(p => p.kind === 'outpost' && p.title.includes('d5'))).toBe(true)
    expect(r.insights.some(i => i.side === 'b' && i.id === 'backward:b:d6')).toBe(true)
    expect(r.insights.some(i => i.side === 'w' && i.id === 'outpost:w:d5')).toBe(true)
  })

  it('Italian: develop and castle, d4 needs c3 first, no false alarms', () => {
    const r = analyzePosition(POSITIONS.italian)
    expect(r.phase).toBe('opening')
    expect(r.plans.w.map(p => p.kind)).toEqual(expect.arrayContaining(['development', 'castle']))
    const d4 = r.plans.w.find(p => p.kind === 'central-break')!
    expect(d4.timing?.verdict).toBe('prepare')
    expect(d4.steps.join(' ')).toContain('c2-c3')
    expect(r.plans.w.some(p => p.kind === 'open-center')).toBe(false)
    expect(r.insights.filter(i => i.polarity === 'minus')).toEqual([])
  })

  it('closed centre: each side plays on the wing its chain points to (KID)', () => {
    const r = analyzePosition(POSITIONS.kid)
    expect(r.plans.w.find(p => p.kind === 'wing-play')!.title).toContain('aile dame')
    expect(r.plans.b.find(p => p.kind === 'wing-play')!.title).toContain('aile roi')
  })

  it('opposite castling triggers pawn storms', () => {
    const r = analyzePosition(POSITIONS.oppositeCastling)
    expect(r.plans.w.some(p => p.kind === 'pawn-storm' && p.title.includes('aile roi'))).toBe(true)
    expect(r.plans.b.some(p => p.kind === 'pawn-storm' && p.title.includes('aile dame'))).toBe(true)
  })

  it('pawn endings: rule of the square, push / blockade the passer, activate kings', () => {
    const r = analyzePosition(POSITIONS.outsidePasser)
    expect(r.phase).toBe('endgame')
    expect(r.insights.some(i => i.id === 'square:w:b5' && i.polarity === 'plus')).toBe(true)
    expect(r.plans.w[0].kind).toBe('passed-pawn')
    expect(r.plans.b.map(p => p.kind)).toEqual(expect.arrayContaining(['blockade', 'king-activity']))
    // Outposts are meaningless without pieces.
    expect(r.insights.some(i => i.theme === 'squares')).toBe(false)
  })

  it('rook endings: Tarrasch rule', () => {
    const r = analyzePosition(POSITIONS.tarrasch)
    expect(r.insights.some(i => i.id.startsWith('tarrasch:w'))).toBe(true)
  })

  it('matches engine moves against plan moves', () => {
    const r = analyzePosition(POSITIONS.najdorf)
    const outpost = r.plans.w.find(p => p.kind === 'outpost')!
    expect(planMatchesMove(outpost, sq('c3'), sq('d5'))).toBe(true)
    expect(planMatchesMove(outpost, sq('c3'), sq('b5'))).toBe(false)
  })

  it('every concept referenced by insights and plans exists', async () => {
    const { findConcept } = await import('../concepts/lookup')
    for (const fen of Object.values(POSITIONS)) {
      const r = analyzePosition(fen)
      for (const x of [...r.insights, ...r.plans.w, ...r.plans.b]) {
        if (x.conceptId) expect(findConcept(x.conceptId), `${x.id} → ${x.conceptId}`).toBeDefined()
      }
    }
  })

  it('analyses a full game quickly (budget for game-level reviews)', () => {
    const t0 = performance.now()
    for (let i = 0; i < 200; i++) analyzePosition(Object.values(POSITIONS)[i % 14])
    expect(performance.now() - t0).toBeLessThan(2000)
  })
})
