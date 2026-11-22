/**
 * Theme catalog.
 *
 * Quizzo has one light theme, `quizzo`, built from docs/DESIGN.md. Token
 * values live in src/styles.css — this file is metadata only.
 */

export const THEMES = [
  {
    id: 'quizzo',
    label: 'Quizzo',
    description: 'Soft lavender canvas, white cards, violet actions (docs/DESIGN.md).',
  },
] as const

export type ThemeId = (typeof THEMES)[number]['id']

/** Read the currently active theme id from <html data-theme>. */
export function getActiveTheme(): ThemeId {
  if (typeof document === 'undefined') return 'quizzo'
  const id = document.documentElement.getAttribute('data-theme') as ThemeId | null
  return id ?? 'quizzo'
}

/** Look up a theme entry by id, or fall back to the first theme. */
export function getTheme(id: string) {
  return THEMES.find((t) => t.id === id) ?? THEMES[0]
}
