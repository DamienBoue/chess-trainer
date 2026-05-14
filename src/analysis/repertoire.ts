import { Chess } from 'chess.js'
import type { Color, GameAnalysis } from '../types'
import { getParentOpening } from './openings'

export interface RepertoireNode {
  san: string
  count: number
  wins: number
  losses: number
  draws: number
  cpLossSum: number                          // total cp lost across instances
  fenBeforeSamples: string[]                 // a few example FENs at this point
  // What did the engine recommend instead in past instances? Histogram by SAN.
  engineSuggestions: Map<string, number>
  children: Map<string, RepertoireNode>
}

export interface RepertoireRoot {
  parent: string                        // canonical parent opening name
  color: Color
  total: number                         // games rolled up under this root
  // Top-level children = first move played by the user-side from the start.
  // We store moves at the user's plies only (not the opponent's).
  children: Map<string, RepertoireNode>
}

interface BuildOptions {
  maxPliesEachSide?: number             // how deep to record (in plies of the user's side)
  minGamesPerRoot?: number
}

const ALL_RESULTS: Array<'win' | 'loss' | 'draw'> = ['win', 'loss', 'draw']

// Build a per-(opening, color) tree of the user's actual moves at each ply.
// Opponent moves are folded into the path so each node's children are the
// user's responses to that specific opponent context.
export function buildRepertoire(
  analyses: GameAnalysis[],
  opts: BuildOptions = {},
): RepertoireRoot[] {
  const { maxPliesEachSide = 8, minGamesPerRoot = 2 } = opts
  const map = new Map<string, RepertoireRoot>()

  for (const game of analyses) {
    const parent = getParentOpening(game.ecoCode, game.opening)
    const key = `${parent}::${game.userColor}`
    if (!map.has(key)) {
      map.set(key, { parent, color: game.userColor, total: 0, children: new Map() })
    }
    const root = map.get(key)!
    root.total++

    const userIsWhite = game.userColor === 'white'
    // Walk both sides simultaneously so we can attach cpLoss/best-suggestion
    // metadata to each user node from the corresponding MoveAnalysis.
    const userPlies: { san: string; oppPrev: string; cpLoss: number; bestSan?: string; fenBefore: string }[] = []
    let oppPrev = '<start>'
    for (const mv of game.moves) {
      const moverIsWhite = mv.ply % 2 === 1
      if (moverIsWhite === userIsWhite) {
        userPlies.push({
          san: mv.san, oppPrev,
          cpLoss: mv.cpLoss,
          bestSan: mv.bestMoveSan,
          fenBefore: mv.fenBefore,
        })
      } else {
        oppPrev = mv.san
      }
      if (userPlies.length >= maxPliesEachSide) break
    }

    let cur = root.children
    for (const up of userPlies) {
      const composite = `${up.oppPrev}|${up.san}`
      if (!cur.has(composite)) {
        cur.set(composite, {
          san: up.san,
          count: 0, wins: 0, losses: 0, draws: 0,
          cpLossSum: 0,
          fenBeforeSamples: [],
          engineSuggestions: new Map(),
          children: new Map(),
        })
      }
      const node = cur.get(composite)!
      node.count++
      node.cpLossSum += up.cpLoss
      if (node.fenBeforeSamples.length < 3) node.fenBeforeSamples.push(up.fenBefore)
      if (up.bestSan && up.bestSan !== up.san) {
        node.engineSuggestions.set(up.bestSan, (node.engineSuggestions.get(up.bestSan) ?? 0) + 1)
      }
      if (game.result === 'win') node.wins++
      else if (game.result === 'loss') node.losses++
      else node.draws++
      cur = node.children
    }
  }

  // Drop roots with too-few games — keeps the report focused.
  return Array.from(map.values())
    .filter(r => r.total >= minGamesPerRoot)
    .sort((a, b) => b.total - a.total)
}

