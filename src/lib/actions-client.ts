/**
 * Calls a server action (src/actions/) at POST /api/actions/<name> with the
 * signed-in user's token. Resolves to the action's data or throws an
 * ActionError whose message is safe to show.
 */

import { getAuthToken } from 'deepspace'

export class ActionError extends Error {}

export async function callAction<T>(name: string, params: Record<string, unknown>): Promise<T> {
  const token = await getAuthToken()
  if (!token) throw new ActionError('You are signed out. Sign in and try again.')

  let res: Response
  try {
    res = await fetch(`/api/actions/${encodeURIComponent(name)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(params),
    })
  } catch {
    throw new ActionError('Network error. Check your connection and try again.')
  }

  const body = (await res.json().catch(() => null)) as
    | { success: true; data: T }
    | { success: false; error?: string }
    | { error?: string }
    | null

  if (res.ok && body && 'success' in body && body.success) return body.data
  const message = body && 'error' in body && body.error ? body.error : `Request failed (HTTP ${res.status}).`
  throw new ActionError(message)
}
