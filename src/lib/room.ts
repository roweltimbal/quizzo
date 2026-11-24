/**
 * Live-room helpers shared by the hostRoom/joinRoom actions and the Join
 * screen (docs/SPEC.md § Lobby, Join room).
 *
 * Room codes follow partypack's format (see docs/LOG.md): 4 letters from a
 * 24-letter alphabet with no I or O, so they can't be misread as 1 or 0.
 * 24^4 ≈ 331k codes.
 */

export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
export const ROOM_CODE_LENGTH = 4

/** Uniform random integer in [0, n), from crypto (Workers and browsers). */
function cryptoInt(n: number): number {
  const buf = new Uint32Array(1)
  crypto.getRandomValues(buf)
  return buf[0] % n
}

/** A random room code. `rand` is injectable for tests. */
export function makeRoomCode(rand: (n: number) => number = cryptoInt): string {
  let out = ''
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) out += ROOM_CODE_ALPHABET[rand(ROOM_CODE_ALPHABET.length)]
  return out
}

/** Uppercase, strip spaces and dashes: " kmtr " / "km-tr" → "KMTR". */
export function normalizeRoomCode(code: string): string {
  return code.replace(/[\s-]+/g, '').toUpperCase()
}

/** True when a (normalized) code has the right length and only allowed letters. */
export function isValidRoomCode(code: string): boolean {
  const c = normalizeRoomCode(code)
  return c.length === ROOM_CODE_LENGTH && [...c].every((ch) => ROOM_CODE_ALPHABET.includes(ch))
}

/**
 * Name shown to other players: first word of the profile name, so a full
 * name isn't shared with the room (users are primary school students).
 */
export function playerDisplayName(name: unknown): string {
  const first = typeof name === 'string' ? name.trim().split(/\s+/)[0] : ''
  return first ? first.slice(0, 24) : 'Player'
}

export type RoomStatus = 'lobby' | 'question' | 'results'

export interface RoomPlayer {
  userId: string
  displayName: string
}

/** Statuses a code is still reserved in (a finished room frees its code). */
export const OPEN_ROOM_STATUSES: readonly RoomStatus[] = ['lobby', 'question']
