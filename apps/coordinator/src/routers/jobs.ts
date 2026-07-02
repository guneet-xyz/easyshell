// ==========================================
// routers/jobs.ts — runner → coordinator push surface
//
// Procedures (all auth'd as a registered runner via x-runner-id + secret):
//
//   reportResult   — terminal-status push. For submissions, runs the
//                    passed-check, writes submission_testcase, flips the
//                    queue row to finished/failed, marks execution_job
//                    succeeded/failed/cancelled. Idempotent on the
//                    execution_job side: subsequent calls for an already-
//                    terminal job no-op with `acked: true`.
//
//   reportProgress — non-terminal status push (accepted/starting/running).
//                    Bumps lastPushAt and best-effort updates status if
//                    the job is still in flight.
// ==========================================

import { initTRPC, TRPCError } from "@trpc/server"
import { and, eq, inArray } from "drizzle-orm"

import {
  executionJobs,
  submissions,
  submissionTestcaseQueue,
  submissionTestcases,
} from "@easyshell/db/schema"
import { createLogger } from "@easyshell/logger"

import { type Context } from "../context"
import { db } from "../db"
import { env } from "../env"
import { computePassed } from "../grading/passed-check"
import {
  ReportProgressInputSchema,
  ReportProgressOutputSchema,
  ReportResultInputSchema,
  ReportResultOutputSchema,
} from "../schemas"
import { getProblemInfo, getProblemSlugFromId } from "../services/problems"

const log = createLogger("coordinator:jobs")

const t = initTRPC.context<Context>().create()
const router = t.router

const runnerProcedure = t.procedure.use(({ ctx, next }) => {
  if (ctx.actor !== "runner" || !ctx.runnerId) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Runner credentials required",
    })
  }
  return next({ ctx: { ...ctx, runnerId: ctx.runnerId } })
})

const IN_FLIGHT_STATUSES = ["dispatched", "accepted", "running"] as const

// ─── shared helpers ────────────────────────────────────────────────────────

async function fetchAttempts(
  submissionId: number,
  testcaseId: number,
): Promise<number> {
  const row = await db
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
  return row?.attempts ?? 0
}

async function writeSyntheticFail(
  submissionId: number,
  testcaseId: number,
  message: string,
): Promise<void> {
  const now = new Date()
  await db
    .insert(submissionTestcases)
    .values({
      submissionId,
      testcaseId,
      stdout: "",
      stderr: message,
      exitCode: -1,
      startedAt: now,
      finishedAt: now,
      passed: false,
    })
    .onConflictDoNothing()
}

// ─── router ────────────────────────────────────────────────────────────────

