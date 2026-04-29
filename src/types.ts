export type Color = 'white' | 'black'

export type GameResult = 'win' | 'loss' | 'draw'

export interface ChessComPlayerSide {
  rating: number
  result: string
  '@id': string
  username: string
  uuid?: string
}

export interface ChessComGame {
  url: string
  pgn: string
  time_control: string
  end_time: number
  rated: boolean
  time_class: string
  rules: string
  white: ChessComPlayerSide
  black: ChessComPlayerSide
  eco?: string
}

export interface ArchiveResponse {
  games: ChessComGame[]
}

export interface ArchivesListResponse {
  archives: string[]
}

export type MoveClassification =
  | 'best'
  | 'great'
  | 'good'
  | 'inaccuracy'
  | 'mistake'
  | 'blunder'
  | 'book'

export interface MoveAnalysis {
  ply: number
  san: string
  fenBefore: string
  fenAfter: string
  evalBefore: number  // centipawns from white's perspective; mate uses ±100000 + plies
  evalAfter: number
  bestMoveSan?: string
  bestLineSan?: string
  classification: MoveClassification
  cpLoss: number  // from the mover's perspective, in centipawns; >= 0
  isMate?: boolean
}

export interface GameAnalysis {
  pgn: string
  moves: MoveAnalysis[]
  userColor: Color
  opening?: string
  ecoCode?: string
  result: GameResult
  opponent: string
  opponentRating?: number
  userRating?: number
  endTime: number
  timeClass: string
  url: string
}
