"use server"

import { and, eq, isNull } from "drizzle-orm"

import { terminalSessions } from "@easyshell/db/schema"

import { db } from "@/db"
import { auth } from "@/lib/server/auth"

export async function killTerminalSessions({
  problemId,
  testcaseId,
}: {
  problemId: number
  testcaseId: number
}) {
  const user = (await auth())?.user
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
