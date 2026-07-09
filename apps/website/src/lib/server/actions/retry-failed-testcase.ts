"use server"

import { createCoordinatorClient } from "@easyshell/coordinator/client"

import { env } from "@/env"
import { auth } from "@/lib/server/auth"

export async function retryFailedTestcase({
  submissionId,
  testcaseId,
}: {
  submissionId: number
  testcaseId: number
}) {
  const user = (await auth())?.user
  if (!user) return null

  const client = createCoordinatorClient({
    url: env.COORDINATOR_URL,
    token: env.WEBSITE_TOKEN,
  })

  const result = await client.submissions.retryTestcase.mutate({
    acting_user_id: user.id,
    submission_id: submissionId,
    testcase_id: testcaseId,
  })

  if (result.status === "forbidden") throw new Error("forbidden")
  if (result.status === "not_found") throw new Error("submission not found")
  if (result.status === "not_failed")
    throw new Error("cannot retry: testcase is not in failed state")

  return result
}
