/**
 * The solo flow, at /generate: Screen 5 (Generating) → 7 (Solo quiz) →
 * 11 (Grading) → 12 (Result). docs/SPEC.md.
 *
 * Host mode (Pick chapter's "Host room"): the same generation, then the
 * hostRoom action creates a live room and this page opens its Lobby. If
 * creating the room fails, "Try again" reuses the generated quiz.
 *
 * Opened from Pick chapter with the selection in router state:
 * download the PDF → extract pages start…end with pdf.js, tagged [p.N] →
 * generateQuiz (answers never reach the browser) → play → gradeQuiz →
 * results. Retry replays the same questions from memory (no new
 * generation; grading runs again).
 *
 * Each Play solo tap creates a request with a one-time `nonce`. Generation
 * records the nonce in sessionStorage when it starts, so any later mount of
 * the same request (reload — router state survives it — back/forward, or a
 * dev hot reload) shows "start again" instead of generating (and billing)
 * a second time.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useQuery, useR2Files } from 'deepspace'
import type { Book } from '../../../schemas/books-schema'
import { QuizResult } from '../../../components/quiz/QuizResult'
import { SoloQuiz } from '../../../components/quiz/SoloQuiz'
import { ActionError, callAction } from '../../../lib/actions-client'
import { extractPageText, PdfReadError } from '../../../lib/pdf'
import {
  MAX_SOURCE_CHARS,
  tagPageText,
  type PublicQuestion,
  type QuizResponse,
  type QuizResult as Result,
} from '../../../lib/quiz'
import { card, primaryButton, progressTrack, secondaryButton } from '../../../lib/styles'

export interface GenerateRequest {
  bookId: string
  chapterTitle: string | null
  pageStart: number
  pageEnd: number
  /** One per Play solo / Host room tap; see the file comment. */
  nonce: string
  /** 'host' creates a live room after generating. */
  mode: 'solo' | 'host'
}

const STARTED_KEY = 'quizzo:generate-started'

function wasStarted(nonce: string): boolean {
  try {
    return sessionStorage.getItem(STARTED_KEY) === nonce
  } catch {
    return false
  }
}

function markStarted(nonce: string) {
  try {
    sessionStorage.setItem(STARTED_KEY, nonce)
  } catch {
    // Storage blocked: the in-memory ref guard still prevents double starts.
  }
}

interface Quiz {
  quizId: string
  questions: PublicQuestion[]
}

type State =
  | { step: 'reading' }
  | { step: 'writing' }
  | { step: 'hosting' }
  | { step: 'hostError'; quizId: string; message: string }
  | { step: 'tooLong'; chars: number }
  | { step: 'error'; message: string }
  | { step: 'playing'; quiz: Quiz; attempt: number }
  | { step: 'grading'; quiz: Quiz; responses: QuizResponse[] }
  | { step: 'gradeError'; quiz: Quiz; responses: QuizResponse[]; message: string }
  | { step: 'result'; quiz: Quiz; result: Result; attempt: number }

const TOO_LONG = 'This section is too long — pick a shorter range.'

function isRequest(value: unknown): value is GenerateRequest {
  const v = value as GenerateRequest | null
  return (
    !!v &&
    typeof v.bookId === 'string' &&
    typeof v.nonce === 'string' &&
    (v.mode === 'solo' || v.mode === 'host') &&
    Number.isInteger(v.pageStart) &&
    Number.isInteger(v.pageEnd)
  )
}

function messageOf(err: unknown): string {
  if (err instanceof ActionError || err instanceof PdfReadError) return err.message
  console.error('[solo]', err)
  return 'Something went wrong. Try again.'
}

export default function GeneratePage() {
  const location = useLocation()
  const request = isRequest(location.state) ? location.state : null
  // Decided once per mount, before the flow's effect marks the nonce.
  const [alreadyStarted] = useState(() => !!request && wasStarted(request.nonce))

  if (!request || alreadyStarted) {
    return (
      <Shell>
        <div className={`${card} p-6 text-center`}>
          <p className="text-heading text-ink">{request ? 'This quiz was already started' : 'Nothing to generate'}</p>
          <p className="mt-1 text-body text-ink-muted">Start again from your book.</p>
          <Link to={request ? `/books/${request.bookId}` : '/home'} className={`${primaryButton} mt-6`}>
            {request ? 'Back to book' : 'My books'}
          </Link>
        </div>
      </Shell>
    )
  }
  return <SoloFlow request={request} />
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-xl px-4 py-6 md:px-6 md:py-8">{children}</div>
}

function Busy({ title, detail, fill }: { title: string; detail: string; fill: string }) {
  return (
    <Shell>
      <div className={`${card} p-6`} aria-live="polite" aria-busy="true">
        <p className="text-heading text-ink">{title}</p>
        <p className="mt-1 text-body text-ink-muted">{detail}</p>
        <div className={`${progressTrack} mt-4`} role="progressbar" aria-label={title}>
          <div className={`h-full rounded-pill bg-brand animate-pulse ${fill}`} />
        </div>
      </div>
    </Shell>
  )
}

