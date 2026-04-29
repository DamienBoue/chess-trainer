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
  moves: { san: string; oppPrev: string; count: number; w: number; l: number; d: number }[]
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
    moves.push({
      san: node.san, oppPrev, count: node.count,
      w: node.wins, l: node.losses, d: node.draws,
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
