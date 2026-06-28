import { initTRPC, TRPCError } from "@trpc/server"

import {
  submissionTestcaseQueue,
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

const notImplemented = (): never => {
  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "not implemented",
  })
}

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

  // ── T16 will implement the following procedures. ─────────────────────
  retryTestcase: websiteProcedure
    .input(RetryTestcaseInputSchema)
    .output(RetryTestcaseOutputSchema)
    .mutation(() => notImplemented()),

  retryAllFailedForSubmission: websiteProcedure
    .input(RetryAllFailedInputSchema)
    .output(RetryAllFailedOutputSchema)
    .mutation(() => notImplemented()),

  getStatus: websiteProcedure
    .input(GetStatusInputSchema)
    .output(GetStatusOutputSchema)
    .query(() => notImplemented()),
})
