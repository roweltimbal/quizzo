/**
 * hostRoom — creates a live room for a quiz the caller generated
 * (docs/SPEC.md § Lobby). Called by /generate in host mode, right after
 * generateQuiz succeeds.
 *
 * Mints a 4-letter code unique among open rooms, copies the quiz's
 * answer-stripped questions onto the room, and adds the host as the first
 * player (the host plays too).
 */

import type { ActionHandler } from 'deepspace/worker'
import { z } from 'zod'
import type { Env } from '../../worker'
import type { Quiz } from '../schemas/quizzes-schema'
import type { Room } from '../schemas/rooms-schema'
import { toPublicQuestions } from '../lib/quiz'
import { makeRoomCode, OPEN_ROOM_STATUSES } from '../lib/room'
import { displayNameFor, syncRoomPlayers } from './room-shared'

const paramsSchema = z.object({ quizId: z.string().min(1) })

export const hostRoom: ActionHandler<Env> = async ({ userId, params, tools }) => {
  const input = paramsSchema.safeParse(params)
  if (!input.success) return { success: false, error: 'Invalid request.' }

  // Ownership: RBAC is off for action tools, so check it here.
  const found = await tools.get<Record<string, unknown>>('quizzes', input.data.quizId)
  const quiz = found.success ? (found.data.record?.data as unknown as Quiz | undefined) : undefined
  if (!quiz || quiz.ownerId !== userId) return { success: false, error: 'Quiz not found.' }

  // A code must be unique among open rooms (lobby or playing).
  let code: string | null = null
  for (let attempt = 0; attempt < 10 && !code; attempt++) {
    const candidate = makeRoomCode()
    const existing = await tools.query<Record<string, unknown>>('rooms', { where: { code: candidate }, limit: 20 })
    if (!existing.success) return { success: false, error: "Couldn't create the room. Try again." }
    const taken = existing.data.records.some((r) =>
      OPEN_ROOM_STATUSES.includes((r.data as unknown as Room).status),
    )
    if (!taken) code = candidate
  }
  if (!code) return { success: false, error: "Couldn't create the room. Try again." }

  const title =
    quiz.chapterTitle || (quiz.pageStart === quiz.pageEnd ? `p. ${quiz.pageStart}` : `pp. ${quiz.pageStart}–${quiz.pageEnd}`)
  const displayName = await displayNameFor(tools, userId)

  const room: Room = {
    code,
    quizId: input.data.quizId,
    hostId: userId,
    status: 'lobby',
    currentIndex: 0,
    title,
    questions: toPublicQuestions(quiz.questions),
    playerIds: [userId],
    players: [{ userId, displayName }],
  }
  const created = await tools.create('rooms', room as unknown as Record<string, unknown>)
  if (!created.success) {
    console.error('[hostRoom] create room failed', created.error)
    return { success: false, error: "Couldn't create the room. Try again." }
  }
  const roomId = created.data.recordId

  const player = await tools.create('players', { roomId, userId, displayName })
  if (!player.success) console.error('[hostRoom] create host player failed', player.error)
  await syncRoomPlayers(tools, roomId, userId)

  return { success: true, data: { roomId, code } }
}
