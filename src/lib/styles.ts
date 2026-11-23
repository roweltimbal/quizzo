/**
 * Shared class strings for the docs/DESIGN.md components, so buttons and
 * links that look like buttons stay identical across screens.
 */

const pillButton =
  'inline-flex h-12 items-center justify-center gap-2 rounded-pill px-6 text-label transition-colors focus-ring disabled:pointer-events-none disabled:opacity-40 aria-disabled:pointer-events-none aria-disabled:opacity-40'

/** The one main action on a screen. */
export const primaryButton = `${pillButton} bg-brand text-on-brand hover:bg-brand-strong active:bg-brand-strong`

/** Any other button. */
export const secondaryButton = `${pillButton} bg-brand-soft text-brand-strong`

/** Card surface. */
export const card = 'rounded-lg bg-surface shadow-card'

/** Book card fills, assigned in order and repeating. */
export const bookTints = ['bg-tint-lilac', 'bg-tint-peach', 'bg-tint-mint', 'bg-tint-pink'] as const
