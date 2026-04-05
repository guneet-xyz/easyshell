"use server"

import { auth } from "@/lib/server/auth"
import { killTerminalSessions as _killTerminalSessions } from "@/lib/server/mustang"

export async function killTerminalSessions({
  problemId,
  testcaseId,
}: {
  problemId: number
  testcaseId: number
}) {
  const user = (await auth())?.user
  if (!user) return null

  return _killTerminalSessions({
    userId: user.id,
    problemId,
    testcaseId,
  })
}
