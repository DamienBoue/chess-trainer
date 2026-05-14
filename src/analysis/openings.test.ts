import { describe, expect, it } from 'vitest'
import { parentByEco, parentFromName, getParentOpening } from './openings'

describe('parentByEco', () => {
  it('returns null on missing or malformed ECO', () => {
    expect(parentByEco(undefined)).toBeNull()
    expect(parentByEco('')).toBeNull()
    expect(parentByEco('X42')).toBeNull()
    expect(parentByEco('B99x')).not.toBeNull() // parseInt('99x') = 99 — tolerated
  })

  it('classifies Sicilian Najdorf in B90-99 range', () => {
    expect(parentByEco('B90')).toBe('Sicilienne Najdorf')
    expect(parentByEco('B99')).toBe('Sicilienne Najdorf')
  })

  it('separates classical sicilian families', () => {
    expect(parentByEco('B30')).toBe('Sicilienne (accélérée)')
    expect(parentByEco('B70')).toBe('Sicilienne Dragon')
    expect(parentByEco('B85')).toBe('Sicilienne Scheveningen')
  })

  it('classifies open games (C-codes) by sub-family', () => {
    expect(parentByEco('C50')).toBe('Italian Game')
    expect(parentByEco('C60')).toBe('Ruy López')
    expect(parentByEco('C45')).toBe('Scotch Game')
    expect(parentByEco('C00')).toBe('French Defense')
  })

  it('classifies d4 systems', () => {
    expect(parentByEco('D20')).toBe("Queen's Gambit Accepted")
    expect(parentByEco('D40')).toBe('Semi-Slav Defense')
    expect(parentByEco('D70')).toBe('Grünfeld Defense')
    expect(parentByEco('E20')).toBe('Nimzo-Indian Defense')
    expect(parentByEco('E60')).toBe("King's Indian Defense")
  })

  it('returns null for empty letter / invalid', () => {
    expect(parentByEco('Z00')).toBeNull()
  })
})

describe('parentFromName', () => {
  it('extracts up to a known keyword', () => {
    expect(parentFromName('Sicilian-Defense-Najdorf-Variation')).toBe('Sicilian Defense')
    expect(parentFromName('Italian Game Classical')).toBe('Italian Game')
    expect(parentFromName("King's Gambit Accepted")).toBe("King's Gambit")
  })

  it('falls back to first 2 words when no keyword found', () => {
    expect(parentFromName('Some Weird Variant')).toBe('Some Weird')
  })

  it('returns null on empty input', () => {
    expect(parentFromName(undefined)).toBeNull()
    expect(parentFromName('')).toBeNull()
  })
})

describe('getParentOpening', () => {
  it('prefers ECO when available', () => {
    expect(getParentOpening('C50', 'Random Name')).toBe('Italian Game')
  })

  it('falls back to name when ECO is unknown', () => {
    expect(getParentOpening(undefined, 'Catalan Opening Open')).toBe('Catalan Opening')
  })

  it('returns "Inconnue" when nothing is known', () => {
    expect(getParentOpening(undefined, undefined)).toBe('Inconnue')
  })
})
