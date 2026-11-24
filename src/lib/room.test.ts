import { describe, expect, it } from 'vitest'
import { isValidRoomCode, makeRoomCode, normalizeRoomCode, playerDisplayName, ROOM_CODE_ALPHABET } from './room'

describe('room codes', () => {
  it('uses 24 letters with no I or O', () => {
    expect(ROOM_CODE_ALPHABET).toHaveLength(24)
    expect(ROOM_CODE_ALPHABET).not.toMatch(/[IO]/)
  })

  it('makes 4-letter codes from the alphabet', () => {
    for (let i = 0; i < 500; i++) {
      const code = makeRoomCode()
      expect(code).toMatch(/^[A-HJ-NP-Z]{4}$/)
      expect(isValidRoomCode(code)).toBe(true)
    }
  })

  it('is deterministic with an injected random source', () => {
    expect(makeRoomCode(() => 0)).toBe('AAAA')
    expect(makeRoomCode((n) => n - 1)).toBe('ZZZZ')
  })

  it('normalizes typed codes', () => {
    expect(normalizeRoomCode(' kmtr ')).toBe('KMTR')
    expect(normalizeRoomCode('km-tr')).toBe('KMTR')
    expect(isValidRoomCode('kmtr')).toBe(true)
  })

  it('rejects wrong length or confusable letters', () => {
    expect(isValidRoomCode('KMT')).toBe(false)
    expect(isValidRoomCode('KMTRS')).toBe(false)
    expect(isValidRoomCode('KOTR')).toBe(false)
    expect(isValidRoomCode('K1TR')).toBe(false)
    expect(isValidRoomCode('')).toBe(false)
  })
})

describe('playerDisplayName', () => {
  it('uses the first name only', () => {
    expect(playerDisplayName('Rowel Timbal')).toBe('Rowel')
    expect(playerDisplayName('  Drew  ')).toBe('Drew')
  })

  it('falls back to "Player"', () => {
    expect(playerDisplayName('')).toBe('Player')
    expect(playerDisplayName(undefined)).toBe('Player')
    expect(playerDisplayName(42)).toBe('Player')
  })
})
