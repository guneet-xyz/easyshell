"use server"

import { auth } from "@/lib/server/auth"
import { getTerminalSession as _getTerminalSession } from "@/lib/server/session-manager"

export async function getTerminalSession({
  problemId,
  testcaseId,
}: {
  problemId: number
  testcaseId: number
}) {
  const user = (await auth())?.user
  if (!user) return null

  const session = await _getTerminalSession({
    userId: user.id,
    problemId,
    testcaseId,
  })
  return session
}
