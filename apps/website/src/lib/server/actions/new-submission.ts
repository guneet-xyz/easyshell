"use server"

import { submissions, submissionTestcaseQueue } from "@easyshell/db/schema"
import { isStandardProblem } from "@easyshell/problems/schema"

import { db } from "@/db"
import { auth } from "@/lib/server/auth"
import { getProblemInfo, getProblemSlugFromId } from "@/lib/server/problems"

export async function newSubmission({
  problemId,
  input,
}: {
  problemId: number
  input: string
}) {
  const user = (await auth())?.user
  if (!user) return null

  const problemSlug = await getProblemSlugFromId(problemId)
  const problem = await getProblemInfo(problemSlug)

  if (!isStandardProblem(problem)) {
    throw new Error(
      "Submissions are not supported for live-environment problems. Use the Check button instead.",
    )
  }

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
