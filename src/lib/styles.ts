/**
 * Shared class strings for the docs/DESIGN.md components, so buttons and
 * links that look like buttons stay identical across screens.
 */

const pillButton =
  'inline-flex h-12 items-center justify-center gap-2 rounded-pill px-6 text-label transition-colors focus-ring disabled:pointer-events-none disabled:opacity-40 aria-disabled:pointer-events-none aria-disabled:opacity-40'

/** The one main action on a screen. */
export const primaryButton = `${pillButton} bg-brand text-on-brand hover:bg-brand-strong active:bg-brand-strong`

/** Destructive confirm (e.g. Delete in a confirm dialog). `error` fill, white text (contrast ~6:1). */
export const dangerButton = `${pillButton} bg-error text-on-brand hover:bg-error/90`

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

/** Short-answer box: 120px tall. */
export const textArea =
  'h-30 w-full resize-none rounded-sm border border-line-strong bg-surface px-4 py-3 text-body text-ink outline-none focus:border-brand focus:ring-1 focus:ring-brand'

/**
 * Answer option (DESIGN.md), styled on a <span> after a hidden radio, like
 * radioChip. 2px borders are drawn as border + 1px ring so the layout
 * doesn't shift between states.
 */
const answerOptionBase =
  'flex min-h-14 w-full items-center justify-between gap-3 rounded-md border p-4 text-left text-body text-ink transition-colors'

/** At rest / selected (while playing). */
export const answerOption = `${answerOptionBase} border-line-strong bg-surface peer-checked:border-brand peer-checked:bg-brand-soft peer-checked:ring-1 peer-checked:ring-brand peer-focus-visible:shadow-[0_0_0_2px_var(--surface),0_0_0_4px_var(--brand)]`

/** Correct (Result). Always paired with a ✓ icon. */
export const answerOptionCorrect = `${answerOptionBase} border-success bg-success-soft ring-1 ring-success`

/** Incorrect (Result). Always paired with a ✗ icon. */
export const answerOptionIncorrect = `${answerOptionBase} border-error bg-error-soft ring-1 ring-error`

/** Progress bar track; the fill is `bg-brand` with a width. */
export const progressTrack = 'h-2 flex-1 overflow-hidden rounded-pill bg-brand-soft'

/** Lobby room code: `room-code` type in ink on a brand-soft card, tap to copy. */
export const roomCodeCard =
  'flex w-full flex-col items-center gap-1 rounded-lg bg-brand-soft px-6 py-6 text-center focus-ring'

/** Chip (DESIGN.md): pill, 32px, label text, surface with line border. */
export const chip = 'inline-flex h-8 items-center gap-2 rounded-pill border border-line bg-surface px-4 text-label text-ink'

/** Card surface. */
export const card = 'rounded-lg bg-surface shadow-card'

/** Book card fills, assigned in order and repeating. */
export const bookTints = ['bg-tint-lilac', 'bg-tint-peach', 'bg-tint-mint', 'bg-tint-pink'] as const