// Walk one game against the per-opening repertoire and return the first ply
// where the user played a non-typical move (i.e. NOT their most-played child
// at that point). Returns null if the user stayed on their main line for the
// whole window.
export interface Deviation {
  ply: number
  expected: string             // most-played user move at that point
  expectedFrequency: number    // count of expected
  alternativesCount: number    // total alternatives seen at that point
  played: string               // what the user actually played
}

export function findDeviation(
  game: GameAnalysis,
  roots: RepertoireRoot[],
): Deviation | null {
  const parent = getParentOpening(game.ecoCode, game.opening)
  const root = roots.find(r => r.parent === parent && r.color === game.userColor)
  if (!root) return null

  const userIsWhite = game.userColor === 'white'
  const userPlies: { ply: number; san: string; oppPrev: string }[] = []
  let oppPrev = '<start>'
  for (const mv of game.moves) {
    const moverIsWhite = mv.ply % 2 === 1
    if (moverIsWhite === userIsWhite) {
      userPlies.push({ ply: mv.ply, san: mv.san, oppPrev })
    } else {
      oppPrev = mv.san
    }
  }

  let cur = root.children
  for (const up of userPlies) {
    const composite = `${up.oppPrev}|${up.san}`
    // Find the "expected" = most-played child at this level for this opp context
    const samples = Array.from(cur.values())  // all children at this ply
    if (samples.length === 0) return null
    // Restrict expected to nodes matching the opp prefix; if none, fall back to all.
    const matching = Array.from(cur.entries()).filter(([k]) => k.startsWith(up.oppPrev + '|'))
    const pool = matching.length > 0 ? matching.map(([, v]) => v) : samples
    if (pool.length === 0) return null
    const top = pool.reduce((a, b) => (a.count >= b.count ? a : b))

    // We "deviate" only if there are at least 2 distinct moves seen here,
    // and the top one is significantly preferred (>=60% of the local samples),
    // and the user played something else this time.
    const totalLocal = pool.reduce((s, n) => s + n.count, 0)
    const distinctMoves = new Set(pool.map(n => n.san))
    if (distinctMoves.size > 1 && top.count / totalLocal >= 0.6 && top.san !== up.san) {
      return {
        ply: up.ply,
        expected: top.san,
        expectedFrequency: top.count,
        alternativesCount: totalLocal,
        played: up.san,
      }
    }

    const next = cur.get(composite)
    if (!next) return null
    cur = next.children
  }
  return null
}

// Build a flat "main line" report per root: the top-N most popular sequences
// with their result rollup. We unfold the tree by following the highest-count
// child at every level.
export interface RepertoireLine {
  parent: string
  color: Color
  // Order: user-ply 1, user-ply 2, ...
  moves: {
    san: string
    oppPrev: string
    count: number
    w: number; l: number; d: number
    avgCpLoss: number
    engineSuggestion?: { san: string; count: number }
  }[]
  total: number
}

export function topLines(root: RepertoireRoot, maxDepth = 6): RepertoireLine {
  const moves: RepertoireLine['moves'] = []
  let cur = root.children
  for (let i = 0; i < maxDepth; i++) {
    const arr = Array.from(cur.entries())
    if (arr.length === 0) break
    const [key, node] = arr.reduce((a, b) => (a[1].count >= b[1].count ? a : b))
    const oppPrev = key.split('|')[0]
    let topSugg: { san: string; count: number } | undefined
    if (node.engineSuggestions.size > 0) {
      const [san, count] = Array.from(node.engineSuggestions.entries())
        .reduce((a, b) => (a[1] >= b[1] ? a : b))
      topSugg = { san, count }
    }
    moves.push({
      san: node.san, oppPrev, count: node.count,
      w: node.wins, l: node.losses, d: node.draws,
      avgCpLoss: node.count > 0 ? node.cpLossSum / node.count : 0,
      engineSuggestion: topSugg,
    })
    cur = node.children
  }
  return { parent: root.parent, color: root.color, moves, total: root.total }
}

