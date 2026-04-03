"use server"

// Need these for the update query
import { and, eq } from "drizzle-orm"

import {
  submissions,
  submissionTestcaseQueue,
  submissionTestcases,
} from "@easyshell/db/schema"
import {
  isLiveEnvironmentProblem,
  isStandardProblem,
} from "@easyshell/problems/schema"

import { db } from "@/db"
import { auth } from "@/lib/server/auth"
import { getProblemInfo, getProblemSlugFromId } from "@/lib/server/problems"
import {
  getActiveTerminalSession,
  sessionManagerCheck,
  sessionManagerExec,
} from "@/lib/server/session-manager"

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

  if (isLiveEnvironmentProblem(problem)) {
    return await newLiveEnvironmentSubmission({
      problemId,
      problemSlug,
      userId: user.id,
      input,
    })
  }

  if (!isStandardProblem(problem)) {
    throw new Error("Unknown problem type")
  }

  // Standard problem submission flow
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

async function newLiveEnvironmentSubmission({
  problemId,
  problemSlug,
  userId,
  input,
}: {
  problemId: number
  problemSlug: string
  userId: string
  input: string
}): Promise<{ submissionId: number } | null> {
  // Get the active terminal session for this user/problem
  const session = await getActiveTerminalSession({
    userId,
    problemId,
    testcaseId: SENTINEL_TESTCASE_ID,
  })

  if (!session) {
    throw new Error(
      "No active Kubernetes environment found. Open the Terminal tab first.",
    )
  }

  const containerName = `easyshell-${problemSlug}-${SENTINEL_TESTCASE_ID}-session-${session.id}`

  // Create the submission record
  const submissionId = (
    await db
      .insert(submissions)
      .values({
        problemId,
        userId,
        input,
      })
      .returning({ id: submissions.id })
  )[0]?.id

  if (!submissionId) {
    throw new Error("Failed to create submission")
  }

  // Insert queue entry as "running"
  await db.insert(submissionTestcaseQueue).values({
    submissionId,
    testcaseId: SENTINEL_TESTCASE_ID,
    status: "running",
  })

  try {
    // Run the user's input commands in the k3s container
    if (input.trim().length > 0) {
      const execResult = await sessionManagerExec({
        containerName,
        command: input,
        timeoutMs: 60000, // 60s for kubectl operations
      })

      if (execResult.status === "error") {
        // Store failed submission
        await storeSubmissionResult({
          submissionId,
          stdout: `Command execution failed: ${execResult.message}`,
          stderr: "",
          passed: false,
        })
        return { submissionId }
      }
    }

    // Run check.sh to validate
    const checkResult = await sessionManagerCheck(containerName)

    if (checkResult.status === "error") {
      await storeSubmissionResult({
        submissionId,
        stdout: `Check failed: ${checkResult.message}`,
        stderr: "",
        passed: false,
      })
      return { submissionId }
    }

    // Store successful check result
    const isPassed = checkResult.result.passed
    await storeSubmissionResult({
      submissionId,
      stdout: checkResult.result.raw_output,
      stderr: "",
      passed: isPassed,
    })
  } catch (error) {
    // Store error as failed submission
    const message = error instanceof Error ? error.message : String(error)
    await storeSubmissionResult({
      submissionId,
      stdout: `Error: ${message}`,
      stderr: "",
      passed: false,
    })
  }

  return { submissionId }
}

async function storeSubmissionResult({
  submissionId,
  stdout,
  stderr,
  passed,
}: {
  submissionId: number
  stdout: string
  stderr: string
  passed: boolean
}) {
  const now = new Date()

  await db.insert(submissionTestcases).values({
    submissionId,
    testcaseId: SENTINEL_TESTCASE_ID,
    stdout,
    stderr,
    exitCode: passed ? 0 : 1,
    startedAt: now,
    finishedAt: now,
    passed,
  })

  // Update queue status to finished
  await db
    .update(submissionTestcaseQueue)
    .set({ status: "finished" })
    .where(
      and(
        eq(submissionTestcaseQueue.submissionId, submissionId),
        eq(submissionTestcaseQueue.testcaseId, SENTINEL_TESTCASE_ID),
      ),
    )
}
