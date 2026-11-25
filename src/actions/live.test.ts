/**
 * Live quiz (screen 10) and live Result, server side: advanceRoom,
 * submitAnswer and the short-answer grading pass, against the in-memory
 * fake action tools with a stubbed AI. No real accounts or AI calls.
 */

import { describe, expect, it, vi } from 'vitest'
import type { ActionTools } from 'deepspace/worker'
import type { GenerateFn } from '../lib/grade-short-answer'
import { hostRoom } from './host-room'
import { joinRoom } from './join-room'
import { submitAnswer } from './submit-answer'
import { makeAdvanceRoom } from './advance-room'
import { gradeRoomShortAnswers } from './room-shared'
import { fakeTools, setup } from './test-fakes'

const okGrade: GenerateFn = async () => '{"score":1,"feedback":"Nice, you got the key idea.","page":14}'

async function liveRoom(players: string[] = ['drew']) {
  const users: Record<string, string> = { host: 'Rowel Timbal', drew: 'Drew Smith', jen: 'Jen Lee', sam: 'Sam Cruz' }
  const env = setup(users)
  const queued: string[] = []
  const advanceRoom = makeAdvanceRoom(async (_env, _tools, roomId) => {
    queued.push(roomId)
  })
  const hosted = (await env.call('host', hostRoom, { quizId: 'quiz1' })) as { data: { roomId: string; code: string } }
  for (const p of players) await env.call(p, joinRoom, { code: hosted.data.code })
  const roomId = hosted.data.roomId
  const advance = (op: string, expectedIndex?: number, as = 'host') =>
    env.call(as, advanceRoom, { roomId, op, expectedIndex })
  const submit = (as: string, questionIndex: number, response: number | string) =>
    env.call(as, submitAnswer, { roomId, questionIndex, response })
  const tools = fakeTools('system', env.db)
  return { ...env, roomId, advance, submit, queued, tools }
}

describe('advanceRoom', () => {
  it('only the host can start; start opens question 0 with an empty answered list', async () => {
    const { advance, room, roomId } = await liveRoom()
    expect(await advance('start', undefined, 'drew')).toEqual({ success: false, error: 'Room not found.' })
    expect(room(roomId).status).toBe('lobby')
    expect((await advance('start')).success).toBe(true)
    expect(room(roomId)).toMatchObject({ status: 'question', currentIndex: 0, answered: { index: 0, userIds: [] } })
    expect(room(roomId).leaderboard?.map((e) => e.score)).toEqual([0, 0])
  })

  it('a double tap on Next moves only one question', async () => {
    const { advance, room, roomId } = await liveRoom()
    await advance('start')
    await Promise.all([advance('next', 0), advance('next', 0)])
    expect(room(roomId).currentIndex).toBe(1)
    // A stale tap later does nothing either.
    expect((await advance('next', 0)).success).toBe(true)
    expect(room(roomId).currentIndex).toBe(1)
  })

  it('See results only on the last question; Next not on the last one', async () => {
    const { advance, room, roomId } = await liveRoom()
    await advance('start')
    expect(await advance('results', 0)).toEqual({ success: false, error: 'Finish the other questions first.' })
    await advance('next', 0)
    expect((await advance('next', 1)).success).toBe(false)
    expect(room(roomId).status).toBe('question')
  })
})

describe('submitAnswer', () => {
  it('locks one answer per player per question, ungraded, and counts who answered', async () => {
    const { advance, submit, room, roomId, answers } = await liveRoom()
    await advance('start')
    expect(await submit('drew', 0, 2)).toEqual({ success: true, data: { locked: true } })
    expect(await submit('drew', 0, 1)).toEqual({ success: false, error: 'Your answer is already locked.' })
    expect(room(roomId).answered).toEqual({ index: 0, userIds: ['drew'] })
    // Nothing graded while the question is open.
    expect(answers()).toEqual([{ roomId, userId: 'drew', questionIndex: 0, response: 2, graded: false }])
  })

  it('refuses non-members, closed or future questions, and bad responses', async () => {
    const { advance, submit } = await liveRoom()
    expect(await submit('drew', 0, 1)).toEqual({ success: false, error: 'This question has closed.' }) // still lobby
    await advance('start')
    expect(await submit('sam', 0, 1)).toEqual({ success: false, error: 'Room not found.' })
    expect(await submit('drew', 1, 'early')).toEqual({ success: false, error: 'This question has closed.' })
    expect(await submit('drew', 0, 7)).toEqual({ success: false, error: 'Pick one option.' })
    expect(await submit('drew', 0, 'B')).toEqual({ success: false, error: 'Pick one option.' })
    await advance('next', 0)
    expect(await submit('drew', 0, 1)).toEqual({ success: false, error: 'This question has closed.' })
    expect(await submit('drew', 1, '   ')).toMatchObject({ success: false })
  })

  it('players answering at the same moment are all counted', async () => {
    const { advance, submit, room, roomId } = await liveRoom(['drew', 'jen', 'sam'])
    await advance('start')
    await Promise.all([submit('drew', 0, 1), submit('jen', 0, 2), submit('sam', 0, 3), submit('host', 0, 0)])
    expect(new Set(room(roomId).answered?.userIds)).toEqual(new Set(['drew', 'jen', 'sam', 'host']))
  })

  it('an answer that lands just after the host closed the question is taken back', async () => {
    const { advance, roomId, db, room, answers } = await liveRoom()
    await advance('start')
    // The host's Next commits between submitAnswer's check and its insert.
    const tools = fakeTools('drew', db)
    const racing: ActionTools = {
      ...tools,
      create: async (c, data, id) => {
        db.get('rooms')!.get(roomId)!.data.currentIndex = 1
        return tools.create(c, data, id)
      },
    }
    const res = await submitAnswer({ userId: 'drew', params: { roomId, questionIndex: 0, response: 2 }, tools: racing, env: {} as never, callerJwt: 'jwt' })
    expect(res).toEqual({ success: false, error: 'This question has closed.' })
    expect(answers()).toEqual([])
    expect(room(roomId).currentIndex).toBe(1)
  })
})

