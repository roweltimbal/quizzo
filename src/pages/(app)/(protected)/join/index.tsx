/**
 * Screen 9 — Join room (docs/SPEC.md), at /join. Type a 4-letter code.
 * Errors come from the joinRoom action: "Room not found",
 * "Game already started".
 */

import { useId, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { isValidRoomCode, normalizeRoomCode, ROOM_CODE_LENGTH } from '../../../../lib/room'
import { card, primaryButton, secondaryButton, textInput } from '../../../../lib/styles'
import { useJoinRoom } from '../../../../lib/use-join-room'

export default function JoinPage() {
  const id = useId()
  const [code, setCode] = useState('')
  const { join, joining, error, setError } = useJoinRoom()
  const normalized = normalizeRoomCode(code)

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!isValidRoomCode(normalized)) {
      setError(`Room codes are ${ROOM_CODE_LENGTH} letters.`)
      return
    }
    void join(normalized)
  }

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-6 md:px-6 md:py-8">
      <h1 className="text-title text-ink">Join room</h1>
      <p className="mt-1 text-body text-ink-muted">Type the code your host shows you.</p>

      <form onSubmit={onSubmit} className={`${card} mt-6 p-4 md:p-6`}>
        <label htmlFor={`${id}-code`} className="text-label text-ink">
          Room code
        </label>
        <input
          id={`${id}-code`}
          className={`${textInput} mt-2 text-center uppercase tracking-widest`}
          value={code}
          onChange={(e) => {
            setCode(e.target.value.slice(0, 8))
            setError(null)
          }}
          placeholder="KMTR"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          inputMode="text"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          disabled={joining}
        />
        {error && (
          <p id={`${id}-error`} role="alert" className="mt-2 text-body text-error">
            {error}
          </p>
        )}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Link to="/home" className={secondaryButton}>
            Cancel
          </Link>
          <button type="submit" className={primaryButton} disabled={joining || normalized.length === 0}>
            {joining ? 'Joining…' : 'Join'}
          </button>
        </div>
      </form>
    </div>
  )
}