// Children at a given prefix path of user moves (handy if we want to inspect a
// specific node's alternatives).
export function alternativesAt(root: RepertoireRoot, userMoves: string[]): RepertoireNode[] {
  let cur = root.children
  for (let i = 0; i < userMoves.length - 1; i++) {
    const key = Array.from(cur.keys()).find(k => k.endsWith('|' + userMoves[i]))
    if (!key) return []
    cur = cur.get(key)!.children
  }
  return Array.from(cur.values()).sort((a, b) => b.count - a.count)
}

// Convenience to format a result-rollup as a small string ("3W/1L/0D").
export function rollupString(node: { wins: number; losses: number; draws: number }): string {
  return `${node.wins}V/${node.losses}D/${node.draws}N`
}

// Issues we want the user to look at in their habitual lines.
export interface RepertoireCritique {
  parent: string
  color: Color
  san: string
  oppPrev: string
  count: number
  total: number                         // games rolled up at this node (≤ count)
  avgCpLoss: number
  winRate: number                       // (wins + 0.5*draws) / total
  fenBefore: string                     // example FEN to render
  engineSuggestion?: { san: string; count: number }
  reason: 'high-cploss' | 'low-winrate' | 'both'
  ply: number                           // depth (in user-side plies) at which this happens
}

// Critique a built repertoire: surface user-habits that look problematic.
//   - "high-cploss": you play this move ≥ minCount times and average cpLoss ≥
//     cpLossThreshold (so the engine usually disagrees with you).
//   - "low-winrate": ≥ minWinrateGames games and win rate ≤ winrateThreshold.
export function critiqueRepertoire(
  roots: RepertoireRoot[],
  opts: {
    minCount?: number
    cpLossThreshold?: number
    minWinrateGames?: number
    winrateThreshold?: number
    maxPliesEachSide?: number
  } = {},
): RepertoireCritique[] {
  const {
    minCount = 3,
    cpLossThreshold = 30,
    minWinrateGames = 4,
    winrateThreshold = 0.30,
    maxPliesEachSide = 8,
  } = opts

  const out: RepertoireCritique[] = []

  function visit(parent: string, color: Color, children: Map<string, RepertoireNode>, depth: number) {
    if (depth >= maxPliesEachSide) return
    for (const [composite, node] of children) {
      const opp = composite.split('|')[0]
      const total = node.wins + node.losses + node.draws
      const avgCp = node.count > 0 ? node.cpLossSum / node.count : 0
      const wr = total > 0 ? (node.wins + 0.5 * node.draws) / total : 0
      let topSugg: { san: string; count: number } | undefined
      if (node.engineSuggestions.size > 0) {
        const [san, count] = Array.from(node.engineSuggestions.entries()).reduce(
          (a, b) => (a[1] >= b[1] ? a : b)
        )
        topSugg = { san, count }
      }

      const isHigh = node.count >= minCount && avgCp >= cpLossThreshold
      const isLow = total >= minWinrateGames && wr <= winrateThreshold
      if (isHigh || isLow) {
        out.push({
          parent, color,
          san: node.san, oppPrev: opp,
          count: node.count,
          total,
          avgCpLoss: avgCp,
          winRate: wr,
          fenBefore: node.fenBeforeSamples[0] ?? '',
          engineSuggestion: topSugg,
          reason: isHigh && isLow ? 'both' : isHigh ? 'high-cploss' : 'low-winrate',
          ply: depth + 1,
        })
      }
      visit(parent, color, node.children, depth + 1)
    }
  }

  for (const r of roots) {
    visit(r.parent, r.color, r.children, 0)
  }
  return out.sort((a, b) => critiqueScore(b) - critiqueScore(a))
}

// Higher = more urgent. Captures both "you waste lots of cp on this habit"
// and "you just lose a lot in this line".
function critiqueScore(c: RepertoireCritique): number {
  return c.avgCpLoss * c.count + (1 - c.winRate) * 50 * c.total
}

void ALL_RESULTS

