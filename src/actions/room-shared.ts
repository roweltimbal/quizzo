/**
 * Server helpers for live rooms, shared by the room actions (hostRoom,
 * joinRoom, advanceRoom, submitAnswer) and the short-answer grading job.
 *
 * Action tools run with record permissions off, so these act as the app.
 * Callers check who is allowed to do what before calling them.
 */

import type { ActionTools } from 'deepspace/worker'
import type { Answer } from '../schemas/answers-schema'
import type { Player } from '../schemas/players-schema'
import type { Quiz } from '../schemas/quizzes-schema'
import type { Room } from '../schemas/rooms-schema'
import { buildLeaderboard, labelPlayers } from '../lib/leaderboard'
import { playerDisplayName, type RoomPlayer } from '../lib/room'
import { SHORT_PASS_SCORE } from '../lib/quiz'
import { gradeShortAnswer, type GenerateFn } from '../lib/grade-short-answer'

type Patch = Record<string, unknown>

/** The user's profile name (users collection, id = user id). */
async function profileName(tools: ActionTools, userId: string): Promise<unknown> {
  const user = await tools.get<Record<string, unknown>>('users', userId)
  return user.success ? user.data.record?.data?.name : undefined
}

/** First name from the user's profile. */
export async function displayNameFor(tools: ActionTools, userId: string): Promise<string> {
  return playerDisplayName(await profileName(tools, userId))
}

export async function loadRoom(tools: ActionTools, roomId: string): Promise<Room | undefined> {
  const found = await tools.get<Record<string, unknown>>('rooms', roomId)
  return found.success ? (found.data.record?.data as unknown as Room | undefined) : undefined
}

export async function loadQuiz(tools: ActionTools, quizId: string): Promise<Quiz | undefined> {
  const found = await tools.get<Record<string, unknown>>('quizzes', quizId)
  return found.success ? (found.data.record?.data as unknown as Quiz | undefined) : undefined
}

/** The room's players, from the `players` rows (unique per room + user), in join order. */
export async function listPlayers(tools: ActionTools, roomId: string): Promise<RoomPlayer[]> {
  const rows = await tools.query<Record<string, unknown>>('players', {
    where: { roomId },
    orderBy: 'createdAt',
    orderDir: 'asc',
    limit: 200,
  })
  if (!rows.success) return []
  return rows.data.records.map((r) => {
    const p = r.data as unknown as Player
    return { userId: p.userId, displayName: p.displayName }
  })
}

/** Answer rows for a room, optionally for one question. */
export async function listAnswers(
  tools: ActionTools,
  roomId: string,
  questionIndex?: number,
): Promise<{ recordId: string; answer: Answer }[]> {
  const where: Record<string, unknown> = questionIndex === undefined ? { roomId } : { roomId, questionIndex }
  const rows = await tools.query<Record<string, unknown>>('answers', { where, limit: 1000 })
  if (!rows.success) throw new Error(`answers query failed: ${rows.error}`)
  return rows.data.records.map((r) => ({ recordId: r.recordId, answer: r.data as unknown as Answer }))
}

/**
 * Rewrites room.players / room.playerIds from the `players` rows, with
 * display labels (a last initial or a number when first names clash).
 *
 * Two joins at once could each write a list missing the other (read, then
 * write). Rebuilding from the rows and re-checking until the room matches
 * makes the last writer include everyone. Returns false if it never settled.
 */
export async function syncRoomPlayers(tools: ActionTools, roomId: string, hostId: string): Promise<boolean> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const rows = await listPlayers(tools, roomId)
    const names = await Promise.all(
      rows.map(async (p) => ({ userId: p.userId, name: (await profileName(tools, p.userId)) ?? p.displayName })),
    )
    const players = labelPlayers(names)
    const playerIds = [...new Set([hostId, ...players.map((p) => p.userId)])]
    const updated = await tools.update<Patch>('rooms', roomId, { players, playerIds })
    if (!updated.success) return false

    const stored = (await loadRoom(tools, roomId))?.playerIds ?? []
    const latest = await listPlayers(tools, roomId)
    if (latest.every((p) => stored.includes(p.userId))) return true
  }
  return false
}

/**
 * Sets room.answered to who has answered the CURRENT question, rebuilt from
 * the answer rows and re-checked (same pattern as syncRoomPlayers), so two
 * players answering at once are both counted.
 */
