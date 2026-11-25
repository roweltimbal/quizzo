/**
 * Landing page — a STATIC page.
 *
 * It lives at the top level of src/pages/ (not under (app)/), so it renders
 * with no DeepSpace providers: no auth session fetch, no records WebSocket.
 * It is also prerendered to static HTML at build (prerender.ts), so keep it
 * renderable without a browser: no window/document during render.
 * `<Seo>` comes first and reads src/seo.ts.
 *
 * The product tour slideshow is the main element; "Get started" opens
 * /home, which shows Sign in with Google to signed-out visitors. The
 * slideshow's width is capped by the viewport height so the button stays
 * on screen without scrolling on a laptop.
 */

import { Link } from 'react-router-dom'
import { Seo } from '../components/Seo'
import { LandingSlideshow } from '../components/LandingSlideshow'
import { APP_NAME, APP_PITCH } from '../constants'
import { primaryButton } from '../lib/styles'
import { seo } from '../seo'

export default function Landing() {
  return (
    <>
      <Seo {...seo} path="/" />
      <main
        data-testid="static-landing"
        className="flex min-h-screen flex-col items-center justify-center bg-canvas px-4 py-6 text-center"
      >
        {/* ~15rem of the viewport height is kept for the name, dots, pitch and button. */}
        <div className="w-full max-w-[min(960px,calc((100svh-15rem)*16/9))] min-w-0">
          <h1 className="text-left text-heading font-extrabold text-ink">{APP_NAME}</h1>
          <LandingSlideshow className="mt-4" />
          <p className="mx-auto mt-2 max-w-md text-body text-ink-muted">{APP_PITCH}</p>
          <Link to="/home" className={`${primaryButton} mt-4`}>
            Get started
          </Link>
        </div>
      </main>
    </>
  )
}
