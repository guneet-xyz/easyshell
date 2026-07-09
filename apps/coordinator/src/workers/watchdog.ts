// ==========================================
// watchdog.ts — coordinator-side periodic sweepers.
//
// 4 sweepers per the protocol contract:
//   1. markStaleRunners     — every 10s — flip runners with no heartbeat
//                            in 30s+ from "active" → "stale".
//   2. watchdogJobs         — every  5s — for in-flight jobs with no
//                            recent push/poll, query the runner with
//                            jobs.get and either reconcile or mark lost.
//   3. requeueLostJobs      — every 15s — scan for execution_job rows
//                            already marked "lost" whose queue rows did
//                            NOT make it back to "pending" (or "failed"
//                            if attempts exhausted). Defensive layer
//                            for crashes mid-markJobLost.
//   4. expireTerminalSessions — every 60s — soft-delete terminal_session
//                              rows past their expiresAt.
//
// All sweeper bodies are wrapped in try/catch at the setInterval call
// site so a single iteration's failure never tears down the loop.
// ==========================================

import { and, eq, inArray, isNull, lt, sql } from "drizzle-orm"

import {
  executionJobs,
  runners,
  submissionTestcaseQueue,
  submissionTestcases,
  terminalSessions,
} from "@easyshell/db/schema"
import { createLogger } from "@easyshell/logger"

import { db } from "../db"
import { env } from "../env"
import { createRunnerClientFromDb } from "../services/runner-client"

const log = createLogger("coordinator:watchdog")

const STALE_INTERVAL_MS = 10_000
const WATCHDOG_INTERVAL_MS = 5_000
const REQUEUE_INTERVAL_MS = 15_000
const TERMINAL_EXPIRY_INTERVAL_MS = 60_000

const RUNNER_STALE_AFTER_MS = 30_000
const JOB_STALE_AFTER_MS = 10_000
const JOB_BATCH_SIZE = 20
const TERMINAL_BATCH_SIZE = 20

// ─── 1. Runner staleness sweeper ────────────────────────────────────────────

export async function markStaleRunners(): Promise<void> {
  const cutoff = new Date(Date.now() - RUNNER_STALE_AFTER_MS)
  const result = await db
    .update(runners)
    .set({ status: "stale" })
    .where(and(eq(runners.status, "active"), lt(runners.lastSeenAt, cutoff)))
    .returning({ id: runners.id })
  if (result.length > 0) {
    log.warn(
      { count: result.length, runner_ids: result.map((r) => r.id) },
      "watchdog.runners-marked-stale",
    )
  }
}

// ─── 2. Job watchdog (poll runner for jobs without recent push) ─────────────

export async function watchdogJobs(): Promise<void> {
  const staleCutoff = new Date(Date.now() - JOB_STALE_AFTER_MS)
  const staleJobs = await db
    .select()
    .from(executionJobs)
    .where(
      and(
        inArray(executionJobs.status, [
          "dispatched",
          "accepted",
          "running",
        ] as const),
        lt(
          sql`GREATEST(COALESCE(${executionJobs.lastPushAt}, ${executionJobs.dispatchedAt}), COALESCE(${executionJobs.lastPollAt}, ${executionJobs.dispatchedAt}))`,
          staleCutoff,
        ),
      ),
    )
    .limit(JOB_BATCH_SIZE)

  for (const job of staleJobs) {
    try {
      const runner = await db
        .select({
          status: runners.status,
          revokedAt: runners.revokedAt,
        })
        .from(runners)
        .where(eq(runners.id, job.runnerId))
        .limit(1)
        .then((r) => r[0])

      if (
        !runner ||
        runner.status === "stale" ||
        runner.status === "deregistered"
      ) {
        await markJobLost(
          job.id,
          `runner ${job.runnerId} is ${runner?.status ?? "not found"}`,
        )
        continue
      }

      if (runner.revokedAt) {
        await markJobLost(job.id, `runner ${job.runnerId} is revoked`)
        continue
      }

      // Runner looks healthy — ask it directly.
      const client = await createRunnerClientFromDb(job.runnerId)
      const status = await client.jobs.get.query({ job_id: job.id })

      await db
        .update(executionJobs)
        .set({ lastPollAt: new Date() })
        .where(eq(executionJobs.id, job.id))

      if (status.status === "unknown") {
        await markJobLost(job.id, "runner reported unknown")
      } else if (
        status.status === "succeeded" ||
        status.status === "failed" ||
        status.status === "cancelled"
      ) {
        // The runner has terminal state but we never received the push.
        // The runner's push-retry loop will eventually retry; we just
        // record that we observed the discrepancy.
        log.info(
          { job_id: job.id, runner_status: status.status },
          "watchdog.runner-has-terminal-state",
        )
      }
    } catch (err: unknown) {
      log.warn(
        {
          job_id: job.id,
          error: err instanceof Error ? err.message : String(err),
        },
        "watchdog.poll-failed",
      )
    }
  }
}

async function markJobLost(jobId: string, reason: string): Promise<void> {
  const job = await db
    .select()
    .from(executionJobs)
    .where(eq(executionJobs.id, jobId))
    .limit(1)
    .then((r) => r[0])
  if (!job) return

  await db
    .update(executionJobs)
    .set({
      status: "lost",
      errorMessage: reason,
      finishedAt: new Date(),
    })
    .where(eq(executionJobs.id, jobId))

  if (job.submissionId == null || job.testcaseId == null) return

  await requeueOrFailQueueRow(job.submissionId, job.testcaseId, reason)
}