function SoloFlow({ request }: { request: GenerateRequest }) {
  const { bookId, chapterTitle, pageStart, pageEnd } = request
  const { records, status } = useQuery<Book>('books')
  const book = records.find((r) => r.recordId === bookId)
  const { readFile } = useR2Files()
  const navigate = useNavigate()
  const [state, setState] = useState<State>({ step: 'reading' })
  const startedFor = useRef<string | null>(null)

  const label = chapterTitle || (pageStart === pageEnd ? `p. ${pageStart}` : `pp. ${pageStart}–${pageEnd}`)
  const backTo = `/books/${bookId}`

  /** Host mode: create the live room for a generated quiz, then open its Lobby. */
  const openRoom = useCallback(
    async (quizId: string) => {
      setState({ step: 'hosting' })
      try {
        const { roomId } = await callAction<{ roomId: string }>('hostRoom', { quizId })
        navigate(`/rooms/${roomId}`, { replace: true })
      } catch (err) {
        setState({ step: 'hostError', quizId, message: messageOf(err) })
      }
    },
    [navigate],
  )

  const generate = useCallback(
    async (fileId: string) => {
      setState({ step: 'reading' })
      try {
        const res = await readFile(fileId)
        if (!res.ok) throw new ActionError("Couldn't download the book. Try again.")
        const pages = await extractPageText(await res.arrayBuffer(), pageStart, pageEnd)
        const sourceText = tagPageText(pages)
        if (sourceText.length > MAX_SOURCE_CHARS) {
          setState({ step: 'tooLong', chars: sourceText.length })
          return
        }
        if (!sourceText) throw new ActionError('These pages have no selectable text.')

        setState({ step: 'writing' })
        const quiz = await callAction<Quiz>('generateQuiz', { bookId, chapterTitle, pageStart, pageEnd, sourceText })
        if (request.mode === 'host') await openRoom(quiz.quizId)
        else setState({ step: 'playing', quiz, attempt: 1 })
      } catch (err) {
        const message = messageOf(err)
        setState(message === TOO_LONG ? { step: 'tooLong', chars: 0 } : { step: 'error', message })
      }
    },
    [readFile, bookId, chapterTitle, pageStart, pageEnd, request.mode, openRoom],
  )

  const grade = useCallback(async (quiz: Quiz, responses: QuizResponse[], attempt: number) => {
    setState({ step: 'grading', quiz, responses })
    try {
      const result = await callAction<Result>('gradeQuiz', { quizId: quiz.quizId, responses })
      setState({ step: 'result', quiz, result, attempt })
    } catch (err) {
      setState({ step: 'gradeError', quiz, responses, message: messageOf(err) })
    }
  }, [])

  // Each step starts at the top (the app scrolls inside <main>, not the window).
  useEffect(() => {
    document.querySelector('main')?.scrollTo({ top: 0 })
  }, [state.step])

  // Generate once per book load. The ref also stops React dev mode's double
  // effect run from generating (and billing) twice.
  useEffect(() => {
    if (!book || startedFor.current === request.nonce) return
    startedFor.current = request.nonce
    markStarted(request.nonce)
    void generate(book.data.fileId)
  }, [book, generate, request.nonce])

  if (status !== 'loading' && !book) {
    return (
      <Shell>
        <div className={`${card} p-6 text-center`} role="alert">
          <p className="text-heading text-ink">Book not found</p>
          <Link to="/home" className={`${primaryButton} mt-6`}>
            My books
          </Link>
        </div>
      </Shell>
    )
  }

  switch (state.step) {
    case 'reading':
    case 'writing':
      return (
        <Busy
          title={`Reading ${label}…`}
          detail={state.step === 'reading' ? 'Getting the text from your PDF.' : 'Writing your questions. This takes a few seconds.'}
          fill={state.step === 'reading' ? 'w-1/3' : 'w-2/3'}
        />
      )

    case 'hosting':
      return <Busy title="Opening your room…" detail="Making a room code for your players." fill="w-5/6" />

    case 'hostError':
      return (
        <Shell>
          <div className={`${card} p-6`} role="alert">
            <p className="text-heading text-ink">{state.message}</p>
            <p className="mt-1 text-body text-ink-muted">Your quiz is ready. Only the room still needs to open.</p>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <button type="button" className={primaryButton} onClick={() => void openRoom(state.quizId)}>
                Try again
              </button>
              <Link to={backTo} className={secondaryButton}>
                Back to book
              </Link>
            </div>
          </div>
        </Shell>
      )

    case 'tooLong':
    case 'error':
      return (
        <Shell>
          <div className={`${card} p-6`} role="alert">
            <p className="text-heading text-ink">{state.step === 'tooLong' ? TOO_LONG : state.message}</p>
            {state.step === 'tooLong' && state.chars > 0 && (
              <p className="mt-1 text-body text-ink-muted">
                {label} has about {Math.round(state.chars / 1000)}k characters. The limit is {MAX_SOURCE_CHARS / 1000}k.
              </p>
            )}
            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <Link to={backTo} className={primaryButton}>
                Back to book
              </Link>
              {state.step === 'error' && book && (
                <button type="button" className={secondaryButton} onClick={() => void generate(book.data.fileId)}>
                  Try again
                </button>
              )}
            </div>
          </div>
        </Shell>
      )

    case 'playing':
      return (
        <Shell>
          <SoloQuiz
            key={state.attempt}
            title={label}
            questions={state.quiz.questions}
            onSubmit={(responses) => void grade(state.quiz, responses, state.attempt)}
          />
        </Shell>
      )

    case 'grading':
      return <Busy title="Grading your answers…" detail="Checking your short answer against the book." fill="w-2/3" />

    case 'gradeError':
      return (
        <Shell>
          <div className={`${card} p-6`} role="alert">
            <p className="text-heading text-ink">{state.message}</p>
            <p className="mt-1 text-body text-ink-muted">Your answers are kept.</p>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <button type="button" className={primaryButton} onClick={() => void grade(state.quiz, state.responses, 1)}>
                Try again
              </button>
              <Link to={backTo} className={secondaryButton}>
                Back to book
              </Link>
            </div>
          </div>
        </Shell>
      )

    case 'result':
      return (
        <Shell>
          <QuizResult
            title={label}
            result={state.result}
            onRetry={() => setState({ step: 'playing', quiz: state.quiz, attempt: state.attempt + 1 })}
          />
        </Shell>
      )
  }
}
