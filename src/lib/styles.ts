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

/**
 * Chip, styled on a <span> that follows a visually hidden radio
 * (`<input class="peer sr-only">`), so selection and arrow-key navigation
 * come from the native radio group. Min height 44px for tap targets.
 */
export const radioChip =
  'flex min-h-11 items-center justify-between gap-3 rounded-pill border border-line bg-surface px-4 py-2 text-label text-ink transition-colors peer-checked:border-ink peer-checked:bg-ink peer-checked:text-surface peer-focus-visible:shadow-[0_0_0_2px_var(--surface),0_0_0_4px_var(--brand)]'

/** Text input. */
export const textInput =
  'h-12 w-full rounded-sm border border-line-strong bg-surface px-4 text-body text-ink outline-none focus:border-brand focus:ring-1 focus:ring-brand'

/** Card surface. */
export const card = 'rounded-lg bg-surface shadow-card'

/** Book card fills, assigned in order and repeating. */
export const bookTints = ['bg-tint-lilac', 'bg-tint-peach', 'bg-tint-mint', 'bg-tint-pink'] as const
