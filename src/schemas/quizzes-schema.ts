/**
 * quizzes — one generated quiz per chapter (docs/SPEC.md § Data model).
 *
 * Server writes only. `questions` holds the correct answers and
 * explanations, and `sourceText` the chapter text used for grading, so no
 * client role can read, create, change or delete these records. The
 * generate and grade server actions run as the app (RBAC bypassed) and
 * return questions to the client with the answers stripped.
 */

import type { CollectionSchema } from 'deepspace/schema'

export interface QuizQuestion {
  type: 'mcq' | 'short'
  prompt: string
  /** Multiple choice only. */
  choices?: string[]
  /** Multiple choice only: index into `choices`. */
  answerIndex?: number
  /** Short answer only. */
  expectedAnswer?: string
  explanation: string
  sourcePage: number
}

/** Shape of `record.data` for a quiz. */
export interface Quiz {
  ownerId: string
  bookId: string
  chapterTitle: string
  pageStart: number
  pageEnd: number
  sourceText: string
  questions: QuizQuestion[]
}

const noClientAccess = { read: false, create: false, update: false, delete: false } as const

export const quizzesSchema: CollectionSchema = {
  name: 'quizzes',
  ownerField: 'ownerId',
  columns: [
    { name: 'ownerId', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'bookId', storage: 'text', interpretation: 'plain', required: true },
    { name: 'chapterTitle', storage: 'text', interpretation: 'plain' },
    { name: 'pageStart', storage: 'number', interpretation: 'plain', required: true },
    { name: 'pageEnd', storage: 'number', interpretation: 'plain', required: true },
    { name: 'sourceText', storage: 'text', interpretation: 'plain', required: true },
    { name: 'questions', storage: 'text', interpretation: 'json', required: true },
  ],
  permissions: {
    viewer: noClientAccess,
    member: noClientAccess,
    admin: noClientAccess,
  },
}
