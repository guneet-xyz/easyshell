"use server"

import { and, count, eq, inArray } from "drizzle-orm"

import { submissions, submissionTestcaseQueue } from "@easyshell/db/schema"

import { db } from "@/db"
import { auth } from "@/lib/server/auth"
import {
  getProblemInfo,
  getProblemSlugFromId,
  isKnownProblem,
} from "@/lib/server/problems"

const MAX_INPUT_LENGTH = 10_000
/** Queued or running testcases one user may have at once. */
const MAX_PENDING_TESTCASES = 20

export async function newSubmission({
  problemId,
  input,
}: {
  problemId: number
  input: string
}) {
  const user = (await auth())?.user
  if (!user) return null
  if (!(await isKnownProblem(problemId))) return null
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

  const problemSlug = await getProblemSlugFromId(problemId)

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

  const problem = await getProblemInfo(problemSlug)
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
