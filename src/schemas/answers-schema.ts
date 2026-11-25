/**
 * answers — one row per player per question in a live room
 * (docs/SPEC.md § Data model, Live quiz, Grading).
 *
 * Written only by server code: `submitAnswer` creates the row with the
 * caller's verified id; `advanceRoom` and the short-answer grading job fill
 * in the grade when the question closes. No client can create, change or
 * delete a row, so nobody can write their own grade.
 *
 * Each player reads only their own rows. While a question is open the row
 * holds just the response (`graded: false`, no isCorrect/score/feedback), so
 * there is nothing to leak even to the player themself.
 */

import type { CollectionSchema, RolePermissions } from 'deepspace/schema'

/** Shape of `record.data` for an answer. */
export interface Answer {
  roomId: string
  userId: string
  questionIndex: number
  /** Option index (multiple choice) or text (short answer). */
  response: number | string
  /** False until the question closes and the row is graded. */
  graded: boolean
  isCorrect?: boolean | null
  /** 0/1 for multiple choice; 0–1 from the AI for the short answer; null if the AI couldn't grade it. */
  score?: number | null
  /** Short answer only. */
  feedback?: string | null
  /** Short answer only: the page the grader pointed to. */
  page?: number | null
}

const none: RolePermissions = { read: false, create: false, update: false, delete: false }
const ownRowsOnly: RolePermissions = { read: 'own', create: false, update: false, delete: false }

export const answersSchema: CollectionSchema = {
  name: 'answers',
  ownerField: 'userId',
  uniqueOn: ['roomId', 'userId', 'questionIndex'],
  columns: [
    { name: 'roomId', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'userId', storage: 'text', interpretation: 'plain', userBound: true, immutable: true },
    { name: 'questionIndex', storage: 'number', interpretation: 'plain', required: true, immutable: true },
    { name: 'response', storage: 'text', interpretation: 'json', required: true, immutable: true },
    // JSON so booleans and nulls round-trip exactly.
    { name: 'graded', storage: 'text', interpretation: 'json', default: false },
    { name: 'isCorrect', storage: 'text', interpretation: 'json' },
    { name: 'score', storage: 'number', interpretation: 'plain' },
    { name: 'feedback', storage: 'text', interpretation: 'plain', maxLength: 1000 },
    { name: 'page', storage: 'number', interpretation: 'plain' },
  ],
  permissions: {
    viewer: none,
    member: ownRowsOnly,
    admin: ownRowsOnly,
    '*': none,
  },
}
