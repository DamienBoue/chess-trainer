// Map an ECO code (e.g. "C50", "B23") to a parent opening family name.
// The chess.com `ECOUrl` slug (e.g. "Italian-Game-Two-Knights-Defense") gives
// us the leaf variation name, but the families are noisy; ECO ranges are far
// more reliable to bucket games into the canonical parent.
export function parentByEco(eco: string | undefined): string | null {
  if (!eco) return null
  const letter = eco[0]?.toUpperCase()
  const num = parseInt(eco.slice(1), 10)
  if (!letter || isNaN(num)) return null

  switch (letter) {
    case 'A':
      if (num <= 9) return 'Flank Opening'
      if (num <= 39) return 'English Opening'
      if (num <= 44) return 'Modern Defense'
      if (num <= 49) return 'Indian Game'
      if (num <= 79) return 'Indian Defense'
      return 'Dutch Defense'
    case 'B':
      if (num === 0) return "King's Pawn (uncommon)"
      if (num === 1) return 'Scandinavian Defense'
      if (num >= 2 && num <= 5) return "Alekhine's Defense"
      if (num === 6) return 'Modern Defense'
      if (num <= 9) return 'Pirc Defense'
      if (num <= 19) return 'Caro-Kann Defense'
      return 'Sicilian Defense'
    case 'C':
      if (num <= 19) return 'French Defense'
      if (num <= 29) return "King's Pawn Game"
      if (num <= 39) return "King's Gambit"
      if (num <= 49) return "King's Knight Opening"
      if (num <= 59) return 'Italian Game'
      return 'Ruy López'
    case 'D':
      if (num <= 5) return "Queen's Pawn Game"
      if (num <= 69) return "Queen's Gambit"
      return 'Grünfeld Defense'
    case 'E':
      if (num <= 9) return 'Catalan Opening'
      if (num <= 19) return "Queen's Indian Defense"
      if (num <= 59) return 'Nimzo-Indian Defense'
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
  // Take first 2 words as a soft fallback
  return parts.slice(0, 2).join(' ') || null
}

export function getParentOpening(eco: string | undefined, name: string | undefined): string {
  return parentByEco(eco) ?? parentFromName(name) ?? 'Inconnue'
}
