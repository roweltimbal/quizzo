/**
 * rooms — one live game (docs/SPEC.md § Data model, Lobby, Live quiz).
 *
 * Visible only to the host and joined players ('collaborator' = owner, or
 * listed in `playerIds`). Nobody can list or browse rooms.
 *
 * Read-only for every client. Server actions do all writes:
 * - hostRoom creates it (mints the code, copies the answer-stripped questions)
 * - joinRoom adds players
 * - advanceRoom moves the game on, and checks the caller is the host
 * - submitAnswer updates `answered`
 * - advanceRoom and the grading job update `leaderboard`
 * The host moves the game through an action, not a direct edit, because
 * closing a question has to grade it at the same moment (docs/SPEC.md § 10).
 *
 * `questions` holds PublicQuestion[] (prompt, choices, page): NO answers.
 * `answerKey` is written only when the status becomes `results`. Until then
 * answers, explanations and sourceText stay in `quizzes`, which no client
 * can read.
 */

import type { CollectionSchema, RolePermissions } from 'deepspace/schema'
import type { PublicQuestion } from '../lib/quiz'
import type { RoomPlayer, RoomStatus } from '../lib/room'
import type { LeaderboardEntry } from '../lib/leaderboard'

/** Correct answer for one question, published at `results`. */
export interface AnswerKeyEntry {
  /** Multiple choice only. */
  answerIndex?: number
  /** The correct option's text, or the expected short answer. */
  correctAnswer: string
  explanation: string
  sourcePage: number
}

/** Shape of `record.data` for a room. */
export interface Room {
  code: string
  quizId: string
  hostId: string
  status: RoomStatus
  currentIndex: number
  /** Chapter title or page range, for display. */
  title: string
  /** The book's title, for the Result screen. */
  bookTitle?: string
  questions: PublicQuestion[]
  /** Read access list (collaboratorsField). Includes the host. */
  playerIds: string[]
  /** Player list in join order, with display labels. */
  players: RoomPlayer[]
  /** Who has answered the current question (ids only, never responses). Ignore when `index` ≠ currentIndex. */
  answered?: { index: number; userIds: string[] }
  /** Scores from closed questions, highest first. */
  leaderboard?: LeaderboardEntry[]
  /** Null until `results`. */
  answerKey?: AnswerKeyEntry[] | null
}

const none: RolePermissions = { read: false, create: false, update: false, delete: false }
const readOnly: RolePermissions = { read: 'collaborator', create: false, update: false, delete: false }

export const roomsSchema: CollectionSchema = {
  name: 'rooms',
  ownerField: 'hostId',
  collaboratorsField: 'playerIds',
  columns: [
    { name: 'code', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'quizId', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'hostId', storage: 'text', interpretation: 'plain', userBound: true, immutable: true },
    {
      name: 'status',
      storage: 'text',
      interpretation: { kind: 'select', options: ['lobby', 'question', 'results'] },
      required: true,
    },
    { name: 'currentIndex', storage: 'number', interpretation: 'plain', required: true },
    { name: 'title', storage: 'text', interpretation: 'plain' },
    { name: 'bookTitle', storage: 'text', interpretation: 'plain' },
    { name: 'questions', storage: 'text', interpretation: 'json', required: true },
    { name: 'playerIds', storage: 'text', interpretation: 'json', required: true },
    { name: 'players', storage: 'text', interpretation: 'json', required: true },
    { name: 'answered', storage: 'text', interpretation: 'json' },
    { name: 'leaderboard', storage: 'text', interpretation: 'json' },
    { name: 'answerKey', storage: 'text', interpretation: 'json' },
  ],
  permissions: {
    viewer: none,
    member: readOnly,
    admin: readOnly,
    '*': none,
  },
}
