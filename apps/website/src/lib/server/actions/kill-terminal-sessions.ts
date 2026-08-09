"use server"

import { terminalSessions } from "@easyshell/db/schema"

import { db } from "@/db"
import { getAuthSession } from "@/lib/server/auth"

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

  return {
    deletedSessions: updated.length,
  }
}