// ─── 3. Lost-job requeue sweeper (defensive: catch orphans) ─────────────────

export async function requeueLostJobs(): Promise<void> {
  // Any execution_job in "lost" whose queue row is still in "running" is
  // an orphan from a markJobLost that died mid-flight (e.g., process
  // crash after UPDATE execution_job but before UPDATE queue row).
  const orphans = await db
    .select({
      jobId: executionJobs.id,
      submissionId: executionJobs.submissionId,
      testcaseId: executionJobs.testcaseId,
      errorMessage: executionJobs.errorMessage,
    })
    .from(executionJobs)
    .innerJoin(
      submissionTestcaseQueue,
      and(
        eq(submissionTestcaseQueue.submissionId, executionJobs.submissionId),
        eq(submissionTestcaseQueue.testcaseId, executionJobs.testcaseId),
        eq(submissionTestcaseQueue.claimedBy, executionJobs.id),
      ),
    )
    .where(
      and(
        eq(executionJobs.status, "lost"),
        eq(submissionTestcaseQueue.status, "running"),
      ),
    )
    .limit(JOB_BATCH_SIZE)

  for (const orphan of orphans) {
    if (orphan.submissionId == null || orphan.testcaseId == null) continue
    try {
      await requeueOrFailQueueRow(
        orphan.submissionId,
        orphan.testcaseId,
        orphan.errorMessage ?? "lost — orphaned",
      )
      log.info({ job_id: orphan.jobId }, "watchdog.orphan-requeued")
    } catch (err: unknown) {
      log.error(
        {
          job_id: orphan.jobId,
          error: err instanceof Error ? err.message : String(err),
        },
        "watchdog.requeue-failed",
      )
    }
  }
}

async function requeueOrFailQueueRow(
  submissionId: number,
  testcaseId: number,
  reason: string,
): Promise<void> {
  const current = await db
    .select({ attempts: submissionTestcaseQueue.attempts })
    .from(submissionTestcaseQueue)
    .where(
      and(
        eq(submissionTestcaseQueue.submissionId, submissionId),
        eq(submissionTestcaseQueue.testcaseId, testcaseId),
      ),
    )
    .limit(1)
    .then((r) => r[0])
  const attempts = current?.attempts ?? 0

  if (attempts >= env.MAX_ATTEMPTS) {
    // Synthetic fail row so the user sees the failure in the submission.
    await db
      .insert(submissionTestcases)
      .values({
        submissionId,
        testcaseId,
        stdout: "",
        stderr: `coordinator: max attempts exceeded (${attempts}): ${reason}`,
        exitCode: -1,
        startedAt: new Date(),
        finishedAt: new Date(),
        passed: false,
      })
      .onConflictDoNothing()
    await db
      .update(submissionTestcaseQueue)
      .set({
        status: "failed",
        lastError: reason,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(submissionTestcaseQueue.submissionId, submissionId),
          eq(submissionTestcaseQueue.testcaseId, testcaseId),
        ),
      )
    log.warn(
      { submission_id: submissionId, testcase_id: testcaseId, attempts },
      "watchdog.max-attempts-synthetic-fail",
    )
  } else {
    await db
      .update(submissionTestcaseQueue)
      .set({
        status: "pending",
        claimedAt: null,
        claimedBy: null,
        lastError: reason,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(submissionTestcaseQueue.submissionId, submissionId),
          eq(submissionTestcaseQueue.testcaseId, testcaseId),
        ),
      )
    log.info(
      { submission_id: submissionId, testcase_id: testcaseId, attempts },
      "watchdog.queue-row-requeued",
    )
  }
}

// ─── 4. Terminal session expiry sweeper ─────────────────────────────────────

export async function expireTerminalSessions(): Promise<void> {
  const now = new Date()
  const expired = await db
    .select({ id: terminalSessions.id })
    .from(terminalSessions)
    .where(
      and(
        lt(terminalSessions.expiresAt, now),
        isNull(terminalSessions.deletedAt),
      ),
    )
    .limit(TERMINAL_BATCH_SIZE)

  for (const s of expired) {
    await db
      .update(terminalSessions)
      .set({ deletedAt: now })
      .where(eq(terminalSessions.id, s.id))
    log.info({ terminal_session_id: s.id }, "watchdog.terminal-session-expired")
  }
}

// ─── boot ────────────────────────────────────────────────────────────────────

function runSafely(name: string, fn: () => Promise<void>): () => void {
  return () => {
    fn().catch((err: unknown) => {
      log.error(
        {
          sweeper: name,
          error: err instanceof Error ? err.message : String(err),
        },
        "watchdog.sweeper-error",
      )
    })
  }
}

export function startWatchdog(): void {
  setInterval(runSafely("staleness", markStaleRunners), STALE_INTERVAL_MS)
  setInterval(runSafely("watchdog-jobs", watchdogJobs), WATCHDOG_INTERVAL_MS)
  setInterval(runSafely("requeue-lost", requeueLostJobs), REQUEUE_INTERVAL_MS)
  setInterval(
    runSafely("terminal-expiry", expireTerminalSessions),
    TERMINAL_EXPIRY_INTERVAL_MS,
  )
  log.info(
    {
      staleness_ms: STALE_INTERVAL_MS,
      watchdog_ms: WATCHDOG_INTERVAL_MS,
      requeue_ms: REQUEUE_INTERVAL_MS,
      terminal_expiry_ms: TERMINAL_EXPIRY_INTERVAL_MS,
    },
    "watchdog.started",
  )
}
