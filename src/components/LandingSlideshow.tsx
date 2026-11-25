/**
 * Auto-playing product tour for the landing page ("/").
 *
 * - Six 16:9 WebP slides in public/landing/, stacked absolutely and
 *   crossfaded (600ms opacity). No sliding.
 * - Each slide has its own time on screen (SLIDES[].ms), then it loops.
 * - Pauses while the mouse is over it, while it has keyboard focus, and
 *   while the tab is hidden. prefers-reduced-motion: no autoplay and no
 *   fade, slide 1 shown, dots and arrow keys still work.
 * - Loading: slide 1 is eager with fetchpriority="high". Other slides get
 *   an <img> only when they are next in line (preloaded during the current
 *   slide), and the show only moves to a slide once it has loaded, so a
 *   fade never lands on a blank frame.
 *
 * Prerendered (src/pages/index.tsx is static), so render touches no
 * window/document; everything browser-only runs in effects. The first
 * render is the same on server and client: slide 1, playing.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

const SLIDES = [
  { src: '/landing/slide-1.webp', alt: 'Turn any book into a quiz', ms: 4500 },
  { src: '/landing/slide-2.webp', alt: 'Step 1: Upload your PDF', ms: 3500 },
  { src: '/landing/slide-3.webp', alt: 'Step 2: Pick a book', ms: 3500 },
  { src: '/landing/slide-4.webp', alt: 'Step 3: Choose a chapter', ms: 4000 },
  { src: '/landing/slide-5.webp', alt: 'Step 4: Play solo or with friends', ms: 5000 },
  { src: '/landing/slide-6.webp', alt: 'Step 5: Get instant feedback', ms: 6000 },
] as const

const COUNT = SLIDES.length
const wrap = (i: number) => (i + COUNT) % COUNT

interface Props {
  className?: string
}

export function LandingSlideshow({ className = '' }: Props) {
  const [index, setIndex] = useState(0)
  /** Bumped when the user picks a slide, so its timer restarts in full. */
  const [cycle, setCycle] = useState(0)
  /** Slides whose <img> is rendered (so their file is requested). */
  const [mounted, setMounted] = useState<ReadonlySet<number>>(() => new Set([0]))
  /** Slides whose image has finished loading. */
  const [loaded, setLoaded] = useState<ReadonlySet<number>>(() => new Set())
  /** A slide we want to show but that is still loading. */
  const [pending, setPending] = useState<number | null>(null)

  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [hidden, setHidden] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)

  // Browser-only signals, after hydration.
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onMotion = () => setReducedMotion(media.matches)
    const onVisibility = () => setHidden(document.visibilityState === 'hidden')
    onMotion()
    onVisibility()
    media.addEventListener('change', onMotion)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      media.removeEventListener('change', onMotion)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  /** Shows slide `i` now if loaded, else as soon as it loads. */
  const requestSlide = useCallback(
    (i: number) => {
      setMounted((m) => (m.has(i) ? m : new Set(m).add(i)))
      if (loaded.has(i)) {
        setIndex(i)
        setPending(null)
      } else {
        setPending(i)
      }
    },
    [loaded],
  )

  const onImageLoad = (i: number) => {
    setLoaded((l) => (l.has(i) ? l : new Set(l).add(i)))
    if (pending === i) {
      setIndex(i)
      setPending(null)
    }
  }

  // Preload the next slide while this one is on screen.
  useEffect(() => {
    const next = wrap(index + 1)
    setMounted((m) => (m.has(next) ? m : new Set(m).add(next)))
  }, [index])

  // Autoplay. Pausing keeps the time already spent on the slide; picking a
  // slide (new index or cycle) starts its full time again.
  const paused = hovered || focused || hidden || reducedMotion
  const remaining = useRef<number>(SLIDES[0].ms)
  const timerKey = `${index}:${cycle}`
  const lastKey = useRef(timerKey)
  useEffect(() => {
    if (lastKey.current !== timerKey) {
      lastKey.current = timerKey
      remaining.current = SLIDES[index].ms
    }
    if (paused || pending !== null) return
    const started = performance.now()
    const timer = window.setTimeout(() => requestSlide(wrap(index + 1)), remaining.current)
    return () => {
      window.clearTimeout(timer)
      remaining.current = Math.max(0, remaining.current - (performance.now() - started))
    }
  }, [timerKey, index, paused, pending, requestSlide])

  const pick = (i: number) => {
    setCycle((c) => c + 1)
    requestSlide(wrap(i))
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      pick(index + 1)
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      pick(index - 1)
    }
  }

  return (
    <div className={className}>
      <div
        role="region"
        aria-label="Quizzo product tour"
        aria-roledescription="carousel"
        tabIndex={0}
        onKeyDown={onKeyDown}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="focus-ring relative aspect-video w-full overflow-hidden rounded-lg bg-surface shadow-card"
      >
        {SLIDES.map((slide, i) =>
          mounted.has(i) ? (
            <img
              key={slide.src}
              src={slide.src}
              alt={slide.alt}
              aria-hidden={i !== index}
              width={2576}
              height={1449}
              loading={i === 0 ? 'eager' : 'lazy'}
              fetchPriority={i === 0 ? 'high' : 'auto'}
              decoding="async"
              draggable={false}
              onLoad={() => onImageLoad(i)}
              // The prerendered slide 1 may finish loading before hydration,
              // when onLoad has no listener yet.
              ref={(el) => {
                if (el?.complete && el.naturalWidth > 0 && !loaded.has(i)) onImageLoad(i)
              }}
              className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-[600ms] ease-in-out motion-reduce:transition-none ${
                i === index ? 'opacity-100' : 'opacity-0'
              }`}
            />
          ) : null,
        )}
      </div>

      <div className="mt-2 flex justify-center" role="group" aria-label="Choose a slide">
        {SLIDES.map((slide, i) => (
          <button
            key={slide.src}
            type="button"
            onClick={() => pick(i)}
            aria-label={`Slide ${i + 1}: ${slide.alt}`}
            aria-current={i === index ? 'true' : undefined}
            className="focus-ring flex h-11 w-9 items-center justify-center rounded-pill"
          >
            <span
              aria-hidden="true"
              className={`block h-2 rounded-pill transition-all duration-300 motion-reduce:transition-none ${
                i === index ? 'w-6 bg-brand' : 'w-2 bg-line-strong'
              }`}
            />
          </button>
        ))}
      </div>
    </div>
  )
}
