/**
 * Outline (chapter list) helpers. Pure functions with no pdf.js, so they're
 * unit-tested in outline.test.ts and shared by Upload (src/lib/pdf.ts) and
 * Pick chapter.
 */

import type { Book } from '../schemas/books-schema'

export type OutlineEntry = Book['outline'][number]

/** Most pages a quiz can be generated from (docs/SPEC.md § Pick chapter). */
export const MAX_RANGE_PAGES = 40

/**
 * True for bookmark titles that aren't chapter names:
 * - starts with "_" (Word's hidden bookmarks: "_GoBack", "_Toc123"), or
 * - has an underscore and no spaces, i.e. an identifier like
 *   "CKSci_G5Ecosystems_FrontCover" or "Chapter_1_Start". Real one-word
 *   entries ("Glossary", "Index") have no underscore, so they're kept.
 */
export function isJunkTitle(title: string): boolean {
  const t = title.trim()
  return t.startsWith('_') || (t.includes('_') && !/\s/.test(t))
}

/**
 * Drops junk entries, then returns [] (no outline) when fewer than 2
 * entries remain or they all start on the same page (bookmarks, not
 * chapters, and no use for picking a page range).
 */
export function cleanOutline(entries: readonly OutlineEntry[]): OutlineEntry[] {
  const kept = entries.filter((e) => !isJunkTitle(e.title))
  const distinctPages = new Set(kept.map((e) => e.startPage)).size
  return kept.length < 2 || distinctPages < 2 ? [] : kept
}

/**
 * Page range for the chapter at `index`: from its start page to the page
 * before the next chapter starts (by page order), or the last page.
 */
export function chapterRange(
  outline: readonly OutlineEntry[],
  index: number,
  pageCount: number,
): { start: number; end: number } {
  const start = outline[index].startPage
  const next = outline
    .map((e) => e.startPage)
    .filter((p) => p > start)
    .sort((a, b) => a - b)[0]
  const end = next === undefined ? pageCount : next - 1
  return { start, end: Math.max(start, Math.min(end, pageCount)) }
}

/** Error to show for a page range, or null when it's valid. */
export function rangeError(start: number, end: number, pageCount: number): string | null {
  if (!Number.isInteger(start) || !Number.isInteger(end)) return 'Enter whole page numbers.'
  if (start < 1 || end < 1 || start > pageCount || end > pageCount) {
    return `Pages must be between 1 and ${pageCount}.`
  }
  if (start > end) return 'The start page must come before the end page.'
  const pages = end - start + 1
  if (pages > MAX_RANGE_PAGES) {
    return `That's ${pages} pages. Pick at most ${MAX_RANGE_PAGES}.`
  }
  return null
}
