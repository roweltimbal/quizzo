/**
 * joinRoom — Screen 9 (docs/SPEC.md § Join room).
 *
 * Looks up an open room by code and adds the CALLER as a player (never
 * anyone else: the userId comes from the verified token). Errors:
 * "Room not found", "Game already started". Joining a room you're already
 * in just returns it, so rejoining after a reload works even mid-game.
 */

import type { ActionHandler } from 'deepspace/worker'
import { z } from 'zod'
import type { Env } from '../../worker'
import type { Room } from '../schemas/rooms-schema'
import { isValidRoomCode, normalizeRoomCode } from '../lib/room'
import { displayNameFor, syncRoomPlayers } from './room-shared'

const paramsSchema = z.object({ code: z.string().max(20) })

const NOT_FOUND = 'Room not found'
const STARTED = 'Game already started'

export const joinRoom: ActionHandler<Env> = async ({ userId, params, tools }) => {
  const input = paramsSchema.safeParse(params)
  if (!input.success || !isValidRoomCode(input.data.code)) return { success: false, error: NOT_FOUND }
  const code = normalizeRoomCode(input.data.code)

  const found = await tools.query<Record<string, unknown>>('rooms', {
    where: { code },
    orderBy: 'createdAt',
    orderDir: 'desc',
    limit: 20,
  })
  if (!found.success) return { success: false, error: "Couldn't join. Try again." }

  const rooms = found.data.records.map((r) => ({ roomId: r.recordId, room: r.data as unknown as Room }))
  const open = rooms.filter((r) => r.room.status !== 'results')

  // Already a member of an open room with this code: just go back in.
  const mine = open.find((r) => r.room.playerIds?.includes(userId))
  if (mine) return { success: true, data: { roomId: mine.roomId } }

  const lobby = open.find((r) => r.room.status === 'lobby')
  if (!lobby) return { success: false, error: open.length > 0 ? STARTED : NOT_FOUND }

  const displayName = await displayNameFor(tools, userId)
  const created = await tools.create('players', { roomId: lobby.roomId, userId, displayName })
  // A duplicate (uniqueOn roomId+userId) means a parallel join already added us.
  if (!created.success && !/duplicate/i.test(created.error)) {
    console.error('[joinRoom] create player failed', created.error)
    return { success: false, error: "Couldn't join. Try again." }
  }

  // Re-check status: the host may have started between lookup and insert.
  const again = await tools.get<Record<string, unknown>>('rooms', lobby.roomId)
  const current = again.success ? (again.data.record?.data as unknown as Room | undefined) : undefined
  if (!current) return { success: false, error: NOT_FOUND }

  const settled = await syncRoomPlayers(tools, lobby.roomId, current.hostId)
  if (!settled) console.warn(`[joinRoom] player list did not settle for room ${lobby.roomId}`)

  return { success: true, data: { roomId: lobby.roomId } }
}
