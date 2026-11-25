/**
 * Live-room actions and permissions, without a second real account:
 * hostRoom/joinRoom run against an in-memory fake of the action tools, and
 * the rooms/players rules are checked with the SDK's own permission
 * functions (the same ones the record room enforces).
 */

import { describe, expect, it } from 'vitest'
import { canCreate, canDelete, canRead, canUpdate } from 'deepspace/worker'
import { roomsSchema, type Room } from '../schemas/rooms-schema'
import { playersSchema } from '../schemas/players-schema'
import { answersSchema } from '../schemas/answers-schema'
import { hostRoom } from './host-room'
import { joinRoom } from './join-room'
import { setup } from './test-fakes'

describe('hostRoom', () => {
  it('creates a lobby with a valid code, the host as first player, and NO answers', async () => {
    const { call, room, db } = setup()
    const res = await call('host', hostRoom, { quizId: 'quiz1' })
    expect(res.success).toBe(true)
    const { roomId, code } = (res as { data: { roomId: string; code: string } }).data
    expect(code).toMatch(/^[A-HJ-NP-Z]{4}$/)
    const r = room(roomId)
    expect(r).toMatchObject({ status: 'lobby', currentIndex: 0, hostId: 'host', title: 'Chapter 2', bookTitle: 'Science Book', answerKey: null })
    expect(r.players).toEqual([{ userId: 'host', displayName: 'Rowel' }])
    expect(r.playerIds).toEqual(['host'])
    expect(JSON.stringify(r)).not.toMatch(/answerIndex|expectedAnswer|explanation|secret source/)
    expect([...db.get('players')!.values()].map((p) => p.data.userId)).toEqual(['host'])
  })

  it("refuses someone else's quiz", async () => {
    const { call } = setup()
    expect(await call('drew', hostRoom, { quizId: 'quiz1' })).toEqual({ success: false, error: 'Quiz not found.' })
  })
})

describe('joinRoom', () => {
  it('adds the caller (first name only) and shows them in the room list', async () => {
    const { call, room } = setup()
    const hosted = (await call('host', hostRoom, { quizId: 'quiz1' })) as { data: { roomId: string; code: string } }
    const joined = await call('drew', joinRoom, { code: hosted.data.code.toLowerCase() })
    expect(joined).toEqual({ success: true, data: { roomId: hosted.data.roomId } })
    expect(room(hosted.data.roomId).players).toEqual([
      { userId: 'host', displayName: 'Rowel' },
      { userId: 'drew', displayName: 'Drew' },
    ])
    expect(room(hosted.data.roomId).playerIds).toEqual(['host', 'drew'])
  })

  it('rejoining does not duplicate the player', async () => {
    const { call, room, db } = setup()
    const hosted = (await call('host', hostRoom, { quizId: 'quiz1' })) as { data: { roomId: string; code: string } }
    await call('drew', joinRoom, { code: hosted.data.code })
    await call('drew', joinRoom, { code: hosted.data.code })
    expect(room(hosted.data.roomId).players).toHaveLength(2)
    expect([...db.get('players')!.values()]).toHaveLength(2)
  })

  it('"Room not found" for an unknown or malformed code', async () => {
    const { call } = setup()
    await call('host', hostRoom, { quizId: 'quiz1' })
    expect(await call('drew', joinRoom, { code: 'ZZZZ' })).toEqual({ success: false, error: 'Room not found' })
    expect(await call('drew', joinRoom, { code: 'KO1' })).toEqual({ success: false, error: 'Room not found' })
  })

  it('"Game already started" for a non-member once the room left the lobby; a member can still rejoin', async () => {
    const { call, room } = setup()
    const hosted = (await call('host', hostRoom, { quizId: 'quiz1' })) as { data: { roomId: string; code: string } }
    room(hosted.data.roomId).status = 'question'
    expect(await call('drew', joinRoom, { code: hosted.data.code })).toEqual({ success: false, error: 'Game already started' })
    expect(await call('host', joinRoom, { code: hosted.data.code })).toEqual({ success: true, data: { roomId: hosted.data.roomId } })
  })

  it('a finished room frees its code ("Room not found")', async () => {
    const { call, room } = setup()
    const hosted = (await call('host', hostRoom, { quizId: 'quiz1' })) as { data: { roomId: string; code: string } }
    room(hosted.data.roomId).status = 'results'
    expect(await call('drew', joinRoom, { code: hosted.data.code })).toEqual({ success: false, error: 'Room not found' })
  })
})

describe('rooms / players permissions (SDK rules)', () => {
  const record = (data: Partial<Room>) => ({ data: data as Record<string, unknown>, createdBy: 'host' })
  const lobby = record({ hostId: 'host', playerIds: ['host', 'drew'], status: 'lobby' })

  it('a room is readable by its host and players only', () => {
    expect(canRead(roomsSchema, 'member', lobby, 'host')).toBe(true)
    expect(canRead(roomsSchema, 'member', lobby, 'drew')).toBe(true)
    expect(canRead(roomsSchema, 'member', lobby, 'stranger')).toBe(false)
    expect(canRead(roomsSchema, 'viewer', lobby, 'drew')).toBe(false)
  })

  it('no client can write a room, not even the host (the game moves only through advanceRoom)', () => {
    for (const role of ['viewer', 'member', 'admin']) {
      expect(canUpdate(roomsSchema, role, lobby, 'host')).toBe(false)
      expect(canDelete(roomsSchema, role, lobby, 'host')).toBe(false)
    }
  })

  it('no client can create rooms or players', () => {
    for (const role of ['viewer', 'member', 'admin']) {
      expect(canCreate(roomsSchema, role)).toBe(false)
      expect(canCreate(playersSchema, role)).toBe(false)
    }
  })

  it('a player row is readable only by that player', () => {
    const row = { data: { roomId: 'r', userId: 'drew', displayName: 'Drew' }, createdBy: 'drew' }
    expect(canRead(playersSchema, 'member', row, 'drew')).toBe(true)
    expect(canRead(playersSchema, 'member', row, 'host')).toBe(false)
  })

  it('an answer row is readable only by its player, and no client can write answers', () => {
    const row = { data: { roomId: 'r', userId: 'drew', questionIndex: 0, response: 1, graded: false }, createdBy: 'drew' }
    expect(canRead(answersSchema, 'member', row, 'drew')).toBe(true)
    expect(canRead(answersSchema, 'member', row, 'host')).toBe(false)
    expect(canRead(answersSchema, 'viewer', row, 'drew')).toBe(false)
    for (const role of ['viewer', 'member', 'admin']) {
      expect(canCreate(answersSchema, role)).toBe(false)
      expect(canUpdate(answersSchema, role, row, 'drew')).toBe(false)
      expect(canDelete(answersSchema, role, row, 'drew')).toBe(false)
    }
  })
})
