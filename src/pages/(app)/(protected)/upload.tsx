/**
 * Screen 3 — Upload book (docs/SPEC.md).
 *
 * Order: check the file → read it with pdf.js → upload to DeepSpace file
 * storage → save the books record → back to Home. The PDF is read before
 * the upload so a scanned or broken PDF is rejected without using storage.
 *
 * Files go in the per-user ('self') scope: only the uploader can read them.
 * The books record stores the storage key as `fileId`.
 */

import { useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { formatFileSize, useMutations, useR2Files } from 'deepspace'
import { useToast } from '@/components/ui'
import type { Book } from '../../../schemas/books-schema'
import { PdfReadError, readPdfSummary } from '../../../lib/pdf'
import { card, primaryButton, secondaryButton } from '../../../lib/styles'

const MAX_BYTES = 20 * 1024 * 1024

type Phase =
  | { step: 'idle' }
  | { step: 'reading' }
  | { step: 'uploading'; percent: number }
  | { step: 'saving' }

/** Cheap checks before reading the file: type, size, and the PDF header. */
async function checkFile(file: File): Promise<string | null> {
  const looksLikePdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
  if (!looksLikePdf) return 'Choose a PDF file.'
  if (file.size > MAX_BYTES) return `This PDF is ${formatFileSize(file.size)}. The limit is 20 MB.`
  if (file.size === 0) return 'This file is empty.'
  const header = new TextDecoder().decode(await file.slice(0, 5).arrayBuffer())
  if (header !== '%PDF-') return "This file isn't a readable PDF."
  return null
}

/** "biology_2e-ch4.pdf" → "biology 2e ch4" */
function titleFromFileName(name: string) {
  return name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim() || 'Untitled book'
}

export default function UploadPage() {
  const navigate = useNavigate()
  const { success } = useToast()
  const { upload, deleteFile } = useR2Files()
  const books = useMutations<Book>('books')
  const inputRef = useRef<HTMLInputElement>(null)

  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>({ step: 'idle' })
  const busy = phase.step !== 'idle'

  const onPick = async (e: ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0] ?? null
    setFile(null)
    setError(null)
    if (!picked) return
    const problem = await checkFile(picked)
    if (problem) {
      setError(problem)
      e.target.value = ''
      return
    }
    setFile(picked)
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!file || busy) return
    setError(null)

    let uploadedKey: string | undefined
    try {
      setPhase({ step: 'reading' })
      const summary = await readPdfSummary(await file.arrayBuffer())
      if (!summary.hasText) {
        throw new PdfReadError('This PDF has no selectable text.')
      }

      setPhase({ step: 'uploading', percent: 0 })
      const result = await upload(file, file.name, {
        onProgress: (sent, total) =>
          setPhase({ step: 'uploading', percent: total ? Math.round((sent / total) * 100) : 0 }),
      })
      if (!result.success || !result.key) {
        throw new PdfReadError(result.error ? `Upload failed: ${result.error}` : 'Upload failed. Try again.')
      }
      uploadedKey = result.key

      setPhase({ step: 'saving' })
      const title = titleFromFileName(file.name)
      await books.createConfirmed({
        title,
        fileId: result.key,
        pageCount: summary.pageCount,
        outline: summary.outline,
      } as Book) // ownerId is stamped by the server (userBound)

      success('Book added', title)
      navigate('/home')
    } catch (err) {
      // Don't leave an orphaned PDF in storage if the record wasn't saved.
      if (uploadedKey) void deleteFile(uploadedKey).catch(() => {})
      setError(err instanceof PdfReadError ? err.message : 'Something went wrong. Try again.')
      setPhase({ step: 'idle' })
    }
  }

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-6 md:px-6 md:py-8">
      <h1 className="text-title text-ink">Upload book</h1>
      <p className="mt-1 text-body text-ink-muted">A PDF with selectable text, up to 20 MB.</p>

      <form onSubmit={onSubmit} className={`${card} mt-6 p-4 md:p-6`}>
        <input
          ref={inputRef}
          id="book-file"
          type="file"
          accept="application/pdf,.pdf"
          className="sr-only"
          onChange={onPick}
          disabled={busy}
        />

        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            className={secondaryButton}
            onClick={() => inputRef.current?.click()}
            disabled={busy}
          >
            {file ? 'Choose another' : 'Choose PDF'}
          </button>
          <p className="min-w-0 flex-1 text-body text-ink-muted" aria-live="polite">
            {file ? (
              <>
                <span className="block truncate text-ink">{file.name}</span>
                <span className="text-caption">{formatFileSize(file.size)}</span>
              </>
            ) : (
              'No file chosen'
            )}
          </p>
        </div>

        {error && (
          <p role="alert" className="mt-4 rounded-sm bg-error-soft px-4 py-3 text-body text-error">
            {error}
          </p>
        )}

        {busy && <Progress phase={phase} />}

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Link to="/home" className={secondaryButton} aria-disabled={busy || undefined}>
            Cancel
          </Link>
          <button type="submit" className={primaryButton} disabled={!file || busy || !books.ready}>
            Upload
          </button>
        </div>
      </form>
    </div>
  )
}

function Progress({ phase }: { phase: Phase }) {
  const percent = phase.step === 'uploading' ? phase.percent : phase.step === 'saving' ? 100 : 0
  // Files under the SDK's 25 MB single-request bound (all of ours, at 20 MB
  // max) report no progress until they finish, so show an indeterminate bar
  // instead of a stuck "0%".
  const indeterminate = phase.step === 'reading' || (phase.step === 'uploading' && phase.percent === 0)
  const label =
    phase.step === 'reading'
      ? 'Reading PDF…'
      : phase.step === 'uploading'
        ? indeterminate
          ? 'Uploading…'
          : `Uploading… ${phase.percent}%`
        : 'Saving…'

  return (
    <div className="mt-4" aria-live="polite">
      <div className="flex items-center gap-4">
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={indeterminate ? undefined : percent}
          aria-label="Upload progress"
          className="h-2 flex-1 overflow-hidden rounded-pill bg-brand-soft"
        >
          <div
            className={`h-full rounded-pill bg-brand transition-[width] ${indeterminate ? 'w-1/3 animate-pulse' : ''}`}
            style={indeterminate ? undefined : { width: `${percent}%` }}
          />
        </div>
      </div>
      <p className="mt-2 text-label text-ink">{label}</p>
    </div>
  )
}
