/**
 * Test helper (not shipped code): a minimal in-memory ActionTools with
 * get/query/create/update/remove, the uniqueOn rules of `players` and
 * `answers`, and the server's userBound stamping. Plus a seeded quiz.
 */

import type { ActionHandler, ActionResult, ActionTools } from 'deepspace/worker'
import type { Quiz } from '../schemas/quizzes-schema'
import type { Room } from '../schemas/rooms-schema'

export type Row = { recordId: string; data: Record<string, unknown>; createdBy: string; createdAt: string }
export type Db = Map<string, Map<string, Row>>

/** Shared across all fakes so createdAt order matches creation order. */
let seq = 0

const UNIQUE: Record<string, string[]> = {
  players: ['roomId', 'userId'],
  answers: ['roomId', 'userId', 'questionIndex'],
}
const OWNER_FIELD: Record<string, string> = { players: 'userId', answers: 'userId', rooms: 'hostId' }

export function fakeTools(userId: string, db: Db): ActionTools {
  const table = (c: string) => db.get(c) ?? db.set(c, new Map()).get(c)!
  const ok = <T>(data: T): ActionResult<T> => ({ success: true, data })
  const tools = {
    async get(c: string, id: string) {
      const row = table(c).get(id)
      return row
        ? ok({ record: { ...row, data: structuredClone(row.data), updatedAt: row.createdAt } })
        : { success: false as const, error: 'not found' }
    },
    async query(c: string, opts?: { where?: Record<string, unknown>; orderDir?: 'asc' | 'desc'; limit?: number }) {
      let rows = [...table(c).values()].filter((r) =>
        Object.entries(opts?.where ?? {}).every(([k, v]) => r.data[k] === v),
      )
      rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      if (opts?.orderDir === 'desc') rows = rows.reverse()
      const records = rows
        .slice(0, opts?.limit ?? 50)
        .map((r) => ({ ...r, data: structuredClone(r.data), updatedAt: r.createdAt }))
      return ok({ records, count: records.length })
    },
    async create(c: string, data: Record<string, unknown>) {
      const ownerField = OWNER_FIELD[c]
      const stamped = ownerField ? { ...data, [ownerField]: userId } : { ...data }
      const unique = UNIQUE[c]
      if (unique && [...table(c).values()].some((r) => unique.every((k) => r.data[k] === stamped[k]))) {
        return { success: false as const, error: `Duplicate: a record with ${unique.join(', ')} already exists in ${c}` }
      }
      const recordId = `${c}-${++seq}-${userId}`
      table(c).set(recordId, { recordId, data: stamped, createdBy: userId, createdAt: String(seq).padStart(8, '0') })
      return ok({ recordId })
    },
    async update(c: string, id: string, patch: Record<string, unknown>) {
      const row = table(c).get(id)
      if (!row) return { success: false as const, error: 'not found' }
      row.data = { ...row.data, ...structuredClone(patch) }
      return ok({ recordId: id })
    },
    async remove(c: string, id: string) {
      return table(c).delete(id) ? ok({ recordId: id }) : { success: false as const, error: 'not found' }
    },
  }
  return tools as unknown as ActionTools
}

export const seededQuiz = (): Quiz => ({
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
})

export function setup(users: Record<string, string> = { host: 'Rowel Timbal', drew: 'Drew Smith' }) {
  const db: Db = new Map()
  const row = (recordId: string, data: unknown, createdBy = 'host'): [string, Row] => [
    recordId,
    { recordId, data: data as Record<string, unknown>, createdBy, createdAt: '0' },
  ]
  db.set('quizzes', new Map([row('quiz1', seededQuiz())]))
  db.set('books', new Map([row('b1', { ownerId: 'host', title: 'Science Book' })]))
  db.set('users', new Map(Object.entries(users).map(([id, name]) => row(id, { name }, id))))
  const call = (userId: string, action: ActionHandler<never>, params: Record<string, unknown>) =>
    action({ userId, params, tools: fakeTools(userId, db), env: {} as never, callerJwt: 'jwt' })
  const room = (id: string) => db.get('rooms')!.get(id)!.data as unknown as Room
  const answers = () => [...(db.get('answers')?.values() ?? [])].map((r) => r.data)
  return { db, call, room, answers }
}
