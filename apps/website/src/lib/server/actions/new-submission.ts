"use server"

import { submissionTestcaseQueue, submissions } from "@easyshell/db/schema"

import { db } from "@/db"
import { getAuthSession } from "@/lib/server/auth"
import { getProblemInfo, isKnownProblem } from "@/lib/server/problems"

import { and, count, eq, inArray } from "drizzle-orm"

const MAX_INPUT_LENGTH = 10_000
/** Queued or running testcases one user may have at once. */
const MAX_PENDING_TESTCASES = 20

export async function newSubmission({
  problemId,
  input,
}: {
  problemId: string
  input: string
}) {
  const user = (await getAuthSession())?.user
  if (!user) return null
  if (!isKnownProblem(problemId)) return null
  if (
    typeof input !== "string" ||
    input.trim() === "" ||
    input.length > MAX_INPUT_LENGTH
  )
    return null

  const pending = (
    await db
      .select({ pending: count() })
      .from(submissionTestcaseQueue)
      .innerJoin(
        submissions,
        eq(submissions.id, submissionTestcaseQueue.submissionId),
      )
      .where(
        and(
          eq(submissions.userId, user.id),
          inArray(submissionTestcaseQueue.status, ["pending", "running"]),
        ),
      )
  )[0]!.pending
  if (pending >= MAX_PENDING_TESTCASES) return null

  const submissionId = (
    await db
      .insert(submissions)
      .values({
        problemId: problemId,
        userId: user.id,
        input: input,
      })
      .returning({ id: submissions.id })
  )[0]?.id

  if (!submissionId) {
    throw new Error("Failed to create submission")
  }

  const problem = await getProblemInfo(problemId)
  // TODO: parallelize this
  for (const testcase of problem.testcases) {
    await db.insert(submissionTestcaseQueue).values({
      submissionId: submissionId,
      testcaseId: testcase.id,
      status: "pending",
    })
  }

  return {
    submissionId: submissionId,
  }
}
