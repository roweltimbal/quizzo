/**
 * players — one row per user per room (docs/SPEC.md § Data model).
 *
 * Written only by the hostRoom/joinRoom actions, always with the caller's
 * verified id, so a user can only ever add themselves. Each user reads only
 * their own rows; the lobby's player list comes from the room record (so a
 * signed-in user can't list other children's names across rooms).
 */

import type { CollectionSchema, RolePermissions } from 'deepspace/schema'

/** Shape of `record.data` for a player. */
export interface Player {
  roomId: string
  userId: string
  displayName: string
}

const none: RolePermissions = { read: false, create: false, update: false, delete: false }
const ownRowsOnly: RolePermissions = { read: 'own', create: false, update: false, delete: false }

export const playersSchema: CollectionSchema = {
  name: 'players',
  ownerField: 'userId',
  uniqueOn: ['roomId', 'userId'],
  columns: [
    { name: 'roomId', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'userId', storage: 'text', interpretation: 'plain', userBound: true, immutable: true },
    { name: 'displayName', storage: 'text', interpretation: 'plain', required: true, maxLength: 40 },
  ],
  permissions: {
    viewer: none,
    member: ownRowsOnly,
    admin: ownRowsOnly,
    '*': none,
  },
}
