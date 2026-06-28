import { initTRPC, TRPCError } from "@trpc/server"
import { and, eq } from "drizzle-orm"

import {
  submissionTestcaseQueue,
  submissionTestcases,
  submissions,
} from "@easyshell/db/schema"
import { createLogger } from "@easyshell/logger"

import { type Context } from "../context"
import { db } from "../db"
import {
  EnqueueSubmissionInputSchema,
  EnqueueSubmissionOutputSchema,
  GetStatusInputSchema,
  GetStatusOutputSchema,
  RetryAllFailedInputSchema,
  RetryAllFailedOutputSchema,
  RetryTestcaseInputSchema,
  RetryTestcaseOutputSchema,
} from "../schemas"
import { getProblemInfo, getProblemSlugFromId } from "../services/problems"

const log = createLogger("coordinator:submissions")

const t = initTRPC.context<Context>().create()
const router = t.router
const procedure = t.procedure

// Website token check — only the website may enqueue or query submissions.
const websiteProcedure = procedure.use(({ ctx, next }) => {
  if (ctx.actor !== "website") {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Website token required",
    })
  }
  return next({ ctx })
})

export const submissionsRouter = router({
  /**
   * Coordinator-side port of `website/.../new-submission.ts:9-49`.
   *
   * Inserts a `submissions` row, then one `submission_testcase_queue` row
   * per testcase. The website will call this in Wave 6 (T23); for now it
   * exists so the queue-poller has rows to claim during local manual
   * smoke tests.
   */
  enqueue: websiteProcedure
    .input(EnqueueSubmissionInputSchema)
    .output(EnqueueSubmissionOutputSchema)
    .mutation(async ({ input }) => {
      const problemSlug = await getProblemSlugFromId(input.problem_id)
      const problem = await getProblemInfo(problemSlug)

      const inserted = (
        await db
          .insert(submissions)
          .values({
            userId: input.user_id,
            problemId: input.problem_id,
            input: input.input,
          })
          .returning({ id: submissions.id })
      )[0]

      if (!inserted) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create submission",
        })
      }

      // Match the original sequential insert in `new-submission.ts` — the
      // testcase count per problem is bounded and small, so parallelism
      // is not worth the added failure-mode complexity here.
      for (const testcase of problem.testcases) {
        await db.insert(submissionTestcaseQueue).values({
          submissionId: inserted.id,
          testcaseId: testcase.id,
          status: "pending",
        })
      }

      log.info(
        {
          submission_id: inserted.id,
          problem_id: input.problem_id,
          testcase_count: problem.testcases.length,
        },
        "submission.enqueued",
      )

      return {
        submission_id: inserted.id,
        testcase_count: problem.testcases.length,
      }
    }),

  retryTestcase: websiteProcedure
    .input(RetryTestcaseInputSchema)
    .output(RetryTestcaseOutputSchema)
    .mutation(async ({ input }) => {
      const submission = await db
        .select({ userId: submissions.userId })
        .from(submissions)
        .where(eq(submissions.id, input.submission_id))
        .limit(1)
        .then((r) => r[0])

      if (!submission) return { status: "not_found" }
      if (submission.userId !== input.acting_user_id) {
        return { status: "forbidden" }
      }

      const row = await db
        .select({
          status: submissionTestcaseQueue.status,
          lastError: submissionTestcaseQueue.lastError,
        })
        .from(submissionTestcaseQueue)
        .where(
          and(
            eq(submissionTestcaseQueue.submissionId, input.submission_id),
            eq(submissionTestcaseQueue.testcaseId, input.testcase_id),
          ),
        )
        .limit(1)
        .then((r) => r[0])

      if (!row) return { status: "not_found" }
      if (row.status !== "failed") return { status: "not_failed" }

      await db
        .update(submissionTestcaseQueue)
        .set({
          status: "pending",
          attempts: 0,
          lastError: null,
          claimedAt: null,
          claimedBy: null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(submissionTestcaseQueue.submissionId, input.submission_id),
            eq(submissionTestcaseQueue.testcaseId, input.testcase_id),
          ),
        )

      log.info(
        {
          submission_id: input.submission_id,
          testcase_id: input.testcase_id,
          acting_user_id: input.acting_user_id,
          previous_last_error: row.lastError,
        },
        "submission.retry.triggered",
      )

      return { status: "queued" }
    }),

  retryAllFailedForSubmission: websiteProcedure
    .input(RetryAllFailedInputSchema)
    .output(RetryAllFailedOutputSchema)
    .mutation(async ({ input }) => {
      const submission = await db
        .select({ userId: submissions.userId })
        .from(submissions)
        .where(eq(submissions.id, input.submission_id))
        .limit(1)
        .then((r) => r[0])

      if (!submission) return { status: "not_found" }
      if (submission.userId !== input.acting_user_id) {
        return { status: "forbidden" }
      }

      const updated = await db
        .update(submissionTestcaseQueue)
        .set({
          status: "pending",
          attempts: 0,
          lastError: null,
          claimedAt: null,
          claimedBy: null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(submissionTestcaseQueue.submissionId, input.submission_id),
            eq(submissionTestcaseQueue.status, "failed"),
          ),
        )
        .returning({ testcaseId: submissionTestcaseQueue.testcaseId })

      log.info(
        {
          submission_id: input.submission_id,
          acting_user_id: input.acting_user_id,
          requeued_count: updated.length,
        },
        "submission.retry-all.triggered",
      )

      return { status: "queued", requeued_count: updated.length }
    }),

  getStatus: websiteProcedure
    .input(GetStatusInputSchema)
    .output(GetStatusOutputSchema)
    .query(async ({ input }) => {
      const rows = await db
        .select({
          testcaseId: submissionTestcaseQueue.testcaseId,
          status: submissionTestcaseQueue.status,
          attempts: submissionTestcaseQueue.attempts,
          lastError: submissionTestcaseQueue.lastError,
        })
        .from(submissionTestcaseQueue)
        .where(eq(submissionTestcaseQueue.submissionId, input.submission_id))

      const testcaseResults = await db
        .select({
          testcaseId: submissionTestcases.testcaseId,
          passed: submissionTestcases.passed,
        })
        .from(submissionTestcases)
        .where(eq(submissionTestcases.submissionId, input.submission_id))

      const passedMap = new Map(
        testcaseResults.map((r) => [r.testcaseId, r.passed] as const),
      )

      return {
        submission_id: input.submission_id,
        testcases: rows.map((r) => ({
          testcase_id: r.testcaseId,
          status: r.status,
          attempts: r.attempts,
          last_error: r.lastError,
          passed: passedMap.get(r.testcaseId) ?? null,
        })),
      }
    }),
})
