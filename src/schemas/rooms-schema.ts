/**
 * rooms — one live game (docs/SPEC.md § Data model, Lobby).
 *
 * Visible only to the host and joined players ('collaborator' = owner, or
 * listed in `playerIds`). Nobody can list or browse rooms.
 *
 * Created only by the hostRoom action (it mints the code and copies the
 * answer-stripped questions). Players are added only by joinRoom. The host
 * may change `status` and `currentIndex` and nothing else.
 *
 * `questions` holds PublicQuestion[] (prompt, choices, page): NO answers.
 * Answers, explanations and sourceText stay in `quizzes`, which no client
 * can read.
 */

import type { CollectionSchema, RolePermissions } from 'deepspace/schema'
import type { PublicQuestion } from '../lib/quiz'
import type { RoomPlayer, RoomStatus } from '../lib/room'

/** Shape of `record.data` for a room. */
export interface Room {
  code: string
  quizId: string
  hostId: string
  status: RoomStatus
  currentIndex: number
  /** Chapter title or page range, for display. */
  title: string
  questions: PublicQuestion[]
  /** Read access list (collaboratorsField). Includes the host. */
  playerIds: string[]
  /** Lobby list, in join order. */
  players: RoomPlayer[]
}

const none: RolePermissions = { read: false, create: false, update: false, delete: false }

const signedIn: RolePermissions = {
  read: 'collaborator',
  create: false,
  update: 'own',
  delete: 'own',
  writableFields: ['status', 'currentIndex'],
}

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
    { name: 'questions', storage: 'text', interpretation: 'json', required: true },
    { name: 'playerIds', storage: 'text', interpretation: 'json', required: true },
    { name: 'players', storage: 'text', interpretation: 'json', required: true },
  ],
  permissions: {
    viewer: none,
    member: signedIn,
    admin: signedIn,
    '*': none,
  },
}
