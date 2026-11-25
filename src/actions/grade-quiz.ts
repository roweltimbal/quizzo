/**
 * gradeQuiz — Screen 11 (docs/SPEC.md § Grading), solo play.
 *
 * Multiple choice is graded in code. Only the short answer goes to Claude (src/lib/grade-short-answer.ts),
 * with the question, expected answer, the player's answer and the chapter
 * text; the reply is Zod-validated (one retry). If the AI call fails, the
 * MC results still come back and the short answer is marked ungraded.
 * Solo results are returned, not saved.
 *
 * Security: action tools run with record permissions off, so this checks
 * quiz ownership itself. AI is billed to the app owner (no authToken).
 */

import type { ActionHandler } from 'deepspace/worker'
import { z } from 'zod'
import type { Env } from '../../worker'
import type { Quiz } from '../schemas/quizzes-schema'
import { buildResult, responsesError, type QuizResponse, type ShortGrade } from '../lib/quiz'
import { claudeGenerate, gradeShortAnswer } from '../lib/grade-short-answer'

const paramsSchema = z.object({
  quizId: z.string().min(1),
  responses: z.array(z.union([z.number(), z.string()])).max(20),
})

export const gradeQuiz: ActionHandler<Env> = async ({ userId, params, tools, env }) => {
  const input = paramsSchema.safeParse(params)
  if (!input.success) return { success: false, error: 'Invalid request.' }
  const { quizId, responses } = input.data

  // Ownership: RBAC is off for action tools, so check it here.
  const found = await tools.get<Record<string, unknown>>('quizzes', quizId)
  const quiz = found.success ? (found.data.record?.data as unknown as Quiz | undefined) : undefined
  if (!quiz || quiz.ownerId !== userId) return { success: false, error: 'Quiz not found.' }

  const problem = responsesError(quiz.questions, responses)
  if (problem) return { success: false, error: problem }

  const shortIndex = quiz.questions.findIndex((q) => q.type === 'short')
  const shortGrade: ShortGrade =
    shortIndex === -1
      ? { graded: false }
      : await gradeShortAnswer(
          claudeGenerate(env),
          {
            question: quiz.questions[shortIndex].prompt,
            expectedAnswer: quiz.questions[shortIndex].expectedAnswer ?? '',
            answer: String(responses[shortIndex]),
            sourceText: quiz.sourceText,
            pageStart: quiz.pageStart,
            pageEnd: quiz.pageEnd,
            sourcePage: quiz.questions[shortIndex].sourcePage,
          },
          'gradeQuiz',
        )

  return { success: true, data: buildResult(quiz.questions, responses as QuizResponse[], shortGrade) }
}
