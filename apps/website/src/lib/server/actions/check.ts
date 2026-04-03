"use server"

import { and, desc, eq } from "drizzle-orm"

import { checkResults } from "@easyshell/db/schema"
import { isLiveEnvironmentProblem } from "@easyshell/problems/schema"

import { db } from "@/db"
import { auth } from "@/lib/server/auth"
import { getProblemInfo, getProblemSlugFromId } from "@/lib/server/problems"
import {
  sessionManagerCheck,
  type CheckResult,
} from "@/lib/server/session-manager"

export async function runCheck({
  problemId,
  sessionId,
  containerName,
}: {
  problemId: number
  sessionId: number
  containerName: string
}): Promise<
  | { status: "success"; checkResult: CheckResult; checkId: number }
  | { status: "error"; message: string }
> {
  const user = (await auth())?.user
  if (!user) return { status: "error", message: "Not authenticated" }

  // Verify this is a live-environment problem
  const problemSlug = await getProblemSlugFromId(problemId)
  const problem = await getProblemInfo(problemSlug)
  if (!isLiveEnvironmentProblem(problem)) {
    return {
      status: "error",
      message: "Check is only available for live-environment problems",
    }
  }

  // Run the check via session manager
  const result = await sessionManagerCheck(containerName)
  if (result.status === "error") {
    return { status: "error", message: result.message }
  }

  // Store the result in the database
  const inserted = await db
    .insert(checkResults)
    .values({
      userId: user.id,
      problemId: problemId,
      sessionId: sessionId,
      score: result.result.score,
      total: result.result.total,
      passed: result.result.passed,
      output: result.result.raw_output,
    })
    .returning({ id: checkResults.id })

  if (!inserted[0]) {
    return { status: "error", message: "Failed to store check result" }
  }

  return {
    status: "success",
    checkResult: result.result,
    checkId: inserted[0].id,
  }
}

export async function getCheckResults({
  problemId,
}: {
  problemId: number
}): Promise<
  Array<{
    id: number
    score: number
    total: number
    passed: boolean
    output: string
    createdAt: Date
  }>
> {
  const user = (await auth())?.user
  if (!user) return []

  const results = await db
    .select({
      id: checkResults.id,
      score: checkResults.score,
      total: checkResults.total,
      passed: checkResults.passed,
      output: checkResults.output,
      createdAt: checkResults.createdAt,
    })
    .from(checkResults)
    .where(
      and(
        eq(checkResults.userId, user.id),
        eq(checkResults.problemId, problemId),
      ),
    )
    .orderBy(desc(checkResults.createdAt))

  return results
}

export async function getLatestCheckResult({
  problemId,
}: {
  problemId: number
}): Promise<{
  id: number
  score: number
  total: number
  passed: boolean
  output: string
  createdAt: Date
} | null> {
  const results = await getCheckResults({ problemId })
  return results[0] ?? null
}

export async function hasPassedCheck({
  problemId,
}: {
  problemId: number
}): Promise<boolean> {
  const user = (await auth())?.user
  if (!user) return false

  const result = await db
    .select({ id: checkResults.id })
    .from(checkResults)
    .where(
      and(
        eq(checkResults.userId, user.id),
        eq(checkResults.problemId, problemId),
        eq(checkResults.passed, true),
      ),
    )
    .limit(1)

  return result.length > 0
}
