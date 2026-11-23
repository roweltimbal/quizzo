import type { ActionHandler } from 'deepspace/worker'
import type { Env } from '../../worker'
import { generateQuiz } from './generate-quiz'
import { gradeQuiz } from './grade-quiz'

export const actions: Record<string, ActionHandler<Env>> = {
  generateQuiz,
  gradeQuiz,
}
