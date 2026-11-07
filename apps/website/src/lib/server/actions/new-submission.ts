"use server"

import { submissionTestcaseQueue, submissions } from "@easyshell/db/schema"

import { db } from "@/db"
import { getAuthSession } from "@/lib/server/auth"
import { getProblemInfo, isKnownProblem } from "@/lib/server/problems"

const MAX_INPUT_LENGTH = 10_000

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
  if (typeof input !== "string" || input.length > MAX_INPUT_LENGTH) return null

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
