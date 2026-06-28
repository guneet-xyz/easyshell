// ==========================================
// In-memory capacity service.
//
// Single source of truth for the runner's live capacity. Both the
// heartbeat loop (workers/heartbeat.ts) and the health.capacity tRPC
// procedure (router.ts) read from `getCapacity()`. Job-accept and
// job-finish paths mutate the counters via the increment/decrement
// helpers — never by touching the module-level state directly.
//
// Counters reset to 0 on process restart. The reconciliation /
// recovery workers re-derive truth from SQLite + docker inspect; they
// intentionally do not back-fill these in-memory counters.
// ==========================================

import { env } from "../env"

let submissionUsed = 0
let sessionUsed = 0

export function incrementSubmission(): void {
  submissionUsed++
}

export function decrementSubmission(): void {
  submissionUsed = Math.max(0, submissionUsed - 1)
}

export function incrementSession(): void {
  sessionUsed++
}

export function decrementSession(): void {
  sessionUsed = Math.max(0, sessionUsed - 1)
}

export interface CapacitySnapshot {
  session_used: number
  session_max: number
  submission_used: number
  submission_max: number
}

export function getCapacity(): CapacitySnapshot {
  return {
    session_used: sessionUsed,
    session_max: env.SESSION_MAX_CONCURRENCY,
    submission_used: submissionUsed,
    submission_max: env.SUBMISSION_MAX_CONCURRENCY,
  }
}
