/**
 * Screen 10 — Live quiz (docs/SPEC.md), shown on /rooms/:roomId while the
 * room's status is `question`. Everyone is on the same question: the host
 * moves the game on, so there's no per-player progress, only "3/4 answered".
 *
 * Submit locks the answer (submitAnswer). A refresh comes back locked: the
 * player's own answer row (readable only by them) says what they chose.
 * Host only: Next, or See results on the last question (advanceRoom).
 */

import { useEffect, useId, useState } from 'react'
import type { Answer } from '../../schemas/answers-schema'
import type { Room } from '../../schemas/rooms-schema'
import { MAX_SHORT_ANSWER_CHARS } from '../../lib/quiz'
import { missingAnswersMessage } from '../../lib/room'
import { ActionError, callAction } from '../../lib/actions-client'
import { answerOption, card, primaryButton, progressTrack, secondaryButton, textArea } from '../../lib/styles'

interface Props {
  roomId: string
  room: Room
  userId: string
  /** The caller's own answer rows for this room. */
  myAnswers: Answer[]
}

export function LiveQuiz({ roomId, room, userId, myAnswers }: Props) {
  const index = room.currentIndex
  // Each question starts at the top (the app scrolls inside <main>).
  useEffect(() => {
    document.querySelector('main')?.scrollTo({ top: 0 })
  }, [index])

  // Keyed by index so the draft answer resets on each new question.
  return <LiveQuestion key={index} roomId={roomId} room={room} userId={userId} myAnswers={myAnswers} />
}

function LiveQuestion({ roomId, room, userId, myAnswers }: Props) {
  const id = useId()
  const index = room.currentIndex
  const total = room.questions.length
  const q = room.questions[index]
  const isHost = userId === room.hostId
  const isLast = index === total - 1

  const mine = myAnswers.find((a) => a.questionIndex === index)
  const [draft, setDraft] = useState<number | string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [advancing, setAdvancing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const locked = mine !== undefined
  const value = locked ? mine.response : draft
  const canSubmit =
    !locked && !submitting && (q.type === 'mcq' ? typeof draft === 'number' : typeof draft === 'string' && draft.trim() !== '')

  const playerCount = room.players?.length ?? 0
  const answeredIds = new Set(room.answered?.index === index ? room.answered.userIds : [])
  if (locked) answeredIds.add(userId)
  const answeredCount = Math.min(answeredIds.size, playerCount)
  const missing = (room.players ?? []).filter((p) => !answeredIds.has(p.userId)).length
  const allAnswered = missing === 0
  // "Move on anyway" confirm; closes itself if the last player answers meanwhile.
  const [confirming, setConfirming] = useState(false)
  const showConfirm = confirming && !allAnswered

  const submit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      await callAction('submitAnswer', { roomId, questionIndex: index, response: draft })
      // The answer row arrives through the live query and locks the screen.
    } catch (err) {
      setError(err instanceof ActionError ? err.message : "Couldn't save your answer. Try again.")
    } finally {
      setSubmitting(false)
    }
  }

  const advance = async (force: boolean) => {
    setAdvancing(true)
    setError(null)
    try {
      await callAction('advanceRoom', { roomId, op: isLast ? 'results' : 'next', expectedIndex: index, force })
      // The room record changes and every screen moves on together.
    } catch (err) {
      setError(err instanceof ActionError ? err.message : "Couldn't move the game on. Try again.")
    } finally {
      // A repeat tap is harmless: advanceRoom ignores a stale expectedIndex.
      setAdvancing(false)
    }
  }

  const nextLabel = advancing ? 'Moving on…' : isLast ? 'See results' : 'Next'

  return (
    <div>
      <p className="text-caption text-ink-muted">{room.title}</p>
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
          Question {index + 1}/{total}
        </span>
      </div>
      <p className="mt-2 text-caption text-ink-muted" aria-live="polite">
        {answeredCount}/{playerCount} answered
      </p>

      <form
        className={`${card} mt-4 p-4 md:p-6`}
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        <fieldset disabled={locked || submitting}>
          <legend className="text-heading text-ink">{q.prompt}</legend>

          {q.type === 'mcq' ? (
            <div className="mt-4 flex flex-col gap-2">
              {q.choices?.map((choice, i) => (
                <label key={i} className={locked ? undefined : 'cursor-pointer'}>
                  <input
                    type="radio"
                    name={`${id}-q${index}`}
                    className="peer sr-only"
                    checked={value === i}
                    onChange={() => setDraft(i)}
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
                value={typeof value === 'string' ? value : ''}
                maxLength={MAX_SHORT_ANSWER_CHARS}
                placeholder="Write one or two sentences."
                readOnly={locked}
                onChange={(e) => setDraft(e.target.value)}
              />
            </label>
          )}
        </fieldset>

        {locked && (
          <p className="mt-2 text-caption text-ink-muted" role="status">
            Answer locked
          </p>
        )}

        {error && (
          <p role="alert" className="mt-4 text-body text-error">
            {error}
          </p>
        )}

        {/* One primary per screen: Submit until locked, then the host's Next. */}
        <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
          {!locked && (
            <button type="submit" className={`${primaryButton} sm:flex-1`} disabled={!canSubmit}>
              {submitting ? 'Locking…' : 'Submit'}
            </button>
          )}
          {isHost && locked && (
            <button
              type="button"
              className={`${primaryButton} sm:flex-1`}
              onClick={() => void advance(false)}
              disabled={!allAnswered || advancing}
            >
              {nextLabel}
            </button>
          )}
          {isHost && locked && !allAnswered && !showConfirm && (
            <button type="button" className={`${secondaryButton} sm:flex-1`} onClick={() => setConfirming(true)}>
              Move on anyway
            </button>
          )}
        </div>

        {/* Host: the server also refuses to move on before the host answers. */}
        {isHost && !locked && (
          <p className="mt-2 text-center text-caption text-ink-muted">Submit your answer to move the game on.</p>
        )}
        {isHost && locked && !allAnswered && !showConfirm && (
          <p className="mt-2 text-center text-caption text-ink-muted">Next unlocks when everyone has answered.</p>
        )}

        {isHost && locked && showConfirm && (
          <div role="alertdialog" aria-labelledby={`${id}-confirm`} className="mt-4 rounded-md border border-line-strong p-4">
            <p id={`${id}-confirm`} className="text-body text-ink">
              {missingAnswersMessage(missing)}
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row-reverse">
              <button
                type="button"
                className={`${secondaryButton} sm:flex-1`}
                onClick={() => void advance(true)}
                disabled={advancing}
                autoFocus
              >
                {advancing ? 'Moving on…' : isLast ? 'See results anyway' : 'Move on'}
              </button>
              <button
                type="button"
                className="focus-ring h-12 rounded-pill px-6 text-label text-brand sm:flex-1"
                onClick={() => setConfirming(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {!isHost && locked && (
          <p className="mt-2 text-center text-body text-ink-muted" aria-live="polite">
            Waiting for the host…
          </p>
        )}
      </form>
    </div>
  )
}
