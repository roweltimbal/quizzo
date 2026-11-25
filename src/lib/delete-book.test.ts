import { describe, expect, it, vi } from 'vitest'
import { canDelete } from 'deepspace/worker'
import { booksSchema } from '../schemas/books-schema'
import { deleteBook } from './delete-book'

const book = { recordId: 'b1', fileId: 'apps/x/users/u1/book.pdf' }

describe('deleteBook', () => {
  it('deletes the PDF first, then the record', async () => {
    const calls: string[] = []
    await deleteBook(book, {
      deleteFile: async (key) => (calls.push(`file:${key}`), { success: true }),
      removeConfirmed: async (id) => void calls.push(`record:${id}`),
    })
    expect(calls).toEqual(['file:apps/x/users/u1/book.pdf', 'record:b1'])
  })

  it('still deletes the record when the PDF is already gone', async () => {
    const removeConfirmed = vi.fn(async () => {})
    // What storage answers today for a missing key…
    await deleteBook(book, { deleteFile: async () => ({ success: true }), removeConfirmed })
    // …and an older "not found" error shape.
    await deleteBook(book, { deleteFile: async () => ({ success: false, error: 'File not found' }), removeConfirmed })
    expect(removeConfirmed).toHaveBeenCalledTimes(2)
  })

  it('keeps the record when the PDF delete really fails', async () => {
    const removeConfirmed = vi.fn(async () => {})
    await expect(
      deleteBook(book, {
        deleteFile: async () => ({ success: false, error: 'Access denied: key outside scope' }),
        removeConfirmed,
      }),
    ).rejects.toThrow(/PDF delete failed/)
    expect(removeConfirmed).not.toHaveBeenCalled()
  })

  it('a refused record delete rejects (the card stays)', async () => {
    await expect(
      deleteBook(book, {
        deleteFile: async () => ({ success: true }),
        removeConfirmed: async () => {
          throw new Error('permission denied')
        },
      }),
    ).rejects.toThrow('permission denied')
  })
})

describe('books delete permission (SDK rules)', () => {
  const record = { data: { ownerId: 'u1', title: 'T', fileId: 'k', pageCount: 3, outline: [] }, createdBy: 'u1' }

  it('only the owner can delete a book; another member, an admin or a signed-out visitor cannot', () => {
    expect(canDelete(booksSchema, 'member', record, 'u1')).toBe(true)
    expect(canDelete(booksSchema, 'member', record, 'u2')).toBe(false)
    expect(canDelete(booksSchema, 'admin', record, 'u2')).toBe(false)
    expect(canDelete(booksSchema, 'viewer', record, 'u1')).toBe(false)
  })
})
