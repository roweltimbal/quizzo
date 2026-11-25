import type { ActionHandler } from 'deepspace/worker'
import type { Env } from '../../worker'
import { advanceRoom } from './advance-room'
import { generateQuiz } from './generate-quiz'
import { gradeQuiz } from './grade-quiz'
import { hostRoom } from './host-room'
import { joinRoom } from './join-room'
import { submitAnswer } from './submit-answer'

export const actions: Record<string, ActionHandler<Env>> = {
  advanceRoom,
  generateQuiz,
  gradeQuiz,
  hostRoom,
  joinRoom,
  submitAnswer,
}
