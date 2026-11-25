/**
 * Screen 2 — Home (docs/SPEC.md): the signed-in user's books.
 *
 * The books collection is owner-only (src/schemas/books-schema.ts), so the
 * server already drops other users' books before they reach this query;
 * the `where` just states the intent.
 *
 * "Join room" opens /join (Screen 9) to enter a live room's code.
 * Each card has a "⋯" menu with "Delete book" (BookMenu).
 */

import { Link } from 'react-router-dom'
import { useAuth, useQuery } from 'deepspace'
import type { Book } from '../../../schemas/books-schema'
import { bookTints, card, primaryButton, secondaryButton } from '../../../lib/styles'
import { BookMenu } from '../../../components/BookMenu'

export default function HomePage() {
  const { userId } = useAuth()
  const { records, status, error } = useQuery<Book>('books', {
    where: { ownerId: userId ?? '' },
    orderBy: 'createdAt',
    orderDir: 'desc',
  })

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 md:px-6 md:py-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-title text-ink">My books</h1>
        <div className="flex gap-2">
          <Link to="/join" className={secondaryButton}>
            Join room
          </Link>
          <Link to="/upload" className={primaryButton}>
            Upload book
          </Link>
        </div>
      </header>

      <section aria-label="My books" className="mt-6">
        {status === 'loading' ? (
          <p className="text-body text-ink-muted" aria-busy="true">
            Loading your books…
          </p>
        ) : status === 'error' ? (
          <div className={`${card} p-6`} role="alert">
            <p className="text-heading text-ink">Couldn&apos;t load your books.</p>
            <p className="mt-1 text-body text-ink-muted">{error ?? 'Try reloading the page.'}</p>
          </div>
        ) : records.length === 0 ? (
          <div data-testid="books-empty" className={`${card} p-6 text-center`}>
            <p className="text-heading text-ink">No books yet</p>
            <p className="mt-1 text-body text-ink-muted">
              Upload a PDF to turn one of its chapters into a quiz.
            </p>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {records.map((book, i) => (
              <li key={book.recordId} className="relative">
                <Link
                  to={`/books/${book.recordId}`}
                  className={`${bookTints[i % bookTints.length]} focus-ring block rounded-lg p-4 pr-14 shadow-card`}
                >
                  <p className="text-heading text-ink">{book.data.title}</p>
                  <p className="mt-1 text-caption text-ink-muted">
                    {book.data.pageCount} {book.data.pageCount === 1 ? 'page' : 'pages'}
                  </p>
                </Link>
                {/* A sibling of the link, so the menu never opens the book. */}
                <div className="absolute right-2 top-2">
                  <BookMenu bookId={book.recordId} title={book.data.title} fileId={book.data.fileId} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
