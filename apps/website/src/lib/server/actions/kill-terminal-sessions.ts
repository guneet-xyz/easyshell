"use server"

import { terminalSessions } from "@easyshell/db/schema"

import { db } from "@/db"
import { getAuthSession } from "@/lib/server/auth"
import { isKnownTestcase } from "@/lib/server/problems"
import { sessionManagerKill } from "@/lib/server/session-manager"

import { and, eq, isNull } from "drizzle-orm"

export async function killTerminalSessions({
  problemId,
  testcaseId,
}: {
  problemId: string
  testcaseId: number
}) {
  const user = (await getAuthSession())?.user
  if (!user) return null
  if (!isKnownTestcase(problemId, testcaseId)) return null

  const updated = await db
    .update(terminalSessions)
    .set({
      deletedAt: new Date(),
    })
    .where(
      and(
        eq(terminalSessions.userId, user.id),
        eq(terminalSessions.problemId, problemId),
        eq(terminalSessions.testcaseId, testcaseId),
        isNull(terminalSessions.deletedAt),
      ),
    )
    .returning({ id: terminalSessions.id })

  // Stop the containers too; the session-manager also reaps expired ones.
  await Promise.allSettled(
    updated.map(({ id }) =>
      sessionManagerKill(`easyshell-${problemId}-${testcaseId}-session-${id}`),
    ),
  )

  return {
    deletedSessions: updated.length,
  }
}