describe('closing questions and the leaderboard', () => {
  it('grades multiple choice only at close, unanswered scores 0, answer key only at results', async () => {
    const { advance, submit, room, roomId, answers, queued } = await liveRoom(['drew', 'jen'])
    await advance('start')
    await submit('drew', 0, 2) // correct
    await submit('host', 0, 1) // wrong; jen doesn't answer

    // Open question: no grades, no answer key, nothing about correctness on the room.
    expect(answers().every((a) => a.graded === false && a.isCorrect === undefined)).toBe(true)
    expect(room(roomId).answerKey).toBeNull()
    expect(JSON.stringify(room(roomId))).not.toMatch(/answerIndex|expectedAnswer|explanation|secret source/)

    await advance('next', 0)
    const q0 = Object.fromEntries(answers().filter((a) => a.questionIndex === 0).map((a) => [a.userId, a.isCorrect]))
    expect(q0).toEqual({ drew: true, host: false })
    expect(room(roomId).leaderboard?.map((e) => [e.displayName, e.score])).toEqual([
      ['Drew', 1],
      ['Rowel', 0],
      ['Jen', 0],
    ])
    expect(room(roomId).answered).toEqual({ index: 1, userIds: [] })
    expect(room(roomId).answerKey).toBeNull()

    await submit('drew', 1, 'Because of the rain.')
    await advance('results', 1)
    expect(room(roomId).status).toBe('results')
    expect(room(roomId).answerKey).toEqual([
      { answerIndex: 2, correctAnswer: 'C', explanation: 'Because.', sourcePage: 13 },
      { correctAnswer: 'So.', explanation: 'See text.', sourcePage: 14 },
    ])
    expect(queued).toEqual([roomId])
    // The short answer waits for the job: Drew is pending.
    expect(room(roomId).leaderboard?.find((e) => e.userId === 'drew')).toMatchObject({ score: 1, pending: true })
  })

  it('the grading pass grades each short answer once and fills in the leaderboard', async () => {
    const { advance, submit, room, roomId, answers, tools } = await liveRoom(['drew'])
    await advance('start')
    await submit('drew', 0, 1)
    await advance('next', 0)
    await submit('drew', 1, 'It rained.')
    await submit('host', 1, 'No idea.')

    // Before results the pass does nothing (a client can't trigger early grading).
    const generate = vi.fn(okGrade)
    expect(await gradeRoomShortAnswers(tools, roomId, generate)).toBe(0)
    expect(generate).not.toHaveBeenCalled()

    await advance('results', 1)
    expect(await gradeRoomShortAnswers(tools, roomId, generate)).toBe(2)
    expect(generate).toHaveBeenCalledTimes(2)
    expect(answers().find((a) => a.userId === 'drew' && a.questionIndex === 1)).toMatchObject({
      graded: true,
      isCorrect: true,
      score: 1,
      feedback: 'Nice, you got the key idea.',
      page: 14,
    })
    expect(room(roomId).leaderboard?.map((e) => [e.userId, e.score, e.pending])).toEqual([
      ['host', 1, false],
      ['drew', 1, false],
    ])

    // A retry finds nothing left to grade and pays for nothing.
    expect(await gradeRoomShortAnswers(tools, roomId, generate)).toBe(0)
    expect(generate).toHaveBeenCalledTimes(2)
  })

  it('if the AI fails both attempts: graded, "couldn\'t grade" (score null), counts 0', async () => {
    const { advance, submit, roomId, answers, room, tools } = await liveRoom(['drew'])
    await advance('start')
    await advance('next', 0)
    await submit('drew', 1, 'It rained.')
    await advance('results', 1)
    const failing = vi.fn<GenerateFn>(async () => {
      throw new Error('AI down')
    })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(await gradeRoomShortAnswers(tools, roomId, failing)).toBe(1)
    expect(failing).toHaveBeenCalledTimes(2)
    expect(answers()[0]).toMatchObject({ graded: true, isCorrect: false, score: null, feedback: null })
    expect(room(roomId).leaderboard?.find((e) => e.userId === 'drew')).toMatchObject({ score: 0, pending: false })
    vi.restoreAllMocks()
  })
})

describe('player labels', () => {
  it('players who share a first name get a last initial in the room list', async () => {
    const env = setup({ host: 'Rowel Timbal', other: 'Rowel Mendoza' })
    const hosted = (await env.call('host', hostRoom, { quizId: 'quiz1' })) as { data: { roomId: string; code: string } }
    await env.call('other', joinRoom, { code: hosted.data.code })
    expect(env.room(hosted.data.roomId).players.map((p) => p.displayName)).toEqual(['Rowel T.', 'Rowel M.'])
  })
})