export const jobsRouter = router({
  reportResult: runnerProcedure
    .input(ReportResultInputSchema)
    .output(ReportResultOutputSchema)
    .mutation(async ({ input }) => {
      const job = await db
        .select()
        .from(executionJobs)
        .where(eq(executionJobs.id, input.job_id))
        .limit(1)
        .then((r) => r[0])

      if (!job) {
        log.warn({ job_id: input.job_id }, "reportResult.job-not-found")
        return { acked: true as const }
      }

      // Idempotency: a terminal job is a no-op.
      if (!(IN_FLIGHT_STATUSES as readonly string[]).includes(job.status)) {
        log.info(
          { job_id: input.job_id, current_status: job.status },
          "reportResult.idempotent-skip",
        )
        return { acked: true as const }
      }

      const outcome = input.outcome

      if (outcome.status === "succeeded") {
        if (
          job.mode === "submission" &&
          job.submissionId != null &&
          job.testcaseId != null
        ) {
          const submissionRow = await db
            .select({ problemId: submissions.problemId })
            .from(submissions)
            .where(eq(submissions.id, job.submissionId))
            .limit(1)
            .then((r) => r[0])

          let passed = false
          if (submissionRow) {
            const problemSlug = await getProblemSlugFromId(
              submissionRow.problemId,
            )
            const problem = await getProblemInfo(problemSlug)
            const testcase = problem.testcases.find(
              (tc) => tc.id === job.testcaseId,
            )
            if (testcase) {
              passed = computePassed(
                {
                  stdout: outcome.stdout,
                  stderr: outcome.stderr,
                  exit_code: outcome.exit_code,
                  fs: outcome.fs,
                },
                {
                  expected_stdout: testcase.expected_stdout,
                  expected_stderr: testcase.expected_stderr,
                  expected_exit_code: testcase.expected_exit_code,
                  expected_fs: testcase.expected_fs,
                },
              )
            }
          }

          await db
            .insert(submissionTestcases)
            .values({
              submissionId: job.submissionId,
              testcaseId: job.testcaseId,
              stdout: outcome.stdout,
              stderr: outcome.stderr,
              exitCode: outcome.exit_code,
              fs: outcome.fs,
              startedAt: new Date(outcome.started_at),
              finishedAt: new Date(outcome.finished_at),
              passed,
            })
            .onConflictDoNothing()

          await db
            .update(submissionTestcaseQueue)
            .set({ status: "finished", updatedAt: new Date() })
            .where(
              and(
                eq(submissionTestcaseQueue.submissionId, job.submissionId),
                eq(submissionTestcaseQueue.testcaseId, job.testcaseId),
              ),
            )

          log.info(
            {
              job_id: input.job_id,
              submission_id: job.submissionId,
              testcase_id: job.testcaseId,
              passed,
            },
            "reportResult.succeeded",
          )
        }

        await db
          .update(executionJobs)
          .set({
            status: "succeeded",
            result: outcome,
            lastPushAt: new Date(),
            finishedAt: new Date(outcome.finished_at),
          })
          .where(eq(executionJobs.id, input.job_id))
      } else if (outcome.status === "failed") {
        if (job.submissionId != null && job.testcaseId != null) {
          const attempts = await fetchAttempts(job.submissionId, job.testcaseId)

          if (attempts >= env.MAX_ATTEMPTS) {
            await writeSyntheticFail(
              job.submissionId,
              job.testcaseId,
              `coordinator: max attempts exceeded (${attempts}): ${outcome.error}`,
            )
            await db
              .update(submissionTestcaseQueue)
              .set({
                status: "failed",
                lastError: outcome.error,
                updatedAt: new Date(),
              })
              .where(
                and(
                  eq(submissionTestcaseQueue.submissionId, job.submissionId),
                  eq(submissionTestcaseQueue.testcaseId, job.testcaseId),
                ),
              )
            log.warn(
              {
                job_id: input.job_id,
                submission_id: job.submissionId,
                testcase_id: job.testcaseId,
                attempts,
              },
              "reportResult.failed.max-attempts",
            )
          } else {
            await db
              .update(submissionTestcaseQueue)
              .set({
                status: "pending",
                claimedAt: null,
                claimedBy: null,
                lastError: outcome.error,
                updatedAt: new Date(),
              })
              .where(
                and(
                  eq(submissionTestcaseQueue.submissionId, job.submissionId),
                  eq(submissionTestcaseQueue.testcaseId, job.testcaseId),
                ),
              )
            log.info(
              {
                job_id: input.job_id,
                submission_id: job.submissionId,
                testcase_id: job.testcaseId,
                attempts,
              },
              "reportResult.failed.requeued",
            )
          }
        }

        await db
          .update(executionJobs)
          .set({
            status: "failed",
            errorMessage: outcome.error,
            lastPushAt: new Date(),
            finishedAt: new Date(),
          })
          .where(eq(executionJobs.id, input.job_id))
      } else {
        // cancelled
        await db
          .update(executionJobs)
          .set({
            status: "cancelled",
            lastPushAt: new Date(),
            finishedAt: new Date(),
          })
          .where(eq(executionJobs.id, input.job_id))
        log.info({ job_id: input.job_id }, "reportResult.cancelled")
      }

      return { acked: true as const }
    }),

  reportProgress: runnerProcedure
    .input(ReportProgressInputSchema)
    .output(ReportProgressOutputSchema)
    .mutation(async ({ input }) => {
      const statusMap = {
        accepted: "accepted",
        starting: "running",
        running: "running",
      } as const
      await db
        .update(executionJobs)
        .set({
          status: statusMap[input.state],
          lastPushAt: new Date(),
        })
        .where(
          and(
            eq(executionJobs.id, input.job_id),
            inArray(executionJobs.status, IN_FLIGHT_STATUSES),
          ),
        )
      return { acked: true as const }
    }),
})
