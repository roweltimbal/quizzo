/**
 * submitAnswer — a player locks their answer to the current live question
 * (docs/SPEC.md § Live quiz).
 *
 * Checks the caller is in the room, the room is on that question, and the
 * response fits the question. Creates the caller's answer row (uniqueOn
 * room + user + question: once per question) WITHOUT grading it; grading
 * happens when the host closes the question (advanceRoom), so nothing
 * correct/incorrect exists while the question is open.
 *
 * Then updates room.answered, which drives "3/4 answered".
 */

import type { ActionHandler } from 'deepspace/worker'
import { z } from 'zod'
import type { Env } from '../../worker'
import { MAX_SHORT_ANSWER_CHARS } from '../lib/quiz'
import { loadRoom, syncAnswered } from './room-shared'

const paramsSchema = z.object({
  roomId: z.string().min(1),
  questionIndex: z.number().int().min(0),
  response: z.union([z.number().int(), z.string()]),
})

const NOT_FOUND = 'Room not found.'
const CLOSED = 'This question has closed.'

export const submitAnswer: ActionHandler<Env> = async ({ userId, params, tools }) => {
  const input = paramsSchema.safeParse(params)
  if (!input.success) return { success: false, error: 'Invalid request.' }
  const { roomId, questionIndex } = input.data
  let response = input.data.response

  // Membership: RBAC is off for action tools, so check it here.
  const room = await loadRoom(tools, roomId)
  if (!room || !room.playerIds?.includes(userId)) return { success: false, error: NOT_FOUND }
  if (room.status !== 'question' || room.currentIndex !== questionIndex) return { success: false, error: CLOSED }

  const q = room.questions[questionIndex]
  if (!q) return { success: false, error: CLOSED }
  if (q.type === 'mcq') {
    if (typeof response !== 'number' || response < 0 || response >= (q.choices?.length ?? 0)) {
      return { success: false, error: 'Pick one option.' }
    }
  } else {
    if (typeof response !== 'string' || !response.trim() || response.length > MAX_SHORT_ANSWER_CHARS) {
      return { success: false, error: `Write an answer of up to ${MAX_SHORT_ANSWER_CHARS} characters.` }
    }
    response = response.trim()
  }

  const created = await tools.create('answers', { roomId, userId, questionIndex, response, graded: false })
  if (!created.success) {
    if (/duplicate/i.test(created.error)) return { success: false, error: 'Your answer is already locked.' }
    console.error('[submitAnswer] create failed', created.error)
    return { success: false, error: "Couldn't save your answer. Try again." }
  }

  // The host may have closed the question between the check and the insert.
  // Then the closing grade pass may not have seen this row, so take it back.
  const after = await loadRoom(tools, roomId)
  if (!after || after.status !== 'question' || after.currentIndex !== questionIndex) {
    const removed = await tools.remove('answers', created.data.recordId)
    if (!removed.success) console.error('[submitAnswer] could not remove a late answer', removed.error)
    return { success: false, error: CLOSED }
  }

  const settled = await syncAnswered(tools, roomId)
  if (!settled) console.warn(`[submitAnswer] answered list did not settle for room ${roomId}`)
  return { success: true, data: { locked: true } }
}
