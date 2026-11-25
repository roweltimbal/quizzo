/**
 * The "⋯" menu on a My books card, with "Delete book" and its confirm
 * dialog. Base UI Menu + AlertDialog (already a dependency; the project has
 * no shadcn AlertDialog), styled with docs/DESIGN.md tokens.
 *
 * Rendered next to the card's link, not inside it, and clicks stop here,
 * so opening the menu never opens the book.
 */

import { useState } from 'react'
import { Menu } from '@base-ui/react/menu'
import { AlertDialog } from '@base-ui/react/alert-dialog'
import { MoreHorizontal } from 'lucide-react'
import { useMutations, useR2Files } from 'deepspace'
import type { Book } from '../schemas/books-schema'
import { deleteBook } from '../lib/delete-book'
import { dangerButton, secondaryButton } from '../lib/styles'

interface Props {
  bookId: string
  title: string
  fileId: string
}

export function BookMenu({ bookId, title, fileId }: Props) {
  const { deleteFile } = useR2Files()
  const { removeConfirmed } = useMutations<Book>('books')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const confirmDelete = async () => {
    setDeleting(true)
    setError(null)
    try {
      await deleteBook({ recordId: bookId, fileId }, { deleteFile, removeConfirmed })
      // The card leaves the list when the record room broadcasts the delete.
      setConfirmOpen(false)
    } catch (err) {
      console.error('[BookMenu] delete failed', err)
      setError("Couldn't delete the book. Try again.")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <Menu.Root>
        <Menu.Trigger
          aria-label={`Options for ${title}`}
          className="focus-ring flex size-11 items-center justify-center rounded-pill text-ink-muted transition-colors hover:bg-surface hover:text-ink data-[popup-open]:bg-surface"
        >
          <MoreHorizontal className="size-5" aria-hidden />
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner side="bottom" align="end" sideOffset={4} className="z-40">
            <Menu.Popup className="min-w-44 rounded-md border border-line bg-surface p-1 shadow-card outline-none">
              <Menu.Item
                onClick={() => {
                  setError(null)
                  setConfirmOpen(true)
                }}
                className="flex h-11 cursor-pointer items-center rounded-sm px-3 text-label text-error outline-none data-[highlighted]:bg-error-soft"
              >
                Delete book
              </Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>

      <AlertDialog.Root
        open={confirmOpen}
        onOpenChange={(open) => {
          // Stay open while the delete is in flight.
          if (!deleting) setConfirmOpen(open)
        }}
      >
        <AlertDialog.Portal>
          <AlertDialog.Backdrop className="fixed inset-0 z-50 bg-ink/40" />
          <AlertDialog.Popup className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg bg-surface p-6 shadow-card outline-none">
            <AlertDialog.Title className="text-heading text-ink">Delete this book?</AlertDialog.Title>
            <AlertDialog.Description className="mt-2 text-body text-ink-muted">
              “{title}” and its PDF will be removed. This can&apos;t be undone.
            </AlertDialog.Description>
            {error && (
              <p role="alert" className="mt-3 text-body text-error">
                {error}
              </p>
            )}
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <AlertDialog.Close className={secondaryButton} disabled={deleting}>
                Cancel
              </AlertDialog.Close>
              <button type="button" className={dangerButton} onClick={() => void confirmDelete()} disabled={deleting}>
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </AlertDialog.Popup>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </div>
  )
}
