"use server"

import { createCoordinatorClient } from "@easyshell/coordinator/client"

import { env } from "@/env"
import { auth } from "@/lib/server/auth"
import {
  countPendingTestcases,
  MAX_PENDING_TESTCASES,
} from "@/lib/server/user-limits"

export async function retryAllFailedTestcases({
  submissionId,
}: {
  submissionId: number
}) {
  const user = (await auth())?.user
  if (!user) return null
  // Retries requeue testcases, so they respect the same per-user cap.
  if ((await countPendingTestcases(user.id)) >= MAX_PENDING_TESTCASES)
    return null

  const client = createCoordinatorClient({
    url: env.COORDINATOR_URL,
    token: env.WEBSITE_TOKEN,
  })

  const result = await client.submissions.retryAllFailedForSubmission.mutate({
    acting_user_id: user.id,
    submission_id: submissionId,
  })

  if (result.status === "forbidden") throw new Error("forbidden")
  if (result.status === "not_found") throw new Error("submission not found")

  return result
}