export async function syncAnswered(tools: ActionTools, roomId: string): Promise<boolean> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const room = await loadRoom(tools, roomId)
    if (!room || room.status !== 'question') return true
    const index = room.currentIndex
    const userIds = (await listAnswers(tools, roomId, index)).map((r) => r.answer.userId)
    const updated = await tools.update<Patch>('rooms', roomId, { answered: { index, userIds } })
    if (!updated.success) return false

    const after = await loadRoom(tools, roomId)
    if (!after || after.status !== 'question') return true
    if (after.currentIndex !== index) continue
    const latest = (await listAnswers(tools, roomId, index)).map((r) => r.answer.userId)
    const stored = after.answered?.index === index ? after.answered.userIds : []
    if (latest.every((id) => stored.includes(id))) return true
  }
  return false
}

/** Number of closed questions: all of them at results, else the ones before the current one. */
export function closedCount(room: Room): number {
  if (room.status === 'results') return room.questions.length
  if (room.status === 'question') return room.currentIndex
  return 0
}

/** Recomputes room.leaderboard from the answer rows. */
export async function refreshLeaderboard(tools: ActionTools, roomId: string): Promise<void> {
  const room = await loadRoom(tools, roomId)
  if (!room) return
  const answers = (await listAnswers(tools, roomId)).map((r) => r.answer)
  const leaderboard = buildLeaderboard(room.players ?? [], answers, closedCount(room))
  const updated = await tools.update<Patch>('rooms', roomId, { leaderboard })
  if (!updated.success) throw new Error(`leaderboard update failed: ${updated.error}`)
}

/**
 * Grades the multiple-choice rows of a closed question, in code. Rows
 * already graded are left alone, so calling it twice is harmless. Short
 * answers are left for the grading job.
 */
export async function gradeClosedQuestion(tools: ActionTools, roomId: string, quiz: Quiz, index: number): Promise<void> {
  const q = quiz.questions[index]
  if (!q || q.type !== 'mcq') return
  for (const { recordId, answer } of await listAnswers(tools, roomId, index)) {
    if (answer.graded) continue
    const isCorrect = answer.response === q.answerIndex
    const updated = await tools.update<Patch>('answers', recordId, { graded: true, isCorrect, score: isCorrect ? 1 : 0 })
    if (!updated.success) throw new Error(`answer update failed: ${updated.error}`)
  }
}

/**
 * Grades every ungraded short answer in a finished room with the AI, one
 * row at a time, refreshing the leaderboard after each so it fills in live.
 * Already-graded rows are skipped, so a retry never pays for the same
 * answer twice. Throws on a record error (the job then retries).
 */
export async function gradeRoomShortAnswers(tools: ActionTools, roomId: string, generate: GenerateFn): Promise<number> {
  const room = await loadRoom(tools, roomId)
  if (!room || room.status !== 'results') return 0
  const quiz = await loadQuiz(tools, room.quizId)
  if (!quiz) throw new Error(`quiz ${room.quizId} not found for room ${roomId}`)

  const todo = (await listAnswers(tools, roomId)).filter(
    (r) => !r.answer.graded && quiz.questions[r.answer.questionIndex]?.type === 'short',
  )
  for (const { recordId, answer } of todo) {
    const q = quiz.questions[answer.questionIndex]
    const grade = await gradeShortAnswer(
      generate,
      {
        question: q.prompt,
        expectedAnswer: q.expectedAnswer ?? '',
        answer: String(answer.response),
        sourceText: quiz.sourceText,
        pageStart: quiz.pageStart,
        pageEnd: quiz.pageEnd,
        sourcePage: q.sourcePage,
      },
      'gradeRoom',
    )
    const patch: Patch = grade.graded
      ? { graded: true, isCorrect: grade.score >= SHORT_PASS_SCORE, score: grade.score, feedback: grade.feedback, page: grade.page }
      : { graded: true, isCorrect: false, score: null, feedback: null, page: null }
    const updated = await tools.update<Patch>('answers', recordId, patch)
    if (!updated.success) throw new Error(`answer update failed: ${updated.error}`)
    await refreshLeaderboard(tools, roomId)
  }
  return todo.length
}
