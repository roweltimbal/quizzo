/**
 * Screen 8 — Lobby (docs/SPEC.md), at /rooms/:roomId. Shared by host and
 * players.
 *
 * The room record syncs live (useQuery), so players appear as they join.
 * Only the host and joined players can read the room ('collaborator'), so
 * anyone else gets "Room not found". A presence room (`room:<id>`) marks
 * who has the lobby open right now.
 *
 * Not built yet: Start (the live quiz, Screen 10).
 */

import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth, usePresenceRoom, useQuery } from 'deepspace'
import type { Room } from '../../../../schemas/rooms-schema'
import { card, chip, primaryButton, roomCodeCard, secondaryButton } from '../../../../lib/styles'

export default function LobbyPage() {
  const { roomId = '' } = useParams<{ roomId: string }>()
  const { records, status } = useQuery<Room>('rooms')
  const room = records.find((r) => r.recordId === roomId)

  if (status === 'loading') {
    return (
      <Shell>
        <p className="text-body text-ink-muted" aria-busy="true">
          Opening the room…
        </p>
      </Shell>
    )
  }

  if (!room) {
    return (
      <Shell>
        <div className={`${card} p-6 text-center`} role="alert">
          <p className="text-heading text-ink">Room not found</p>
          <p className="mt-1 text-body text-ink-muted">Check the code with your host.</p>
          <Link to="/join" className={`${primaryButton} mt-6`}>
            Join a room
          </Link>
        </div>
      </Shell>
    )
  }

  return (
    <Shell>
      <Lobby roomId={roomId} room={room.data} />
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-xl px-4 py-6 md:px-6 md:py-8">{children}</div>
}

function Lobby({ roomId, room }: { roomId: string; room: Room }) {
  const { userId } = useAuth()
  const { peers } = usePresenceRoom(`room:${roomId}`)
  const [copied, setCopied] = useState<'code' | 'link' | null>(null)

  const isHost = userId === room.hostId
  const online = new Set([...peers.map((p) => p.userId), ...(userId ? [userId] : [])])
  const players = Array.isArray(room.players) ? room.players : []
  const questionCount = Array.isArray(room.questions) ? room.questions.length : 0

  const copy = async (what: 'code' | 'link') => {
    const text = what === 'code' ? room.code : `${window.location.origin}/join/${room.code}`
    try {
      await navigator.clipboard.writeText(text)
      setCopied(what)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      setCopied(null)
    }
  }

  return (
    <>
      <p className="text-caption text-ink-muted">
        Live room · {questionCount} questions
      </p>
      <h1 className="mt-1 text-title text-ink">{room.title}</h1>

      <button
        type="button"
        onClick={() => void copy('code')}
        className={`${roomCodeCard} mt-6`}
        aria-label={`Room code ${room.code.split('').join(' ')}. Tap to copy.`}
      >
        <span className="text-label text-ink-muted">Room code</span>
        <span className="text-room-code text-ink tracking-widest">{room.code}</span>
        <span className="text-caption text-ink-muted" aria-live="polite">
          {copied === 'code' ? 'Copied' : 'Tap to copy'}
        </span>
      </button>
      <div className="mt-2 text-center">
        <button type="button" onClick={() => void copy('link')} className="focus-ring rounded-sm text-label text-brand">
          {copied === 'link' ? 'Link copied' : 'Copy invite link'}
        </button>
      </div>

      <section className={`${card} mt-6 p-4 md:p-6`} aria-labelledby="players-heading">
        <h2 id="players-heading" className="text-heading text-ink">
          Players ({players.length})
        </h2>
        <ul className="mt-4 flex flex-wrap gap-2" aria-live="polite">
          {players.map((p) => {
            const here = online.has(p.userId)
            return (
              <li key={p.userId} className={chip}>
                <span
                  className={`size-2 rounded-pill ${here ? 'bg-brand' : 'bg-line-strong'}`}
                  aria-hidden="true"
                />
                {p.displayName}
                {p.userId === room.hostId && <span className="text-caption text-ink-muted">host</span>}
                {p.userId === userId && <span className="text-caption text-ink-muted">you</span>}
                <span className="sr-only">{here ? '(here now)' : '(away)'}</span>
              </li>
            )
          })}
        </ul>
      </section>

      {room.status !== 'lobby' ? (
        <p className={`${card} mt-6 p-4 text-center text-body text-ink-muted`}>The game has started.</p>
      ) : isHost ? (
        <div className="mt-6">
          <button type="button" className={`${primaryButton} w-full`} disabled>
            Start
          </button>
          <p className="mt-2 text-center text-caption text-ink-muted">Starting the live quiz comes in the next update.</p>
        </div>
      ) : (
        <p className={`${card} mt-6 p-4 text-center text-body text-ink`} aria-live="polite">
          Waiting for host to start…
        </p>
      )}

      <Link to="/home" className={`${secondaryButton} mt-4 w-full`}>
        My books
      </Link>
    </>
  )
}
