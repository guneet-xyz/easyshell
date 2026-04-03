"use server"

import { submissions, submissionTestcaseQueue } from "@easyshell/db/schema"
import {
  isLiveEnvironmentProblem,
  isStandardProblem,
} from "@easyshell/problems/schema"

import { db } from "@/db"
import { auth } from "@/lib/server/auth"
import { getProblemInfo, getProblemSlugFromId } from "@/lib/server/problems"

const SENTINEL_TESTCASE_ID = 1

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

  // Create the submission record
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

  if (isLiveEnvironmentProblem(problem)) {
    // Live-environment: single queue entry with sentinel testcaseId=1.
    // The submission-manager will start a fresh k3s container, run the
    // input commands, execute check.sh, and store the result.
    await db.insert(submissionTestcaseQueue).values({
      submissionId: submissionId,
      testcaseId: SENTINEL_TESTCASE_ID,
      status: "pending",
    })
  } else if (isStandardProblem(problem)) {
    // Standard: one queue entry per testcase
    for (const testcase of problem.testcases) {
      await db.insert(submissionTestcaseQueue).values({
        submissionId: submissionId,
        testcaseId: testcase.id,
        status: "pending",
      })
    }
  } else {
    throw new Error("Unknown problem type")
  }

  return {
    submissionId: submissionId,
  }
}
