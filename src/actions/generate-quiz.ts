/**
 * generateQuiz — Screen 5 (docs/SPEC.md § Generating).
 *
 * Takes the chapter text the browser extracted, asks Claude for 5
 * multiple-choice + 1 short-answer question as JSON, validates it with Zod
 * (one retry with the validation errors), saves the quizzes record, and
 * returns the questions WITHOUT answers or explanations.
 *
 * Security: action tools run with record permissions off, so this checks
 * book ownership itself. AI runs through the DeepSpace proxy with no
 * authToken, so the app owner is billed, never the player.
 */

import { generateText } from 'ai'
import { createDeepSpaceAI } from 'deepspace/worker'
import type { ActionHandler } from 'deepspace/worker'
import { z } from 'zod'
import type { Env } from '../../worker'
import type { Book } from '../schemas/books-schema'
import type { Quiz } from '../schemas/quizzes-schema'
import { MAX_RANGE_PAGES } from '../lib/outline'
import {
  MAX_SOURCE_CHARS,
  parseQuizOutput,
  QUIZ_MODEL,
  quizSystemPrompt,
  quizUserPrompt,
  shuffleChoices,
  toPublicQuestions,
} from '../lib/quiz'

const paramsSchema = z.object({
  bookId: z.string().min(1),
  chapterTitle: z.string().trim().max(300).nullable(),
  pageStart: z.number().int().min(1),
  pageEnd: z.number().int().min(1),
  sourceText: z.string().trim().min(1).max(MAX_SOURCE_CHARS),
})

const GENERATION_FAILED = "Couldn't generate a good quiz from this section. Try again."

export const generateQuiz: ActionHandler<Env> = async ({ userId, params, tools, env }) => {
  const input = paramsSchema.safeParse(params)
  if (!input.success) {
    const tooLong = input.error.issues.some((i) => i.path[0] === 'sourceText' && i.code === 'too_big')
    return { success: false, error: tooLong ? 'This section is too long — pick a shorter range.' : 'Invalid request.' }
  }
  const { bookId, chapterTitle, pageStart, pageEnd, sourceText } = input.data

  // Ownership: the caller must own the book (RBAC is off for action tools).
  const book = await tools.get<Record<string, unknown>>('books', bookId)
  const bookData = book.success ? (book.data.record?.data as unknown as Book | undefined) : undefined
  if (!bookData || bookData.ownerId !== userId) {
    return { success: false, error: 'Book not found.' }
  }
  if (pageStart > pageEnd || pageEnd > bookData.pageCount || pageEnd - pageStart + 1 > MAX_RANGE_PAGES) {
    return { success: false, error: 'Invalid page range.' }
  }

  const model = createDeepSpaceAI(env, 'anthropic')(QUIZ_MODEL)
  const system = quizSystemPrompt(pageStart, pageEnd)
  let prompt = quizUserPrompt(chapterTitle, pageStart, pageEnd, sourceText)

  let parsed: ReturnType<typeof parseQuizOutput> = { ok: false, error: 'not attempted' }
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const { text } = await generateText({ model, system, prompt, maxRetries: 1, timeout: { totalMs: 90_000 } })
      parsed = parseQuizOutput(text, pageStart, pageEnd)
    } catch (err) {
      console.error(`[generateQuiz] AI call failed (attempt ${attempt})`, err)
      parsed = { ok: false, error: 'AI call failed' }
      // A failed call (network, credits) isn't fixed by feedback; retry as-is.
      continue
    }
    if (parsed.ok) break
    console.warn(`[generateQuiz] invalid output (attempt ${attempt}): ${parsed.error}`)
    prompt =
      quizUserPrompt(chapterTitle, pageStart, pageEnd, sourceText) +
      `\n\nYour previous reply was rejected: ${parsed.error}\nReply again with only the corrected JSON object.`
  }
  if (!parsed.ok) return { success: false, error: GENERATION_FAILED }

  // The model favors certain answer slots; shuffle so position isn't a hint.
  const questions = shuffleChoices(parsed.questions)

  const quiz: Quiz = {
    ownerId: userId,
    bookId,
    chapterTitle: chapterTitle ?? '',
    pageStart,
    pageEnd,
    sourceText,
    questions,
  }
  const saved = await tools.create('quizzes', quiz as unknown as Record<string, unknown>)
  if (!saved.success) {
    console.error('[generateQuiz] saving quiz failed', saved.error)
    return { success: false, error: "Couldn't save the quiz. Try again." }
  }

  return {
    success: true,
    data: { quizId: saved.data.recordId, questions: toPublicQuestions(questions) },
  }
}
