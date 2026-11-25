/**
 * Screen 12 — Result (docs/SPEC.md), solo. Score, counts, then each
 * question with ✓/✗, your answer, the correct answer, the explanation with
 * its page, and the AI feedback for the short answer. No leaderboard (solo).
 */

import { Check, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { shortScoreLabel, type QuestionResult, type QuizResult as Result } from '../../lib/quiz'
import { answerOption, answerOptionCorrect, answerOptionIncorrect, card, primaryButton, secondaryButton } from '../../lib/styles'

interface Props {
  title: string
  result: Result
  onRetry: () => void
}

export function QuizResult({ title, result, onRetry }: Props) {
  const incorrect = result.total - result.correctCount
  return (
    <div>
      <p className="text-caption text-ink-muted">{title}</p>
      <div className={`${card} mt-2 p-6 text-center`}>
        <h1 className="text-title text-ink">Quiz complete!</h1>
        <p className="mt-2 text-body text-ink-muted">You scored</p>
        <p className="text-display text-ink">
          {result.correctCount}/{result.total}
        </p>
        <p className="mt-2 text-label text-ink-muted">
          {result.correctCount} correct · {incorrect} incorrect
        </p>
      </div>

      <ol className="mt-6 flex flex-col gap-4">
        {result.questions.map((q, i) => (
          <li key={i} className={`${card} p-4 md:p-6`}>
            <QuestionReview q={q} n={i + 1} total={result.total} />
          </li>
        ))}
      </ol>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
        <Link to="/home" className={`${primaryButton} sm:flex-1`}>
          Create another quiz
        </Link>
        <button type="button" className={`${secondaryButton} sm:flex-1`} onClick={onRetry}>
          Retry
        </button>
      </div>
    </div>
  )
}

function Mark({ correct }: { correct: boolean }) {
  return correct ? (
    <Check className="size-5 shrink-0 text-success" aria-label="Correct" strokeWidth={3} />
  ) : (
    <X className="size-5 shrink-0 text-error" aria-label="Incorrect" strokeWidth={3} />
  )
}

/** One question in the review list (solo and live Result). */
export function QuestionReview({ q, n, total }: { q: QuestionResult; n: number; total: number }) {
  const grade = q.grade
  const status =
    q.type === 'short'
      ? q.pending
        ? 'Grading…'
        : grade?.graded
        ? shortScoreLabel(grade.score)
        : 'Not graded'
      : q.correct
        ? 'Correct'
        : 'Incorrect'

  return (
    <>
      <p className="text-caption text-ink-muted">
        {n}/{total} · {status}
      </p>
      <p className="mt-1 text-heading text-ink">{q.prompt}</p>

      <div className="mt-3 flex flex-col gap-2">
        <div>
          <p className="mb-1 text-caption text-ink-muted">Your answer</p>
          <div className={q.pending ? answerOption : q.correct ? answerOptionCorrect : answerOptionIncorrect}>
            <span className="min-w-0 whitespace-pre-wrap break-words">{q.yourAnswer}</span>
            {!q.pending && <Mark correct={q.correct} />}
          </div>
        </div>

        {(!q.correct || q.type === 'short') && (
          <div>
            <p className="mb-1 text-caption text-ink-muted">{q.type === 'short' ? 'Expected answer' : 'Correct answer'}</p>
            <div className={answerOptionCorrect}>
              <span className="min-w-0">{q.correctAnswer}</span>
              <Check className="size-5 shrink-0 text-success" aria-hidden strokeWidth={3} />
            </div>
          </div>
        )}
      </div>

      {q.type === 'short' && (
        <p className="mt-3 text-body text-ink">
          {q.pending ? (
            <span className="text-ink-muted">Grading your answer…</span>
          ) : grade?.graded ? (
            <>
              {grade.feedback} <span className="text-ink-muted">See p. {grade.page}.</span>
            </>
          ) : (
            <span className="text-ink-muted">Couldn&apos;t grade this one.</span>
          )}
        </p>
      )}

      <p className="mt-3 text-body text-ink-muted">
        {q.explanation} See p. {q.sourcePage}.
      </p>
    </>
  )
}
