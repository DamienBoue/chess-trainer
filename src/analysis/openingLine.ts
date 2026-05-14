// Extract the user's most-played line from a built repertoire root.
//
// Walks the tree breadth-first, always picking the child with the highest
// count. Returns a flat list of (oppPrev, userSan, count) so the UI can
// display the line as a sequence + compare each position against masters.

import { Chess } from 'chess.js'
import type { RepertoireRoot, RepertoireNode } from './repertoire'

export interface OpeningLineStep {
  /** The opponent move that led to this user decision point. '<start>' on ply 1. */
  oppPrev: string
  /** The user's most-played move at this node. */
  userSan: string
  /** How many times the user has played that move at that node. */
  count: number
  /** Total games that reached this decision point (= sum of children at the parent level). */
  totalAtNode: number
  /** FEN BEFORE the user's move (and AFTER the opponent's oppPrev move). */
  fenBefore: string
  /** FEN AFTER the user's move (drives the next opponent decision point). */
  fenAfter: string
  /** Win / loss / draw across games that followed this exact sequence. */
  wins: number
  losses: number
  draws: number
  /** Average cpLoss the user paid on this move across instances. */
  avgCpLoss: number
}

interface ExtractOptions {
  maxPlies?: number
}

/** Extracts the most-played line up to `maxPlies` user moves deep. */
export function mostPlayedLine(root: RepertoireRoot, opts: ExtractOptions = {}): OpeningLineStep[] {
  const { maxPlies = 8 } = opts
  const out: OpeningLineStep[] = []
  const chess = new Chess()  // standard starting position
  let cur = root.children
  for (let ply = 0; ply < maxPlies; ply++) {
    if (cur.size === 0) break

    // Group children by oppPrev — each opp move is its own decision point.
    // Pick the most-played oppPrev (= the line the user has actually been
    // there for most often), then the most-played user response within it.
    const groups = new Map<string, { total: number; nodes: RepertoireNode[] }>()
    for (const [composite, node] of cur) {
      const oppPrev = composite.split('|')[0]
      const g = groups.get(oppPrev) ?? { total: 0, nodes: [] }
      g.total += node.count
      g.nodes.push(node)
      groups.set(oppPrev, g)
    }
    const [topOpp, topGroup] = Array.from(groups.entries())
      .sort((a, b) => b[1].total - a[1].total)[0] ?? [null, null]
    if (!topOpp || !topGroup) break

    // Within the top-opp group, take the user's most-played response.
    const bestNode = topGroup.nodes.sort((a, b) => b.count - a.count)[0]

    // Apply opp's move to the board (if not the very first ply).
    if (topOpp !== '<start>') {
      try { chess.move(topOpp) } catch { break }
    }
    const fenBefore = chess.fen()
    try { chess.move(bestNode.san) } catch { break }
    const fenAfter = chess.fen()

    out.push({
      oppPrev: topOpp,
      userSan: bestNode.san,
      count: bestNode.count,
      totalAtNode: topGroup.total,
      fenBefore,
      fenAfter,
      wins: bestNode.wins,
      losses: bestNode.losses,
      draws: bestNode.draws,
      avgCpLoss: bestNode.count > 0 ? bestNode.cpLossSum / bestNode.count : 0,
    })

    // Drop into the chosen branch for the next iteration.
    cur = bestNode.children
  }
  return out
}
