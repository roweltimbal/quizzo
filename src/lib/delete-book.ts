/**
 * Deleting a book (Home / My books): the PDF first, then the books record.
 *
 * Uses the DeepSpace browser APIs (docs.deep.space/sdk-reference/client/files
 * and /client/records):
 * - `useR2Files().deleteFile(key)`: resolves `{ success, error? }`, never
 *   throws. Storage scopes keys to the caller ('self' scope: the key must sit
 *   under the caller's own user prefix, or it's 403 "key outside scope").
 *   A key that's already gone answers `{ success: true, existed: false }`.
 * - `useMutations('books').removeConfirmed(id)`: resolves once the record
 *   room applied the delete; rejects when the server refuses it (the books
 *   schema allows delete only for the owner: `delete: 'own'` on ownerId).
 *
 * If the file is already gone the record is still deleted, so no card is
 * left pointing at a missing PDF. Quizzes made from the book are kept: they
 * hold their own sourceText, and live rooms hold their own copy of the
 * questions and book title.
 */

export interface DeleteBookApis {
  deleteFile: (key: string) => Promise<{ success: boolean; error?: string }>
  removeConfirmed: (recordId: string) => Promise<void>
}

/** "Already gone" answers, in case an older storage server reports it as an error. */
const ALREADY_GONE = /not\s*found|404|no such|does not exist/i

export async function deleteBook(
  book: { recordId: string; fileId?: string | null },
  apis: DeleteBookApis,
): Promise<void> {
  if (book.fileId) {
    const file = await apis.deleteFile(book.fileId)
    if (!file.success && !ALREADY_GONE.test(file.error ?? '')) {
      throw new Error(`PDF delete failed: ${file.error ?? 'unknown error'}`)
    }
  }
  await apis.removeConfirmed(book.recordId)
}
