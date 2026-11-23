/**
 * Browser-side PDF reading with pdf.js (docs/SPEC.md § Upload book).
 *
 * pdf.js is imported lazily, so it only downloads on the screens that read
 * PDFs. Parsing runs in pdf.js's own web worker.
 */

import type { PDFDocumentProxy } from 'pdfjs-dist'
import type { Book } from '../schemas/books-schema'

export type OutlineEntry = Book['outline'][number]

export interface PdfSummary {
  pageCount: number
  /** Empty when the PDF has no usable outline. */
  outline: OutlineEntry[]
  /** False for scanned PDFs (no text layer). */
  hasText: boolean
}

/** Thrown with a message that's safe to show the user. */
export class PdfReadError extends Error {}

let pdfjsPromise: Promise<typeof import('pdfjs-dist')> | null = null

/**
 * The worker is imported with `?worker`, so Vite bundles it as a regular
 * `.js` worker chunk. Pointing pdf.js at the raw `pdf.worker.min.mjs` file
 * (`?url` + workerSrc) broke in production: the static host serves `.mjs`
 * as `application/octet-stream`, and browsers refuse to start a module
 * worker without a JavaScript content type. One worker is shared by every
 * document opened in the session.
 */
function loadPdfjs() {
  pdfjsPromise ??= Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?worker'),
  ]).then(([pdfjs, { default: PdfWorker }]) => {
    pdfjs.GlobalWorkerOptions.workerPort = new PdfWorker()
    return pdfjs
  })
  pdfjsPromise.catch(() => {
    pdfjsPromise = null // let the next attempt retry instead of caching the failure
  })
  return pdfjsPromise
}

/** Open a PDF from its bytes. Caller must call `pdf.loadingTask.destroy()` when done. */
export async function openPdf(data: ArrayBuffer): Promise<PDFDocumentProxy> {
  let pdfjs: typeof import('pdfjs-dist')
  try {
    pdfjs = await loadPdfjs()
  } catch (err) {
    console.error('[pdf] Failed to load pdf.js', err)
    throw new PdfReadError("Couldn't load the PDF reader. Reload the page and try again.")
  }

  try {
    // pdf.js takes ownership of (detaches) the buffer it gets, so pass a copy.
    return await pdfjs.getDocument({ data: new Uint8Array(data.slice(0)) }).promise
  } catch (err) {
    if (err instanceof pdfjs.PasswordException) {
      throw new PdfReadError('This PDF is password protected.')
    }
    if (err instanceof pdfjs.InvalidPDFException) {
      throw new PdfReadError("This file isn't a readable PDF.")
    }
    // Anything else (worker failed to start, out of memory, …) is not the
    // file's fault — log the real cause and don't blame the PDF.
    console.error('[pdf] Failed to open PDF', err)
    throw new PdfReadError("Couldn't read this PDF. Reload the page and try again.")
  }
}

/** Page count, outline and whether the PDF has selectable text. */
export async function readPdfSummary(data: ArrayBuffer): Promise<PdfSummary> {
  const pdf = await openPdf(data)
  try {
    const [outline, hasText] = await Promise.all([readOutline(pdf), detectText(pdf)])
    return { pageCount: pdf.numPages, outline, hasText }
  } finally {
    void pdf.loadingTask.destroy()
  }
}

type RawOutlineItem = Awaited<ReturnType<PDFDocumentProxy['getOutline']>>[number]

/**
 * Top-level outline entries with their start page. A single root entry
 * (often the book's own title) is unwrapped to its children.
 *
 * Entries whose title starts with "_" are dropped (Word's hidden bookmarks
 * such as "_GoBack" / "_Toc…", not real chapters). The outline counts as
 * missing (returns []) when fewer than 2 entries remain.
 */
async function readOutline(pdf: PDFDocumentProxy): Promise<OutlineEntry[]> {
  const isRealEntry = (item: RawOutlineItem) => !item.title.trim().startsWith('_')

  let items = ((await pdf.getOutline().catch(() => null)) ?? []).filter(isRealEntry)
  if (items.length === 1 && items[0].items?.length) {
    items = (items[0].items as RawOutlineItem[]).filter(isRealEntry)
  }

  const entries: OutlineEntry[] = []
  for (const item of items) {
    const title = item.title.replace(/\s+/g, ' ').trim()
    const startPage = await resolvePage(pdf, item.dest)
    if (title && startPage !== null) entries.push({ title, startPage })
  }

  return entries.length < 2 ? [] : entries
}

/** 1-based page number for an outline destination, or null. */
async function resolvePage(pdf: PDFDocumentProxy, dest: RawOutlineItem['dest']): Promise<number | null> {
  try {
    const explicit = typeof dest === 'string' ? await pdf.getDestination(dest) : dest
    const target = explicit?.[0]
    if (target == null) return null
    const index = typeof target === 'number' ? target : await pdf.getPageIndex(target)
    return index >= 0 && index < pdf.numPages ? index + 1 : null
  } catch {
    return null
  }
}

/**
 * Samples up to 12 pages spread across the book and returns true as soon as
 * one has real text. Scanned PDFs have none, or only a few stray characters.
 */
async function detectText(pdf: PDFDocumentProxy): Promise<boolean> {
  const samples = Math.min(pdf.numPages, 12)
  const pages = new Set<number>()
  for (let i = 0; i < samples; i++) {
    pages.add(1 + Math.floor((i * pdf.numPages) / samples))
  }

  for (const n of pages) {
    const page = await pdf.getPage(n)
    const content = await page.getTextContent()
    page.cleanup()
    const chars = content.items.reduce(
      (sum, item) => sum + ('str' in item ? item.str.replace(/\s/g, '').length : 0),
      0,
    )
    if (chars >= 50) return true
  }
  return false
}
