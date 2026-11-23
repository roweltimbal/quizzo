/**
 * Screen 4 — Pick chapter (docs/SPEC.md), at /books/:bookId.
 *
 * Picking a chapter fills in the page range; the range stays editable. A
 * book without a usable outline shows only the page-range inputs. The
 * outline is cleaned again here (cleanOutline) so books uploaded before a
 * rule change still get the current rule.
 *
 * "Play solo" opens Generating (/generate) with the selection in router
 * state. "Host room" arrives with the live room (P1).
 */

import { useId, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from 'deepspace'
import type { Book } from '../../../../schemas/books-schema'
import type { GenerateRequest } from '../generate'
import { chapterRange, cleanOutline, MAX_RANGE_PAGES, rangeError } from '../../../../lib/outline'
import { card, primaryButton, radioChip, textInput } from '../../../../lib/styles'

export default function PickChapterPage() {
  const { bookId } = useParams<{ bookId: string }>()
  // Owner-only collection: the server only ever sends the caller's books.
  const { records, status } = useQuery<Book>('books')
  const book = records.find((r) => r.recordId === bookId)

  if (status === 'loading') {
    return (
      <Page>
        <p className="text-body text-ink-muted" aria-busy="true">
          Loading book…
        </p>
      </Page>
    )
  }

  if (!book) {
    return (
      <Page>
        <div className={`${card} p-6 text-center`} role="alert">
          <p className="text-heading text-ink">Book not found</p>
          <p className="mt-1 text-body text-ink-muted">It may have been deleted.</p>
        </div>
      </Page>
    )
  }

  // Keyed so the picker's state resets when switching books.
  return (
    <Page>
      <ChapterPicker key={book.recordId} bookId={book.recordId} book={book.data} />
    </Page>
  )
}

function Page({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-xl px-4 py-6 md:px-6 md:py-8">
      <Link to="/home" className="focus-ring rounded-sm text-label text-brand">
        ← My books
      </Link>
      <div className="mt-4">{children}</div>
    </div>
  )
}

function ChapterPicker({ bookId, book }: { bookId: string; book: Book }) {
  const navigate = useNavigate()
  const fieldId = useId()
  const pageCount = book.pageCount
  const outline = useMemo(
    () => cleanOutline(Array.isArray(book.outline) ? book.outline : []),
    [book.outline],
  )
  const hasOutline = outline.length > 0

  const [selected, setSelected] = useState<number | null>(null)
  const [startText, setStartText] = useState(hasOutline ? '' : '1')
  const [endText, setEndText] = useState(hasOutline ? '' : String(Math.min(MAX_RANGE_PAGES, pageCount)))

  const start = Number(startText)
  const end = Number(endText)
  const filledIn = startText.trim() !== '' && endText.trim() !== ''
  const error = filledIn ? rangeError(start, end, pageCount) : null
  const canPlay = filledIn && error === null

  const pickChapter = (index: number) => {
    const range = chapterRange(outline, index, pageCount)
    setSelected(index)
    setStartText(String(range.start))
    setEndText(String(range.end))
  }

  // Editing the range by hand deselects the chapter once it no longer matches.
  const editRange = (which: 'start' | 'end', value: string) => {
    const nextStart = which === 'start' ? value : startText
    const nextEnd = which === 'end' ? value : endText
    if (which === 'start') setStartText(value)
    else setEndText(value)
    if (selected !== null) {
      const range = chapterRange(outline, selected, pageCount)
      if (Number(nextStart) !== range.start || Number(nextEnd) !== range.end) setSelected(null)
    }
  }

  const playSolo = () => {
    if (!canPlay) return
    const request: GenerateRequest = {
      bookId,
      chapterTitle: selected !== null ? outline[selected].title : null,
      pageStart: start,
      pageEnd: end,
      nonce: crypto.randomUUID(),
    }
    navigate('/generate', { state: request })
  }

  return (
    <>
      <h1 className="text-title text-ink">{book.title}</h1>
      <p className="mt-1 text-caption text-ink-muted">
        {pageCount} {pageCount === 1 ? 'page' : 'pages'}
      </p>

      <div className={`${card} mt-6 p-4 md:p-6`}>
        {hasOutline && (
          <fieldset>
            <legend className="text-heading text-ink">Pick a chapter</legend>
            <div className="mt-4 flex flex-col gap-2">
              {outline.map((entry, i) => {
                const range = chapterRange(outline, i, pageCount)
                return (
                  <label key={`${entry.startPage}-${entry.title}`} className="cursor-pointer">
                    <input
                      type="radio"
                      name={`${fieldId}-chapter`}
                      className="peer sr-only"
                      checked={selected === i}
                      onChange={() => pickChapter(i)}
                    />
                    <span className={radioChip}>
                      <span className="min-w-0">{entry.title}</span>
                      <span className="shrink-0 text-caption opacity-80">
                        {range.start === range.end ? `p. ${range.start}` : `pp. ${range.start}–${range.end}`}
                      </span>
                    </span>
                  </label>
                )
              })}
            </div>
          </fieldset>
        )}

        <fieldset className={hasOutline ? 'mt-6' : undefined}>
          <legend className="text-heading text-ink">{hasOutline ? 'Pages' : 'Pick pages'}</legend>
          <p className="mt-1 text-body text-ink-muted">
            {hasOutline ? 'Filled in from the chapter. You can adjust it.' : 'This book has no chapter list.'}{' '}
            Up to {MAX_RANGE_PAGES} pages.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <label className="block">
              <span className="text-label text-ink">Start page</span>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={pageCount}
                value={startText}
                onChange={(e) => editRange('start', e.target.value)}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? `${fieldId}-error` : undefined}
                className={`${textInput} mt-2`}
              />
            </label>
            <label className="block">
              <span className="text-label text-ink">End page</span>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={pageCount}
                value={endText}
                onChange={(e) => editRange('end', e.target.value)}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? `${fieldId}-error` : undefined}
                className={`${textInput} mt-2`}
              />
            </label>
          </div>
          {error && (
            <p id={`${fieldId}-error`} role="alert" className="mt-2 text-body text-error">
              {error}
            </p>
          )}
        </fieldset>

        <button type="button" onClick={playSolo} disabled={!canPlay} className={`${primaryButton} mt-6 w-full`}>
          Play solo
        </button>
      </div>
    </>
  )
}
