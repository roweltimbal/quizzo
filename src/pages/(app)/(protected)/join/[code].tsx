/**
 * /join/:code — invite link (the Lobby's "Copy invite link"). Joins on open
 * and goes to the Lobby; shows the joinRoom error otherwise. Signed-out
 * visitors sign in first and come back here (see (protected)/_layout.tsx).
 */

import { useEffect, useRef } from 'react'
import { Link, useParams } from 'react-router-dom'
import { normalizeRoomCode } from '../../../../lib/room'
import { card, primaryButton } from '../../../../lib/styles'
import { useJoinRoom } from '../../../../lib/use-join-room'

export default function JoinLinkPage() {
  const { code = '' } = useParams<{ code: string }>()
  const normalized = normalizeRoomCode(code)
  const { join, error } = useJoinRoom()
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    void join(normalized)
  }, [join, normalized])

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-6 md:px-6 md:py-8">
      <div className={`${card} p-6 text-center`} role={error ? 'alert' : undefined} aria-busy={!error}>
        {error ? (
          <>
            <p className="text-heading text-ink">{error}</p>
            <p className="mt-1 text-body text-ink-muted">Code: {normalized || '—'}</p>
            <Link to="/join" className={`${primaryButton} mt-6`}>
              Try another code
            </Link>
          </>
        ) : (
          <p className="text-heading text-ink">Joining {normalized}…</p>
        )}
      </div>
    </div>
  )
}