// ---------------------------------------------------------------------------
// Repertoire holes: positions you reach often where you DON'T have a clear
// habitual move. The critique surfaces "you play X poorly"; this surfaces
// "you're not sure what to play here at all" — different signal, different
// fix (memorise one specific reply instead of unlearning a bad one).
//
// Heuristic:
//   * the node has been reached enough times (≥ minVisits)
//   * the top move's share of visits is below `topShareThreshold` (default 60%)
//     → you're splitting between several choices, never committing
//   * we record up to `top` competing alternatives so the UI can show what
//     you've tried so far.
// ---------------------------------------------------------------------------

export interface RepertoireHole {
  parent: string
  color: Color
  oppPrev: string                  // opponent move that led here
  fenBefore: string                // FEN to display
  visits: number                   // total visits at this node
  topShare: number                 // share of visits taken by the most-played move (0..1)
  avgCpLoss: number                // mean cpLoss across all your choices here
  winRate: number                  // (W + 0.5*D)/total at this node
  choices: Array<{ san: string; count: number; share: number }>  // sorted by count desc
  ply: number                      // user-side ply depth
  score: number                    // bigger = more urgent
}

export function findRepertoireHoles(
  roots: RepertoireRoot[],
  opts: {
    minVisits?: number
    topShareThreshold?: number
    maxPliesEachSide?: number
    topChoices?: number
  } = {},
): RepertoireHole[] {
  const {
    minVisits = 3,
    topShareThreshold = 0.6,
    maxPliesEachSide = 8,
    topChoices = 4,
  } = opts

  const out: RepertoireHole[] = []

  function visit(
    parent: string,
    color: Color,
    children: Map<string, RepertoireNode>,
    depth: number,
  ) {
    if (depth >= maxPliesEachSide) return
    // Group sibling children by oppPrev — each opponent context is its own
    // decision point.
    const byOpp = new Map<string, RepertoireNode[]>()
    for (const [composite, node] of children) {
      const opp = composite.split('|')[0]
      const arr = byOpp.get(opp) ?? []
      arr.push(node)
      byOpp.set(opp, arr)
    }
    for (const [opp, siblings] of byOpp) {
      const totalVisits = siblings.reduce((s, n) => s + n.count, 0)
      if (totalVisits < minVisits) continue
      // Aggregate same-SAN nodes (different deeper paths but same user move).
      const byMove = new Map<string, RepertoireNode[]>()
      for (const n of siblings) {
        const arr = byMove.get(n.san) ?? []
        arr.push(n)
        byMove.set(n.san, arr)
      }
      const movesAgg = Array.from(byMove.entries()).map(([san, list]) => ({
        san,
        count: list.reduce((s, n) => s + n.count, 0),
        cpLossSum: list.reduce((s, n) => s + n.cpLossSum, 0),
        wins: list.reduce((s, n) => s + n.wins, 0),
        losses: list.reduce((s, n) => s + n.losses, 0),
        draws: list.reduce((s, n) => s + n.draws, 0),
        fen: list[0].fenBeforeSamples[0] ?? '',
      }))
      movesAgg.sort((a, b) => b.count - a.count)
      if (movesAgg.length < 2) continue                 // need uncertainty
      const top = movesAgg[0]
      const topShare = top.count / totalVisits
      if (topShare >= topShareThreshold) continue        // clear favourite → not a hole
      const cpLossSum = movesAgg.reduce((s, m) => s + m.cpLossSum, 0)
      const totalCpMoves = movesAgg.reduce((s, m) => s + m.count, 0)
      const wins = movesAgg.reduce((s, m) => s + m.wins, 0)
      const draws = movesAgg.reduce((s, m) => s + m.draws, 0)
      const losses = movesAgg.reduce((s, m) => s + m.losses, 0)
      const total = wins + draws + losses
      const avgCp = totalCpMoves > 0 ? cpLossSum / totalCpMoves : 0
      const wr = total > 0 ? (wins + 0.5 * draws) / total : 0
      out.push({
        parent,
        color,
        oppPrev: opp,
        fenBefore: top.fen,
        visits: totalVisits,
        topShare,
        avgCpLoss: avgCp,
        winRate: wr,
        choices: movesAgg.slice(0, topChoices).map(m => ({
          san: m.san,
          count: m.count,
          share: m.count / totalVisits,
        })),
        ply: depth + 1,
        // Higher = more urgent. Visits × (uncertainty + bad results).
        score: totalVisits * ((1 - topShare) + (1 - wr) * 0.5 + Math.min(avgCp, 100) / 100),
      })
      // Recurse into top children so deeper holes are also surfaced.
      for (const n of siblings) visit(parent, color, n.children, depth + 1)
    }
  }
  for (const r of roots) {
    visit(r.parent, r.color, r.children, 0)
  }
  return out.sort((a, b) => b.score - a.score)
}

