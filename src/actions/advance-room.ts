/**
 * advanceRoom — the host moves the live game on (docs/SPEC.md § Live quiz).
 *
 *   start    lobby → question 0
 *   next     closes the current question (grades its multiple choice in
 *            code, updates the leaderboard) and shows the next one
 *   results  closes the last question, publishes the answer key, and
 *            queues the short-answer grading job
 *
 * Only the host may call it (rooms are read-only for clients, so this check
 * is what keeps "only the host controls the game"). `expectedIndex` is the
 * question the host was looking at: a double tap, or a tap after the room
 * already moved, does nothing.
 *
 * Order matters: the room's index/status changes FIRST, then the closed
 * question is graded. submitAnswer re-reads the room after inserting a row
 * and deletes it if the question has closed, so every row that survives is
 * seen by this grading pass (one Durable Object serializes the writes).
 */

import { enqueueJob } from 'deepspace/worker'
import type { ActionHandler, ActionTools } from 'deepspace/worker'
import { z } from 'zod'
import type { Env } from '../../worker'
import type { AnswerKeyEntry, Room } from '../schemas/rooms-schema'
import type { Quiz } from '../schemas/quizzes-schema'
import { buildLeaderboard } from '../lib/leaderboard'
import { claudeGenerate, type GenerateFn } from '../lib/grade-short-answer'
import { gradeClosedQuestion, gradeRoomShortAnswers, loadQuiz, loadRoom, refreshLeaderboard } from './room-shared'

export const GRADE_ROOM_JOB = 'grade-room-short-answers'

const paramsSchema = z.object({
  roomId: z.string().min(1),
  op: z.enum(['start', 'next', 'results']),
  expectedIndex: z.number().int().min(0).optional(),
})

const NOT_FOUND = 'Room not found.'
const FAILED = "Couldn't move the game on. Try again."

/** Correct answers for the Result screen, published at `results`. */
export function answerKeyFor(quiz: Quiz): AnswerKeyEntry[] {
  return quiz.questions.map((q) =>
    q.type === 'mcq'
      ? {
          answerIndex: q.answerIndex,
          correctAnswer: q.choices?.[q.answerIndex ?? -1] ?? '',
          explanation: q.explanation,
          sourcePage: q.sourcePage,
        }
      : { correctAnswer: q.expectedAnswer ?? '', explanation: q.explanation, sourcePage: q.sourcePage },
  )
}

/** `queueGrading` is injectable so tests don't need a job room. */
export function makeAdvanceRoom(queueGrading: (env: Env, tools: ActionTools, roomId: string) => Promise<void>): ActionHandler<Env> {
  return async ({ userId, params, tools, env }) => {
    const input = paramsSchema.safeParse(params)
    if (!input.success) return { success: false, error: 'Invalid request.' }
    const { roomId, op, expectedIndex } = input.data

    // Host only: RBAC is off for action tools, so check it here.
    const room = await loadRoom(tools, roomId)
    if (!room || room.hostId !== userId) return { success: false, error: NOT_FOUND }
    const total = room.questions.length
    const unchanged = { success: true as const, data: { status: room.status, currentIndex: room.currentIndex } }

    if (op === 'start') {
      if (room.status !== 'lobby') return unchanged
      const patch: Partial<Room> = {
        status: 'question',
        currentIndex: 0,
        answered: { index: 0, userIds: [] },
        leaderboard: buildLeaderboard(room.players ?? [], [], 0),
      }
      const updated = await tools.update('rooms', roomId, patch as Record<string, unknown>)
      if (!updated.success) return { success: false, error: FAILED }
      return { success: true, data: { status: 'question', currentIndex: 0 } }
    }

    // next / results: only from the question the host was looking at.
    if (room.status !== 'question' || room.currentIndex !== expectedIndex) return unchanged
    const closing = room.currentIndex
    const isLast = closing >= total - 1
    if (op === 'next' && isLast) return { success: false, error: 'This is the last question. Tap See results.' }
    if (op === 'results' && !isLast) return { success: false, error: 'Finish the other questions first.' }

    const quiz = await loadQuiz(tools, room.quizId)
    if (!quiz) return { success: false, error: FAILED }

    const patch: Partial<Room> =
      op === 'next'
        ? { currentIndex: closing + 1, answered: { index: closing + 1, userIds: [] } }
        : { status: 'results', answerKey: answerKeyFor(quiz) }
    const updated = await tools.update('rooms', roomId, patch as Record<string, unknown>)
    if (!updated.success) return { success: false, error: FAILED }

    try {
      await gradeClosedQuestion(tools, roomId, quiz, closing)
      await refreshLeaderboard(tools, roomId)
    } catch (err) {
      // The game has moved on either way; a later close or the job recomputes.
      console.error('[advanceRoom] grading the closed question failed', err)
    }

    if (op === 'results') await queueGrading(env, tools, roomId)
    return { success: true, data: { status: patch.status ?? 'question', currentIndex: patch.currentIndex ?? closing } }
  }
}

/** Real queueing: the job room for this app; inline grading if enqueue fails. */
export async function queueShortAnswerGrading(env: Env, tools: ActionTools, roomId: string, generate?: GenerateFn) {
  try {
    await enqueueJob(env.JOB_ROOMS, `app:${env.DEEPSPACE_APP_ID}`, GRADE_ROOM_JOB, { roomId }, { maxAttempts: 3 })
  } catch (err) {
    console.error('[advanceRoom] could not queue grading; grading inline', err)
    try {
      await gradeRoomShortAnswers(tools, roomId, generate ?? claudeGenerate(env))
    } catch (inlineErr) {
      console.error('[advanceRoom] inline grading failed', inlineErr)
    }
  }
}

export const advanceRoom = makeAdvanceRoom((env, tools, roomId) => queueShortAnswerGrading(env, tools, roomId))
