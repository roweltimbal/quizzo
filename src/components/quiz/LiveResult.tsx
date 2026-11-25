/**
 * Screen 12 — Result, live room (docs/SPEC.md). Shown on /rooms/:roomId
 * once the room's status is `results`.
 *
 * Leaderboard at the top (book + chapter title, ranked players, ties share
 * a rank). It updates live as the grading job finishes short answers;
 * "grading…" marks scores still waiting. Below: your own review, built from
 * your answer rows and the room's answer key (published only at results).
 */

import { Link } from 'react-router-dom'
import type { Answer } from '../../schemas/answers-schema'
import type { Room } from '../../schemas/rooms-schema'
import { rankEntries } from '../../lib/leaderboard'
import type { QuestionResult } from '../../lib/quiz'
import { card, primaryButton } from '../../lib/styles'
import { QuestionReview } from './QuizResult'

interface Props {
  room: Room
  userId: string
  myAnswers: Answer[]
}

/** Your review rows, from your answers + the answer key. */
export function liveReview(room: Room, myAnswers: readonly Answer[]): QuestionResult[] {
  const key = room.answerKey ?? []
  return room.questions.map((q, i) => {
    const row = myAnswers.find((a) => a.questionIndex === i)
    const k = key[i]
    const base = {
      type: q.type,
      prompt: q.prompt,
      correctAnswer: k?.correctAnswer ?? '',
      explanation: k?.explanation ?? '',
      sourcePage: k?.sourcePage ?? q.sourcePage,
    }
    if (!row) return { ...base, correct: false, yourAnswer: 'No answer' }
    if (q.type === 'mcq') {
      const picked = typeof row.response === 'number' ? row.response : -1
      return { ...base, correct: row.isCorrect === true, yourAnswer: q.choices?.[picked] ?? '' }
    }
    const pending = !row.graded
    return {
      ...base,
      correct: row.isCorrect === true,
      yourAnswer: String(row.response),
      pending,
      grade:
        !pending && typeof row.score === 'number'
          ? { graded: true, score: row.score, feedback: row.feedback ?? '', page: row.page ?? q.sourcePage }
          : { graded: false },
    }
  })
}

export function LiveResult({ room, userId, myAnswers }: Props) {
  const board = rankEntries(room.leaderboard ?? [])
  const total = room.questions.length
  const review = liveReview(room, myAnswers)
  const correct = review.filter((r) => r.correct).length
  const waiting = review.some((r) => r.pending)
  const heading = [room.bookTitle, room.title].filter(Boolean).join(' · ')

  return (
    <div>
      <p className="text-caption text-ink-muted">{heading}</p>
      <div className={`${card} mt-2 p-6 text-center`}>
        <h1 className="text-title text-ink">Quiz complete!</h1>
        <p className="mt-2 text-body text-ink-muted">You scored</p>
        <p className="text-display text-ink">
          {correct}/{total}
        </p>
        <p className="mt-2 text-label text-ink-muted" aria-live="polite">
          {waiting ? 'Grading your short answer…' : `${correct} correct · ${total - correct} incorrect`}
        </p>
      </div>

      <section className={`${card} mt-6 p-4 md:p-6`} aria-labelledby="leaderboard-heading">
        <h2 id="leaderboard-heading" className="text-heading text-ink">
          Leaderboard
        </h2>
        <ol className="mt-2" aria-live="polite">
          {board.map((e) => (
            <li key={e.userId} className="flex min-h-11 items-center gap-4 border-b border-line py-2 last:border-b-0">
              <span className="w-6 text-label text-ink-muted">{e.rank}</span>
              <span className="min-w-0 flex-1 text-body text-ink">
                {e.displayName}
                {e.userId === userId && <span className="ml-2 text-caption text-ink-muted">you</span>}
              </span>
              <span className="text-label text-ink">
                {e.score}/{total}
                {e.pending && <span className="ml-2 text-caption text-ink-muted">grading…</span>}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <h2 className="mt-6 text-heading text-ink">Your answers</h2>
      <ol className="mt-4 flex flex-col gap-4">
        {review.map((q, i) => (
          <li key={i} className={`${card} p-4 md:p-6`}>
            <QuestionReview q={q} n={i + 1} total={total} />
          </li>
        ))}
      </ol>

      <div className="mt-6">
        <Link to="/home" className={`${primaryButton} w-full`}>
          Create another quiz
        </Link>
      </div>
    </div>
  )
}
