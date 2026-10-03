// One reference position per named structure, reached by a real opening
// move order (so it is always legal). Used by the structure atlas and as a
// fallback pool for the strategy trainer when the user has few games.

import { Chess } from 'chess.js'

export interface StructureSample {
  structureId: string
  opening: string
  /** Real move order leading to the position… */
  moves?: string
  /** …or a position from a real game (Flores Rios, Chess Structures). */
  fen?: string
}

export const STRUCTURE_SAMPLES: StructureSample[] = [
  { structureId: 'carlsbad', opening: 'Gambit Dame refusé, variante d\'échange', moves: 'd4 d5 c4 e6 Nc3 Nf6 cxd5 exd5 Bg5 Be7 e3 c6 Bd3 O-O Qc2 Nbd7 Nf3 Re8 O-O Nf8 Rab1' },
  { structureId: 'iqp', opening: 'Caro-Kann, attaque Panov', moves: 'e4 c6 d4 d5 exd5 cxd5 c4 Nf6 Nc3 e6 Nf3 Be7 cxd5 Nxd5 Bd3 Nc6 O-O O-O Re1' },
  { structureId: 'hanging-pawns', opening: 'Gambit Dame refusé, Tartakover', moves: 'd4 d5 c4 e6 Nc3 Nf6 Bg5 Be7 e3 O-O Nf3 h6 Bh4 b6 cxd5 Nxd5 Bxe7 Qxe7 Nxd5 exd5 Rc1 Be6 Qa4 c5 Qa3 Rc8 Be2 Nd7 dxc5 bxc5' },
  { structureId: 'caro-slav', opening: 'Caro-Kann classique', moves: 'e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf5 Ng3 Bg6 h4 h6 Nf3 Nd7 h5 Bh7 Bd3 Bxd3 Qxd3 e6' },
  { structureId: 'french-chain', opening: 'Défense française, variante d\'avance', moves: 'e4 e6 d4 d5 e5 c5 c3 Nc6 Nf3 Qb6 a3' },
  { structureId: 'kid-closed', opening: 'Est-indienne classique', moves: 'd4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3 O-O Be2 e5 O-O Nc6 d5 Ne7 Ne1 Nd7 Nd3 f5' },
  { structureId: 'benoni', opening: 'Benoni moderne', moves: 'd4 Nf6 c4 c5 d5 e6 Nc3 exd5 cxd5 d6 e4 g6 Nf3 Bg7 Be2 O-O O-O' },
  { structureId: 'maroczy', opening: 'Sicilienne, Dragon accéléré', moves: 'e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 g6 c4 Bg7 Be3 Nf6 Nc3 O-O Be2 d6' },
  { structureId: 'hedgehog', opening: 'Anglaise symétrique, Hérisson', moves: 'c4 c5 Nf3 Nf6 Nc3 e6 g3 b6 Bg2 Bb7 O-O a6 d4 cxd4 Nxd4 Qc7 e4 d6' },
  { structureId: 'scheveningen', opening: 'Sicilienne Scheveningen', moves: 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 e6 Be2 Be7 O-O O-O f4 Nc6' },
  { structureId: 'boleslavsky', opening: 'Sicilienne Najdorf, 6.Be2 e5', moves: 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be2 e5 Nb3 Be7 O-O O-O' },
  { structureId: 'dragon', opening: 'Sicilienne Dragon, attaque yougoslave', moves: 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6 Be3 Bg7 f3 O-O Qd2 Nc6 O-O-O' },
  { structureId: 'stonewall', opening: 'Hollandaise Stonewall', moves: 'd4 f5 c4 Nf6 g3 e6 Bg2 d5 Nf3 c6 O-O Bd6' },
  { structureId: 'nimzo-doubled', opening: 'Nimzo-indienne, Sämisch', moves: 'd4 Nf6 c4 e6 Nc3 Bb4 a3 Bxc3+ bxc3 c5 e3 Nc6 Bd3 O-O' },
  { structureId: 'triangle', opening: 'Système de Londres', moves: 'd4 d5 Bf4 Nf6 e3 e6 Nf3 c5 c3 Nc6 Nbd2 Bd6 Bg3 O-O Bd3' },
  { structureId: 'big-center', opening: 'Grünfeld, variante d\'échange', moves: 'd4 Nf6 c4 g6 Nc3 d5 cxd5 Nxd5 e4 Nxc3 bxc3 Bg7 Bc4 O-O Ne2' },
  { structureId: 'slav', opening: 'Slave, 4...dxc4 5.a4 Bf5', fen: 'r2qk2r/pp1n1ppp/2p1pnb1/8/PbBP4/2N1PN2/1P2QPPP/R1B2RK1 w kq - 5 10' },
  { structureId: 'panov-chain', opening: 'Caro-Kann Panov (Dreev – Galic, 2008)', fen: 'r4rk1/ppqnbppp/4pn2/2Pp4/3P2b1/1P1B1N2/PBQN1PPP/R4RK1 b - - 0 13' },
  { structureId: 'd5-chain', opening: 'Sicilienne (Flores Rios – Delgado, 2009)', fen: 'rn1q1rk1/pp2bppp/3p1n2/3Pp3/8/1N2BP2/PPPQ2PP/R3KB1R w KQ - 1 12' },
  { structureId: 'benoni-sym', opening: 'Benoni (Malakhov – Grischuk, 2010)', fen: 'rnbq1rk1/pp3pbp/3p1np1/2pP4/2P5/2NB3P/PP2NPP1/R1BQK2R b KQ - 0 9' },
  { structureId: 'french-open', opening: 'Française (Shahade – Akobian, 2012)', fen: 'r1b1k2r/pp4pp/1qnbpn2/3p4/3P4/3B1N2/PP2NPPP/R1BQ1RK1 w kq - 2 12' },
  { structureId: 'french-e5', opening: 'Française (Maze – Ni Hua, 2011)', fen: 'r3k2r/1p3ppp/2q1p1b1/p2pPn2/3B4/2P5/PP2NPPP/2RQ1RK1 b kq - 0 16' },
  { structureId: 'majority-3-4', opening: 'Caro-Kann / Slave (Nguyen – Le Quang Liem, 2012)', fen: 'r2q1rk1/p2b1ppp/4pb2/1p6/3NB3/2P3P1/PP3P1P/R2Q1RK1 b - - 0 14' },
]

const fenCache = new Map<string, string>()

export function sampleFen(s: StructureSample): string {
  if (s.fen) return s.fen
  const moves = s.moves ?? ''
  const hit = fenCache.get(moves)
  if (hit) return hit
  const c = new Chess()
  for (const m of moves.split(' ').filter(Boolean)) c.move(m)
  const fen = c.fen()
  fenCache.set(moves, fen)
  return fen
}
