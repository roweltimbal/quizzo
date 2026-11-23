/**
 * gradeQuiz — Screen 11 (docs/SPEC.md § Grading), solo play.
 *
 * Multiple choice is graded in code. Only the short answer goes to Claude,
 * with the question, expected answer, the player's answer and the chapter
 * text; the reply is Zod-validated (one retry). If the AI call fails, the
 * MC results still come back and the short answer is marked ungraded.
 * Solo results are returned, not saved.
 *
 * Security: action tools run with record permissions off, so this checks
 * quiz ownership itself. AI is billed to the app owner (no authToken).
 */

import { generateText } from 'ai'
import { createDeepSpaceAI } from 'deepspace/worker'
import type { ActionHandler } from 'deepspace/worker'
import { z } from 'zod'
import type { Env } from '../../worker'
import type { Quiz } from '../schemas/quizzes-schema'
import {
  buildResult,
  gradeSystemPrompt,
  gradeUserPrompt,
  parseGradeOutput,
  QUIZ_MODEL,
  responsesError,
  type QuizResponse,
  type ShortGrade,
} from '../lib/quiz'

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
    shortIndex === -1 ? { graded: false } : await gradeShortAnswer(env, quiz, shortIndex, String(responses[shortIndex]))

  return { success: true, data: buildResult(quiz.questions, responses as QuizResponse[], shortGrade) }
}

async function gradeShortAnswer(env: Env, quiz: Quiz, index: number, answer: string): Promise<ShortGrade> {
  const q = quiz.questions[index]
  const model = createDeepSpaceAI(env, 'anthropic')(QUIZ_MODEL)
  const system = gradeSystemPrompt(quiz.pageStart, quiz.pageEnd)
  const basePrompt = gradeUserPrompt(q.prompt, q.expectedAnswer ?? '', answer.trim(), quiz.sourceText)
  let prompt = basePrompt

  for (let attempt = 1; attempt <= 2; attempt++) {
    let text: string
    try {
      ;({ text } = await generateText({ model, system, prompt, maxRetries: 1, timeout: { totalMs: 60_000 } }))
    } catch (err) {
      console.error(`[gradeQuiz] AI call failed (attempt ${attempt})`, err)
      continue
    }
    const parsed = parseGradeOutput(text, quiz.pageStart, quiz.pageEnd, q.sourcePage)
    if (parsed.ok) return parsed.grade
    console.warn(`[gradeQuiz] invalid output (attempt ${attempt}): ${parsed.error}`)
    prompt = `${basePrompt}\n\nYour previous reply was rejected: ${parsed.error}\nReply again with only the corrected JSON object.`
  }
  return { graded: false }
}
