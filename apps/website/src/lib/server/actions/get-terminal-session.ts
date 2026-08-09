"use server"

import { getAuthSession } from "@/lib/server/auth"
import { getTerminalSession as _getTerminalSession } from "@/lib/server/session-manager"

export async function getTerminalSession({
  problemId,
  testcaseId,
}: {
  problemId: string
  testcaseId: number
}) {
  const user = (await getAuthSession())?.user
  if (!user) return null

  const session = await _getTerminalSession({
    userId: user.id,
    problemId,
    testcaseId,
  })
  return session
}
