/**
 * Screen 7 — Solo quiz (docs/SPEC.md). One question per screen with a
 * "3/6" progress bar. Multiple choice: pick an option, then Next. The last
 * question is the short answer, with Submit. Answers stay in local state
 * until Submit hands them to the parent.
 */

import { useEffect, useId, useState } from 'react'
import type { PublicQuestion, QuizResponse } from '../../lib/quiz'
import { MAX_SHORT_ANSWER_CHARS } from '../../lib/quiz'
import { answerOption, card, primaryButton, progressTrack, secondaryButton, textArea } from '../../lib/styles'

interface Props {
  title: string
  questions: PublicQuestion[]
  onSubmit: (responses: QuizResponse[]) => void
}

export function SoloQuiz({ title, questions, onSubmit }: Props) {
  const id = useId()
  const [index, setIndex] = useState(0)
  const [responses, setResponses] = useState<(QuizResponse | null)[]>(() => questions.map(() => null))

  // Each question starts at the top (the app scrolls inside <main>).
  useEffect(() => {
    document.querySelector('main')?.scrollTo({ top: 0 })
  }, [index])

  const q = questions[index]
  const total = questions.length
  const isLast = index === total - 1
  const response = responses[index]
  const answered = q.type === 'mcq' ? typeof response === 'number' : typeof response === 'string' && response.trim() !== ''

  const setResponse = (value: QuizResponse) =>
    setResponses((prev) => prev.map((r, i) => (i === index ? value : r)))

  const next = () => {
    if (!answered) return
    if (isLast) onSubmit(responses as QuizResponse[])
    else setIndex(index + 1)
  }

  return (
    <div>
      <p className="text-caption text-ink-muted">{title}</p>
      <div className="mt-2 flex items-center gap-4">
        <div
          className={progressTrack}
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={total}
          aria-valuenow={index + 1}
          aria-label="Quiz progress"
        >
          <div className="h-full rounded-pill bg-brand transition-[width]" style={{ width: `${((index + 1) / total) * 100}%` }} />
        </div>
        <span className="text-label text-ink">
          {index + 1}/{total}
        </span>
      </div>

      <form
        className={`${card} mt-4 p-4 md:p-6`}
        onSubmit={(e) => {
          e.preventDefault()
          next()
        }}
      >
        <fieldset key={index}>
          <legend className="text-heading text-ink">{q.prompt}</legend>

          {q.type === 'mcq' ? (
            <div className="mt-4 flex flex-col gap-2">
              {q.choices?.map((choice, i) => (
                <label key={i} className="cursor-pointer">
                  <input
                    type="radio"
                    name={`${id}-q${index}`}
                    className="peer sr-only"
                    checked={response === i}
                    onChange={() => setResponse(i)}
                  />
                  <span className={answerOption}>{choice}</span>
                </label>
              ))}
            </div>
          ) : (
            <label className="mt-4 block">
              <span className="sr-only">Your answer</span>
              <textarea
                className={textArea}
                value={typeof response === 'string' ? response : ''}
                maxLength={MAX_SHORT_ANSWER_CHARS}
                placeholder="Write one or two sentences."
                onChange={(e) => setResponse(e.target.value)}
              />
            </label>
          )}
        </fieldset>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          {index > 0 ? (
            <button type="button" className={secondaryButton} onClick={() => setIndex(index - 1)}>
              Back
            </button>
          ) : (
            <span />
          )}
          <button type="submit" className={primaryButton} disabled={!answered}>
            {isLast ? 'Submit' : 'Next'}
          </button>
        </div>
      </form>
    </div>
  )
}
