/**
 * Helpers shared by the hostRoom and joinRoom actions.
 *
 * Action tools run with record permissions off, so these act as the app.
 */

import type { ActionTools } from 'deepspace/worker'
import type { Player } from '../schemas/players-schema'
import type { Room } from '../schemas/rooms-schema'
import { playerDisplayName, type RoomPlayer } from '../lib/room'

/** First name from the user's profile (users collection, id = user id). */
export async function displayNameFor(tools: ActionTools, userId: string): Promise<string> {
  const user = await tools.get<Record<string, unknown>>('users', userId)
  return playerDisplayName(user.success ? user.data.record?.data?.name : undefined)
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

/**
 * Rewrites room.players / room.playerIds from the `players` rows.
 *
 * Two joins at once could each write a list missing the other (read, then
 * write). Rebuilding from the rows and re-checking until the room matches
 * makes the last writer include everyone. Returns false if it never settled.
 */
export async function syncRoomPlayers(tools: ActionTools, roomId: string, hostId: string): Promise<boolean> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const players = await listPlayers(tools, roomId)
    const playerIds = [...new Set([hostId, ...players.map((p) => p.userId)])]
    const updated = await tools.update<Partial<Room> & Record<string, unknown>>('rooms', roomId, { players, playerIds })
    if (!updated.success) return false

    const check = await tools.get<Record<string, unknown>>('rooms', roomId)
    const stored = check.success ? ((check.data.record?.data as unknown as Room | undefined)?.playerIds ?? []) : []
    const latest = await listPlayers(tools, roomId)
    if (latest.every((p) => stored.includes(p.userId))) return true
  }
  return false
}
