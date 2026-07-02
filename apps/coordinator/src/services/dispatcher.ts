// ==========================================
// dispatcher.ts — Picks a runner, decrypts its secret, builds a typed
// runner client, calls jobs.accept, and reconciles the outcome with the
// `execution_job` row.
//
// Flow per dispatch(jobId):
//   1. Load the execution_job row.
//   2. pickRunner(mode) — returns the runner with most spare capacity.
//      If null → mark job failed, revert the queue row to pending.
//   3. Decrypt the runner's secret, build a tRPC client.
//   4. Call runner.jobs.accept.
//   5. On accepted   → UPDATE execution_job SET runnerId, status=accepted.
//      On duplicate  → idempotent ACK (treat like accepted, no revert).
//      On at_capacity → revert queue row (so another tick picks again).
//      On thrown err → revert queue row, mark job failed.
//
// This is invoked from the queue-poller's processClaimedItem AFTER the
// execution_job row is inserted with the sentinel runnerId="unassigned".
// ==========================================

import { and, eq, sql } from "drizzle-orm"

import { executionJobs, submissionTestcaseQueue } from "@easyshell/db/schema"
import { createLogger } from "@easyshell/logger"

import { db } from "../db"
import {
  createRunnerClientFromCreds,
  type AcceptJobInput,
} from "./runner-client"
import { pickRunner } from "./runner-picker"
import { decryptSecret } from "./secret"

const log = createLogger("coordinator:dispatcher")

// ─── helpers ───────────────────────────────────────────────────────────────

async function revertQueueRow(
  submissionId: number,
  testcaseId: number,
  reason: string,
): Promise<void> {
  await db
    .update(submissionTestcaseQueue)
    .set({
      status: "pending",
      claimedAt: null,
      claimedBy: null,
      lastError: reason,
      // Roll back the optimistic attempts++ done by the queue-poller.
      attempts: sql`GREATEST(${submissionTestcaseQueue.attempts} - 1, 0)`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(submissionTestcaseQueue.submissionId, submissionId),
        eq(submissionTestcaseQueue.testcaseId, testcaseId),
      ),
    )
}

async function markJobFailed(jobId: string, message: string): Promise<void> {
  await db
    .update(executionJobs)
    .set({
      status: "failed",
      errorMessage: message,
      finishedAt: new Date(),
    })
    .where(eq(executionJobs.id, jobId))
}

// ─── entrypoint ────────────────────────────────────────────────────────────

/**
 * Dispatch a freshly-inserted `execution_job` to its runner.
 *
 * NEVER THROWS. All errors are reconciled internally (mark job failed,
 * revert the queue row to `pending`) so the queue-poller can safely
 * `await dispatch(...)` without risk of double-reverting.
 */
export async function dispatch(jobId: string): Promise<void> {
  try {
    await dispatchInner(jobId)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    log.error({ job_id: jobId, error: msg }, "dispatch.unhandled")
    try {
      await markJobFailed(jobId, msg)
    } catch (markErr: unknown) {
      log.error(
        {
          job_id: jobId,
          error: markErr instanceof Error ? markErr.message : String(markErr),
        },
        "dispatch.markFailed-failed",
      )
    }
  }
}

async function dispatchInner(jobId: string): Promise<void> {
  const row = await db
    .select()
    .from(executionJobs)
    .where(eq(executionJobs.id, jobId))
    .limit(1)
  const job = row[0]
  if (!job) {
    log.warn({ job_id: jobId }, "dispatch.job-not-found")
    return
  }

  const runner = await pickRunner(job.mode)
  if (!runner) {
    if (job.submissionId != null && job.testcaseId != null) {
      await revertQueueRow(
        job.submissionId,
        job.testcaseId,
        "no runner available",
      )
    }
    await markJobFailed(jobId, "no runner available")
    log.warn({ job_id: jobId, mode: job.mode }, "dispatch.no-runner")
    return
  }

  let secret: string
  try {
    secret = decryptSecret(runner.secretCiphertext, runner.secretNonce)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    if (job.submissionId != null && job.testcaseId != null) {
      await revertQueueRow(job.submissionId, job.testcaseId, `decrypt: ${msg}`)
    }
    await markJobFailed(jobId, `decrypt runner secret: ${msg}`)
    log.error(
      { job_id: jobId, runner_id: runner.id, error: msg },
      "dispatch.decrypt-failed",
    )
    return
  }

  const client = createRunnerClientFromCreds(
    runner.publicUrl,
    secret,
    runner.id,
  )

  // queue-poller stored the submission script in execution_job.result.input.
  const payload =
    job.result &&
    typeof job.result === "object" &&
    "input" in (job.result as Record<string, unknown>)
      ? ((job.result as Record<string, unknown>).input as string)
      : undefined

  const acceptInput: AcceptJobInput = {
    job_id: job.id,
    container_name: job.containerName,
    mode: job.mode,
    image: job.image,
    input: job.mode === "submission" ? payload : undefined,
    resource_limits: { memory: "10m", cpus: "0.1" },
  }

  try {
    const result = await client.jobs.accept.mutate(acceptInput)

    if (result.status === "duplicate") {
      await db
        .update(executionJobs)
        .set({
          runnerId: runner.id,
          status: "accepted",
          acceptedAt: new Date(),
        })
        .where(eq(executionJobs.id, jobId))
      log.info(
        { job_id: jobId, runner_id: runner.id },
        "dispatch.duplicate-ack",
      )
      return
    }

    if (result.status === "at_capacity") {
      if (job.submissionId != null && job.testcaseId != null) {
        await revertQueueRow(
          job.submissionId,
          job.testcaseId,
          "runner at capacity",
        )
      }
      await markJobFailed(jobId, "runner at capacity")
      log.warn({ job_id: jobId, runner_id: runner.id }, "dispatch.at-capacity")
      return
    }

    await db
      .update(executionJobs)
      .set({
        runnerId: runner.id,
        status: "accepted",
        acceptedAt: new Date(),
      })
      .where(eq(executionJobs.id, jobId))
    log.info({ job_id: jobId, runner_id: runner.id }, "dispatch.accepted")
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    if (job.submissionId != null && job.testcaseId != null) {
      await revertQueueRow(job.submissionId, job.testcaseId, msg)
    }
    await markJobFailed(jobId, msg)
    log.error(
      { job_id: jobId, runner_id: runner.id, error: msg },
      "dispatch.error",
    )
  }
}
