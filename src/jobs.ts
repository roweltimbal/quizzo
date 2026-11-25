/**
 * Background-job handler — invoked by AppJobRoom (worker.ts) for every
 * job picked up from the queue. Dispatch on `job.type` and return a
 * result (captured as `job.result`) or throw to fail (retried up to
 * `maxAttempts`, then permanently marked failed).
 *
 * Use this for any work that needs to outlive the HTTP response:
 *   - AI generation that exceeds Cloudflare's 30-second waitUntil window
 *   - Export / render pipelines
 *   - Bulk imports, fan-out side effects
 *
 * Enqueue from a client with the `useJobs(roomId)` hook, or from
 * worker-side code (an HTTP route, an action, a cron task) with
 * `enqueueJob(env.JOB_ROOMS, \`app:${env.DEEPSPACE_APP_ID}\`, type, payload)`.
 *
 * Long-running progress / checkpoint guidance:
 *   - `ctx.progress(0..1, msg?)` publishes a real-time update over the
 *     room's WebSocket so subscribers see progress without polling.
 *   - `ctx.continue(state, { afterMs })` yields and resumes on the next
 *     alarm with `job.resumeFrom = state` — use this for work that
 *     exceeds the 15-minute per-alarm wall-time ceiling.
 *   - `ctx.signal` is an AbortSignal that fires when a client cancels;
 *     forward it to `fetch` and check `.aborted` at loop suspension
 *     points.
 *
 * Example:
 *
 *   export async function runJob(job: Job, ctx: JobContext, env: Env) {
 *     switch (job.type) {
 *       case 'ai-summarize': {
 *         const { text } = job.payload as { text: string }
 *         ctx.progress(0.1, 'starting')
 *         const summary = await summarize(text, { signal: ctx.signal })
 *         return { summary }
 *       }
 *       default:
 *         throw new Error(`Unknown job type: ${job.type}`)
 *     }
 *   }
 */

import type { Job, JobContext } from 'deepspace/worker'
import type { Env } from '../worker'
import { GRADE_ROOM_JOB } from './actions/advance-room'
import { gradeRoomShortAnswers } from './actions/room-shared'
import { claudeGenerate } from './lib/grade-short-answer'
import { createActionTools } from './server/action-routes'

/**
 * Jobs in this app:
 *
 * - `grade-room-short-answers` { roomId }: queued by advanceRoom when a live
 *   room reaches results. Grades each ungraded short answer with the AI and
 *   refreshes the leaderboard after each (src/actions/room-shared.ts).
 *   Retried up to 3 times; graded rows are skipped, so a retry never pays
 *   twice. Safe to run more than once, and does nothing unless the room is
 *   at results, so a client queueing it by hand can't grade early.
 */
export async function runJob(job: Job, _ctx: JobContext, env: Env): Promise<unknown> {
  switch (job.type) {
    case GRADE_ROOM_JOB: {
      const roomId = (job.payload as { roomId?: unknown } | null)?.roomId
      if (typeof roomId !== 'string' || !roomId) throw new Error('roomId is required')
      // Record access as the app (RBAC off), like a server action. No caller
      // token: this job calls no user-billed integration.
      const tools = createActionTools(env, env.OWNER_USER_ID, '')
      const graded = await gradeRoomShortAnswers(tools, roomId, claudeGenerate(env))
      return { graded }
    }
    default:
      throw new Error(`Unknown job type: ${job.type}`)
  }
}
