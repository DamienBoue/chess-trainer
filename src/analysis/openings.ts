// Map an ECO code (e.g. "C50", "B23") to a parent opening family name.
// We bucket by ECO range — finer-grained than just A/B/C/D/E so that
// distinct openings (Italian Game, Scotch Game, Ruy López, …) are not
// folded together into a single generic "King's Pawn" bucket.
export function parentByEco(eco: string | undefined): string | null {
  if (!eco) return null
  const letter = eco[0]?.toUpperCase()
  const num = parseInt(eco.slice(1), 10)
  if (!letter || isNaN(num)) return null

  switch (letter) {
    case 'A':
      if (num <= 5) return 'Irrégulière'
      if (num <= 9) return 'Reti / Bird'
      if (num <= 39) return 'English Opening'
      if (num <= 44) return 'Modern Defense'
      if (num <= 49) return 'Indian Game (1.d4 Nf6)'
      if (num <= 52) return 'Budapest Gambit'
      if (num <= 55) return 'Old Indian Defense'
      if (num <= 79) return 'Benoni Defense'
      return 'Dutch Defense'
    case 'B':
      if (num === 0) return 'Ouverture du roi (rare)'
      if (num === 1) return 'Scandinavian Defense'
      if (num >= 2 && num <= 5) return "Alekhine's Defense"
      if (num === 6) return 'Modern Defense'
      if (num <= 9) return 'Pirc Defense'
      if (num <= 19) return 'Caro-Kann Defense'
      // Sicilian, split into recognisable sub-families
      if (num <= 22) return 'Sicilienne (Alapin / Smith-Morra)'
      if (num <= 26) return 'Sicilienne fermée'
      if (num <= 39) return 'Sicilienne (accélérée)'
      if (num <= 49) return 'Sicilienne (Taimanov / Kan)'
      if (num <= 59) return 'Sicilienne classique'
      if (num <= 69) return 'Sicilienne Rauzer'
      if (num <= 79) return 'Sicilienne Dragon'
      if (num <= 89) return 'Sicilienne Scheveningen'
      return 'Sicilienne Najdorf'
    case 'C':
      if (num <= 19) return 'French Defense'
      // Open Games, sidelines (no 1.e4 e5 2.Nf3 lines)
      if (num === 20) return 'Ouverture du Roi (rare)'
      if (num <= 22) return 'Center Game'
      if (num <= 24) return 'Bishop\'s Opening'
      if (num <= 29) return 'Vienna Game'
      if (num <= 39) return "King's Gambit"
      // 1.e4 e5 2.Nf3 ...
      if (num <= 41) return 'Philidor Defense'
      if (num <= 43) return 'Petrov Defense'
      if (num === 44) return 'Scotch / Ponziani / italiennes (introductions)'
      if (num === 45) return 'Scotch Game'
      if (num <= 49) return 'Quatre Cavaliers'
      if (num <= 59) return 'Italian Game'
      return 'Ruy López'
    case 'D':
      if (num <= 5) return "Queen's Pawn Game"
      if (num <= 9) return 'Slav Defense (sidelines)'
      if (num <= 19) return 'Slav Defense'
      if (num <= 29) return "Queen's Gambit Accepted"
      if (num <= 35) return "Queen's Gambit Declined (Tarrasch / Slave-like)"
      if (num <= 49) return 'Semi-Slav Defense'
      if (num <= 69) return "Queen's Gambit Declined"
      return 'Grünfeld Defense'
    case 'E':
      if (num <= 9) return 'Catalan Opening'
      if (num <= 19) return "Queen's Indian Defense"
      if (num <= 39) return 'Nimzo-Indian Defense'
      if (num <= 59) return 'Nimzo-Indian / Bogo-Indian'
      return "King's Indian Defense"
  }
  return null
}

// Best-effort fallback when ECO is missing: take the first 1-2 segments of the
// chess.com opening slug up to a known opening keyword.
const KEYWORDS = ['Game', 'Defense', 'Opening', 'Gambit', 'Attack', 'System']
export function parentFromName(name: string | undefined): string | null {
  if (!name) return null
  const parts = name.replace(/-/g, ' ').split(/\s+/).filter(Boolean)
  for (let i = 0; i < parts.length; i++) {
    if (KEYWORDS.includes(parts[i])) {
      return parts.slice(0, i + 1).join(' ')
    }
  }
  return parts.slice(0, 2).join(' ') || null
}

export function getParentOpening(eco: string | undefined, name: string | undefined): string {
  return parentByEco(eco) ?? parentFromName(name) ?? 'Inconnue'
}
