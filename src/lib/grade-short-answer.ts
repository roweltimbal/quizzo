/**
 * Short-answer grading with Claude (docs/SPEC.md § Grading), shared by solo
 * `gradeQuiz` and the live room's grading job so both use the same prompt,
 * the same <student_answer> tags, the same validation and feedback cleanup.
 *
 * Two attempts: a failed call or an invalid reply is retried once (with the
 * reason, for an invalid reply). After that it's `{ graded: false }`, shown
 * as "Couldn't grade this one" and counted as 0.
 *
 * Worker-only (createDeepSpaceAI). `generate` is injectable for tests.
 */

import { generateText } from 'ai'
import { createDeepSpaceAI } from 'deepspace/worker'
import type { DeepSpaceAIEnv } from 'deepspace/worker'
import { gradeSystemPrompt, gradeUserPrompt, parseGradeOutput, QUIZ_MODEL, type ShortGrade } from './quiz'

/** Sends one system + user prompt to the model and returns its text. */
export type GenerateFn = (input: { system: string; prompt: string }) => Promise<string>

/** The real model, billed to the app owner (no authToken). */
export function claudeGenerate(env: DeepSpaceAIEnv): GenerateFn {
  const model = createDeepSpaceAI(env, 'anthropic')(QUIZ_MODEL)
  return async ({ system, prompt }) => {
    const { text } = await generateText({ model, system, prompt, maxRetries: 1, timeout: { totalMs: 60_000 } })
    return text
  }
}

export interface ShortAnswerTask {
  question: string
  expectedAnswer: string
  answer: string
  sourceText: string
  pageStart: number
  pageEnd: number
  sourcePage: number
}

export async function gradeShortAnswer(generate: GenerateFn, task: ShortAnswerTask, logTag = 'grade'): Promise<ShortGrade> {
  const system = gradeSystemPrompt(task.pageStart, task.pageEnd)
  const basePrompt = gradeUserPrompt(task.question, task.expectedAnswer, task.answer.trim(), task.sourceText)
  let prompt = basePrompt

  for (let attempt = 1; attempt <= 2; attempt++) {
    let text: string
    try {
      text = await generate({ system, prompt })
    } catch (err) {
      console.error(`[${logTag}] AI call failed (attempt ${attempt})`, err)
      continue
    }
    const parsed = parseGradeOutput(text, task.pageStart, task.pageEnd, task.sourcePage)
    if (parsed.ok) return parsed.grade
    console.warn(`[${logTag}] invalid output (attempt ${attempt}): ${parsed.error}`)
    prompt = `${basePrompt}\n\nYour previous reply was rejected: ${parsed.error}\nReply again with only the corrected JSON object.`
  }
  return { graded: false }
}