// ---------------------------------------------------------------------------
// Drill-card enumeration for the spaced-repetition trainer.
// Each "card" = a single decision point in the user's repertoire (a position
// where they have a habitual move). The card carries the FEN to display,
// the expected SAN, and a stable id used as the SM-2 key.
// ---------------------------------------------------------------------------

export interface DrillCard {
  id: string
  rootKey: string            // "<parent>::<colour>"
  rootParent: string
  rootColor: Color
  pathKeys: string[]
  fen: string                // user to move at this FEN
  expectedSan: string
  habitualSan: string        // may differ from expectedSan in 'improve' mode
  isSfRecommended: boolean
  count: number              // observed games at this node
  depth: number              // user-ply decisions deep
}

const STARTPOS_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

function keyOfRoot(r: RepertoireRoot): string {
  return `${r.parent}::${r.color}`
}

export function enumerateDrillCards(
  roots: RepertoireRoot[],
  options: { mode?: 'habits' | 'improve'; minCount?: number; maxDepth?: number } = {},
): DrillCard[] {
  const { mode = 'habits', minCount = 2, maxDepth = 8 } = options
  const out: DrillCard[] = []

  function walk(
    root: RepertoireRoot,
    children: Map<string, RepertoireNode>,
    pathKeys: string[],
    board: Chess,
  ): void {
    if (children.size === 0 || pathKeys.length >= maxDepth) return
    const arr = Array.from(children.entries())
    const [topKey, top] = arr.reduce((a, b) => (a[1].count >= b[1].count ? a : b))
    const oppPrev = topKey.split('|')[0]

    const decisionBoard = new Chess(board.fen())
    if (oppPrev && oppPrev !== '<start>') {
      try { decisionBoard.move(oppPrev) } catch { return }
    }

    let expectedSan = top.san
    let isSfRecommended = false
    if (mode === 'improve' && top.engineSuggestions.size > 0) {
      const [sfSan] = Array.from(top.engineSuggestions.entries())
        .reduce((a, b) => (a[1] >= b[1] ? a : b))
      if (sfSan && sfSan !== top.san) {
        expectedSan = sfSan
        isSfRecommended = true
      }
    }

    if (top.count >= minCount) {
      const newPath = [...pathKeys, topKey]
      out.push({
        id: `${keyOfRoot(root)}::${newPath.join('/')}::${mode}`,
        rootKey: keyOfRoot(root),
        rootParent: root.parent,
        rootColor: root.color,
        pathKeys: newPath,
        fen: decisionBoard.fen(),
        expectedSan,
        habitualSan: top.san,
        isSfRecommended,
        count: top.count,
        depth: newPath.length,
      })
    }

    // Recurse along the habitual line so depth reflects observed play.
    const nextBoard = new Chess(decisionBoard.fen())
    try { nextBoard.move(top.san) } catch { return }
    walk(root, top.children, [...pathKeys, topKey], nextBoard)
  }

  for (const root of roots) {
    walk(root, root.children, [], new Chess(STARTPOS_FEN))
  }
  return out
}
