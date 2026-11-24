import type { ActionHandler } from 'deepspace/worker'
import type { Env } from '../../worker'
import { generateQuiz } from './generate-quiz'
import { gradeQuiz } from './grade-quiz'
import { hostRoom } from './host-room'
import { joinRoom } from './join-room'

export const actions: Record<string, ActionHandler<Env>> = {
  generateQuiz,
  gradeQuiz,
  hostRoom,
  joinRoom,
}
