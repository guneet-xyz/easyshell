"use server"

import {
  submissionTestcaseQueue,
  submissionTestcases,
  submissions,
} from "@easyshell/db/schema"

import { db } from "@/db"
import { getAuthSession } from "@/lib/server/auth"

import { and, count, eq, lte } from "drizzle-orm"

export async function getSubmissionInfo({
  submissionId,
}: {
  submissionId: number
}) {
  const submission = (
    await db
      .select()
      .from(submissions)
      .where(eq(submissions.id, submissionId))
      .limit(1)
  )[0]

  // Submissions (including their input) are private to their author.
  const userId = (await getAuthSession())?.user.id
  if (!submission || submission.userId !== userId)
    throw new Error("Submission not found")

  const attempt_number = (
    await db
      .select({
        attempt: count(),
      })
      .from(submissions)
      .where(
        and(
          eq(submissions.userId, submission.userId),
          eq(submissions.problemId, submission.problemId),
          lte(submissions.id, submission.id),
        ),
      )
  )[0]!.attempt

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
        eq(submissionTestcaseQueue.testcaseId, submissionTestcases.testcaseId),
        eq(
          submissionTestcaseQueue.submissionId,
          submissionTestcases.submissionId,
        ),
      ),
    )
    .where(eq(submissionTestcaseQueue.submissionId, submission.id))

  return {
    submission: {
      ...submission,
      attempt: attempt_number,
    },
    testcases,
  }
}
