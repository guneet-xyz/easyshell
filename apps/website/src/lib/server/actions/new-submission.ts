"use server"

import { submissions, submissionTestcaseQueue } from "@easyshell/db/schema"

import { auth } from "@/lib/server/auth"
import {
  getProblemInfo,
  getProblemSlugFromId,
  isKnownProblem,
} from "@/lib/server/problems"
import {
  countPendingTestcases,
  MAX_PENDING_TESTCASES,
  withUserLock,
} from "@/lib/server/user-limits"

const MAX_INPUT_LENGTH = 10_000

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

  const problem = await getProblemInfo(await getProblemSlugFromId(problemId))

  const submissionId = await withUserLock(user.id, "queue", async (tx) => {
    // The new submission's testcases count toward the cap too.
    const pending = await countPendingTestcases(user.id, tx)
    if (pending + problem.testcases.length > MAX_PENDING_TESTCASES) return null

    const id = (
      await tx
        .insert(submissions)
        .values({ problemId: problemId, userId: user.id, input: input })
        .returning({ id: submissions.id })
    )[0]?.id
    if (!id) throw new Error("Failed to create submission")

    await tx.insert(submissionTestcaseQueue).values(
      problem.testcases.map((testcase) => ({
        submissionId: id,
        testcaseId: testcase.id,
        status: "pending" as const,
      })),
    )
    return id
  })

  if (!submissionId) return null
  return { submissionId }
}
