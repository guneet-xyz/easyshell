// DEPRECATED
// TODO: Remove this file
import { and, desc, eq, sql } from "drizzle-orm"

import {
  accounts,
  bookmarks,
  submissions,
  submissionTestcaseQueue,
  submissionTestcases,
} from "@easyshell/db/schema"

import { db } from "@/db"
import { getProblemSlugFromId } from "@/lib/server/problems"

export async function getUserSubmissions({
  problemId,
  userId,
}: {
  problemId: number
  userId: string
}) {
  const past_submissions = await Promise.all(
    (
      await db
        .select({
          id: submissions.id,
          submittedAt: submissions.submittedAt,
        })
        .from(submissions)
        .where(
          and(
            eq(submissions.problemId, problemId),
            eq(submissions.userId, userId),
          ),
        )
        .orderBy(desc(submissions.submittedAt))
    ).map(async (submission) => {
      const testcases = await db
        .select({
          id: submissionTestcaseQueue.testcaseId,
          status: submissionTestcaseQueue.status,
          passed: submissionTestcases.passed,
        })
        .from(submissionTestcaseQueue)
        .leftJoin(
          submissionTestcases,
          and(
            eq(
              submissionTestcaseQueue.submissionId,
              submissionTestcases.submissionId,
            ),
            eq(
              submissionTestcaseQueue.testcaseId,
              submissionTestcases.testcaseId,
            ),
          ),
        )
        .where(eq(submissionTestcaseQueue.submissionId, submission.id))

      const running = testcases.some((testcase) => testcase.passed === null)
      const passed =
        testcases.length > 0 &&
        !running &&
        testcases.every((testcase) => testcase.passed)

      const resp = {
        ...submission,
        status: running
          ? ("running" as const)
          : passed
            ? ("passed" as const)
            : ("failed" as const),
      }

      return resp
    }),
  )

  return past_submissions
}

export async function isProblemBookmarked({
  problemId,
  userId,
}: {
  problemId: number
  userId: string
}) {
  const result = await db
    .select()
    .from(bookmarks)
    .where(
      and(eq(bookmarks.problemId, problemId), eq(bookmarks.userId, userId)),
    )
    .limit(1)
  return result.length > 0
}

export async function getUserProviders(userId: string) {
  const results = await db
    .select({
      provider: accounts.provider,
    })
    .from(accounts)
    .where(eq(accounts.userId, userId))

  const providers = {
    github: results.some((result) => result.provider === "github"),
    discord: results.some((result) => result.provider === "discord"),
    google: results.some((result) => result.provider === "google"),
  }

  return providers
}

export async function getUserSubmissionStats(
  userId: string,
): Promise<{ problems: Record<string, "solved" | "attempted"> }> {
  const user_submissions = db.$with("user_submissions").as(
    db
      .select({
        submissionId: submissions.id,
      })
      .from(submissions)
      .where(eq(submissions.userId, userId)),
  )

  const user_submission_testcases = db.$with("user_submission_testcases").as(
    db
      .with(user_submissions)
      .select({
        submissionId: user_submissions.submissionId,
        testcaseId: submissionTestcases.testcaseId,
        passed: submissionTestcases.passed,
      })
      .from(user_submissions)
      .innerJoin(
        submissionTestcases,
        eq(user_submissions.submissionId, submissionTestcases.submissionId),
      ),
  )

  const user_submission_passed = db.$with("user_submission_passed").as(
    db
      .with(user_submission_testcases)
      .select({
        submissionId: user_submission_testcases.submissionId,
        passed:
          sql<boolean>`cast(bool_and(${user_submission_testcases.passed}) as boolean)`.as(
            "passed",
          ),
      })
      .from(user_submission_testcases)
      .groupBy(user_submission_testcases.submissionId),
  )

  const user_problem_passed = db.$with("user_problem_passed").as(
    db
      .with(user_submission_passed)
      .select({
        problemId: submissions.problemId,
        passed:
          sql<boolean>`cast(bool_or(${user_submission_passed.passed}) as boolean)`.as(
            "passed",
          ),
      })
      .from(submissions)
      .innerJoin(
        user_submission_passed,
        eq(submissions.id, user_submission_passed.submissionId),
      )
      .groupBy(submissions.problemId),
  )

  const result = await db
    .with(user_problem_passed)
    .select()
    .from(user_problem_passed)

  const result_map: Record<string, "solved" | "attempted"> = {}
  for (const { problemId, passed } of result) {
    const slug = await getProblemSlugFromId(problemId)
    result_map[slug] = passed ? "solved" : "attempted"
  }

  return {
    problems: result_map,
  }
}
