/**
 * Landing page — a STATIC page.
 *
 * It lives at the top level of src/pages/ (not under (app)/), so it renders
 * with no DeepSpace providers: no auth session fetch, no records WebSocket.
 * It is also prerendered to static HTML at build (prerender.ts), so keep it
 * renderable without a browser: no window/document during render.
 * `<Seo>` comes first and reads src/seo.ts.
 */

import { Link } from 'react-router-dom'
import { Seo } from '../components/Seo'
import { APP_NAME, APP_PITCH } from '../constants'
import { primaryButton } from '../lib/styles'
import { seo } from '../seo'

export default function Landing() {
  return (
    <>
      <Seo {...seo} path="/" />
      <main
        data-testid="static-landing"
        className="flex min-h-screen flex-col items-center justify-center bg-canvas px-4 text-center"
      >
        <h1 className="text-display font-extrabold text-ink">{APP_NAME}</h1>
        <p className="mt-3 max-w-md text-body text-ink-muted">{APP_PITCH}</p>
        <Link to="/home" className={`${primaryButton} mt-8`}>
          Get started
        </Link>
      </main>
    </>
  )
}
