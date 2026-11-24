/**
 * Calls the joinRoom action and opens the Lobby on success. Shared by
 * /join (type a code) and /join/:code (invite link).
 */

import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ActionError, callAction } from './actions-client'

export function useJoinRoom() {
  const navigate = useNavigate()
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const join = useCallback(
    async (code: string) => {
      setJoining(true)
      setError(null)
      try {
        const { roomId } = await callAction<{ roomId: string }>('joinRoom', { code })
        navigate(`/rooms/${roomId}`, { replace: true })
      } catch (err) {
        setError(err instanceof ActionError ? err.message : 'Something went wrong. Try again.')
        setJoining(false)
      }
    },
    [navigate],
  )

  return { join, joining, error, setError }
}
