/**
 * Live-room actions and permissions, without a second real account:
 * hostRoom/joinRoom run against an in-memory fake of the action tools, and
 * the rooms/players rules are checked with the SDK's own permission
 * functions (the same ones the record room enforces).
 */

import { describe, expect, it } from 'vitest'
import { canCreate, canRead, canUpdate, checkFieldPermissions } from 'deepspace/worker'
import type { ActionResult, ActionTools } from 'deepspace/worker'
import { roomsSchema, type Room } from '../schemas/rooms-schema'
import { playersSchema } from '../schemas/players-schema'
import type { Quiz } from '../schemas/quizzes-schema'
import { hostRoom } from './host-room'
import { joinRoom } from './join-room'

type Row = { recordId: string; data: Record<string, unknown>; createdBy: string; createdAt: string }

/** Shared across all fakes so createdAt order matches creation order. */
let seq = 0

/** Minimal in-memory ActionTools: get/query/create/update with players' uniqueOn. */
function fakeTools(userId: string, db: Map<string, Map<string, Row>>) {
  const table = (c: string) => db.get(c) ?? db.set(c, new Map()).get(c)!
  const ok = <T>(data: T): ActionResult<T> => ({ success: true, data })
  const tools = {
    async get(c: string, id: string) {
      const row = table(c).get(id)
      return row ? ok({ record: { ...row, updatedAt: row.createdAt } }) : { success: false as const, error: 'not found' }
    },
    async query(c: string, opts?: { where?: Record<string, unknown>; orderDir?: 'asc' | 'desc'; limit?: number }) {
      let rows = [...table(c).values()].filter((r) =>
        Object.entries(opts?.where ?? {}).every(([k, v]) => r.data[k] === v),
      )
      rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      if (opts?.orderDir === 'desc') rows = rows.reverse()
      const records = rows.slice(0, opts?.limit ?? 50).map((r) => ({ ...r, updatedAt: r.createdAt }))
      return ok({ records, count: records.length })
    },
    async create(c: string, data: Record<string, unknown>) {
      if (c === 'players' && [...table(c).values()].some((r) => r.data.roomId === data.roomId && r.data.userId === userId)) {
        return { success: false as const, error: `Duplicate: a record with roomId=${data.roomId}, userId=${userId} already exists in players` }
      }
      const recordId = `${c}-${++seq}-${userId}`
      const stamped = c === 'players' ? { ...data, userId } : c === 'rooms' ? { ...data, hostId: userId } : data
      table(c).set(recordId, { recordId, data: stamped, createdBy: userId, createdAt: String(seq).padStart(8, '0') })
      return ok({ recordId })
    },
    async update(c: string, id: string, patch: Record<string, unknown>) {
      const row = table(c).get(id)
      if (!row) return { success: false as const, error: 'not found' }
      row.data = { ...row.data, ...patch }
      return ok({ recordId: id })
    },
  }
  return tools as unknown as ActionTools
}

function setup() {
  const db = new Map<string, Map<string, Row>>()
  const quiz: Quiz = {
    ownerId: 'host',
    bookId: 'b1',
    chapterTitle: 'Chapter 2',
    pageStart: 13,
    pageEnd: 20,
    sourceText: '[p.13] secret source',
    questions: [
      { type: 'mcq', prompt: 'Q1?', choices: ['A', 'B', 'C', 'D'], answerIndex: 2, explanation: 'Because.', sourcePage: 13 },
      { type: 'short', prompt: 'Why?', expectedAnswer: 'So.', explanation: 'See text.', sourcePage: 14 },
    ],
  }
  db.set('quizzes', new Map([['quiz1', { recordId: 'quiz1', data: quiz as unknown as Record<string, unknown>, createdBy: 'host', createdAt: '0' }]]))
  db.set('users', new Map([
    ['host', { recordId: 'host', data: { name: 'Rowel Timbal' }, createdBy: 'host', createdAt: '0' }],
    ['drew', { recordId: 'drew', data: { name: 'Drew Smith' }, createdBy: 'drew', createdAt: '0' }],
  ]))
  const call = (userId: string, action: typeof hostRoom, params: Record<string, unknown>) =>
    action({ userId, params, tools: fakeTools(userId, db), env: {} as never, callerJwt: 'jwt' })
  const room = (id: string) => db.get('rooms')!.get(id)!.data as unknown as Room
  return { db, call, room }
}

describe('hostRoom', () => {
  it('creates a lobby with a valid code, the host as first player, and NO answers', async () => {
    const { call, room, db } = setup()
    const res = await call('host', hostRoom, { quizId: 'quiz1' })
    expect(res.success).toBe(true)
    const { roomId, code } = (res as { data: { roomId: string; code: string } }).data
    expect(code).toMatch(/^[A-HJ-NP-Z]{4}$/)
    const r = room(roomId)
    expect(r).toMatchObject({ status: 'lobby', currentIndex: 0, hostId: 'host', title: 'Chapter 2' })
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

  it('only the host can update, and only status/currentIndex', () => {
    expect(canUpdate(roomsSchema, 'member', lobby, 'host')).toBe(true)
    expect(canUpdate(roomsSchema, 'member', lobby, 'drew')).toBe(false)
    expect(checkFieldPermissions(roomsSchema, 'member', { status: 'question', currentIndex: 1 })).toBeNull()
    expect(checkFieldPermissions(roomsSchema, 'member', { questions: [] })).toMatch(/questions/)
    expect(checkFieldPermissions(roomsSchema, 'member', { playerIds: ['x'] })).toMatch(/playerIds/)
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
})
