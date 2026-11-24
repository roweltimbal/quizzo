/**
 * Gated routes. Any file under src/pages/(app)/(protected)/ requires sign-in.
 * The `(protected)` folder is a Generouted route group — parentheses mean
 * it doesn't appear in the URL.
 *
 * Signed-out visitors get Screen 1 (Sign in) in place of the page. AuthGate
 * is UI only; the data itself is guarded by the collection permissions in
 * src/schemas/ (signed-out connections are `viewer` and can read nothing).
 */

import { useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { AuthGate } from 'deepspace'
import { APP_NAME, APP_PITCH } from '../../../constants'
import { card, primaryButton } from '../../../lib/styles'

/**
 * Sign-in always lands on /home (the worker's oauth-complete route), so the
 * page a signed-out visitor opened — e.g. an invite link /join/KMTR — is
 * remembered here and reopened after sign-in.
 */
const RETURN_KEY = 'quizzo:after-sign-in'

export default function ProtectedLayout() {
  return (
    <AuthGate fallback={<SignInScreen />}>
      <ReturnAfterSignIn />
      <Outlet />
    </AuthGate>
  )
}

function ReturnAfterSignIn() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  useEffect(() => {
    let target: string | null = null
    try {
      target = sessionStorage.getItem(RETURN_KEY)
      sessionStorage.removeItem(RETURN_KEY)
    } catch {
      return
    }
    // Same-app paths only.
    if (target && target.startsWith('/') && !target.startsWith('//') && target !== pathname) {
      navigate(target, { replace: true })
    }
    // Runs once, right after sign-in lands.
  }, [])
  return null
}

/** Screen 1 — Sign in (docs/SPEC.md). */
function SignInScreen() {
  const [redirecting, setRedirecting] = useState(false)

  // Same flow the SDK's AuthOverlay uses for its Google button: the worker's
  // /api/auth/social-redirect sends the browser to DeepSpace auth, which
  // returns to /api/auth/oauth-complete and then lands on /home.
  const signInWithGoogle = () => {
    setRedirecting(true)
    try {
      const here = window.location.pathname + window.location.search
      if (here !== '/home') sessionStorage.setItem(RETURN_KEY, here)
    } catch {
      // Storage blocked: sign-in still works, it just lands on /home.
    }
    window.location.href = '/api/auth/social-redirect?provider=google'
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-canvas px-4 py-12">
      <div data-testid="sign-in-screen" className={`${card} w-full max-w-sm p-6 text-center`}>
        <h1 className="text-title font-extrabold text-ink">{APP_NAME}</h1>
        <p className="mt-2 text-body text-ink-muted">{APP_PITCH}</p>
        <button
          type="button"
          onClick={signInWithGoogle}
          disabled={redirecting}
          className={`${primaryButton} mt-6 w-full`}
        >
          {redirecting ? 'Opening Google…' : 'Sign in with Google'}
        </button>
      </div>
    </div>
  )
}
