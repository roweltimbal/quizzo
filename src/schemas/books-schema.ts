/**
 * books — one record per uploaded PDF (docs/SPEC.md § Data model).
 *
 * Owner read/write only. `ownerId` is stamped by the server with the
 * verified caller id (userBound) and can't change afterwards, so a user
 * can't create or move a book into someone else's name.
 */

import type { CollectionSchema } from 'deepspace/schema'

/** Shape of `record.data` for a book. */
export interface Book {
  ownerId: string
  title: string
  /** DeepSpace file storage id of the PDF. */
  fileId: string
  pageCount: number
  /** PDF outline (TOC). Empty when the PDF has none. */
  outline: { title: string; startPage: number }[]
}

const ownerOnly = {
  read: 'own',
  create: true,
  update: 'own',
  delete: 'own',
  writableFields: ['title', 'fileId', 'pageCount', 'outline'],
} as const

export const booksSchema: CollectionSchema = {
  name: 'books',
  ownerField: 'ownerId',
  columns: [
    { name: 'ownerId', storage: 'text', interpretation: 'plain', userBound: true, immutable: true },
    { name: 'title', storage: 'text', interpretation: 'plain', required: true, maxLength: 300 },
    { name: 'fileId', storage: 'text', interpretation: 'plain', required: true },
    { name: 'pageCount', storage: 'number', interpretation: 'plain', required: true },
    { name: 'outline', storage: 'text', interpretation: 'json', default: [] },
  ],
  permissions: {
    // Signed-out (anonymous) connections are `viewer`: no access.
    viewer: { read: false, create: false, update: false, delete: false },
    member: { ...ownerOnly, writableFields: [...ownerOnly.writableFields] },
    // Admins get the same owner-only access; no reading other users' books.
    admin: { ...ownerOnly, writableFields: [...ownerOnly.writableFields] },
  },
}
