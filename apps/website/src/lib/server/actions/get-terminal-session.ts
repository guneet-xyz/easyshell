"use server"

import { auth } from "@/lib/server/auth"
import { getTerminalSession as _getTerminalSession } from "@/lib/server/coordinator"
import { isKnownTestcase } from "@/lib/server/problems"

export async function getTerminalSession({
  problemId,
  testcaseId,
}: {
  problemId: number
  testcaseId: number
}) {
  const user = (await auth())?.user
  if (!user) return null
  if (!(await isKnownTestcase(problemId, testcaseId))) return null

  const session = await _getTerminalSession({
    userId: user.id,
    problemId,
    testcaseId,
  })
  return session
}
