"use server"

import { and, eq, isNull } from "drizzle-orm"

import { terminalSessions } from "@easyshell/db/schema"

import { db } from "@/db"
import { auth } from "@/lib/server/auth"
import { getProblemSlugFromId } from "@/lib/server/problems"
import { sessionManagerKill } from "@/lib/server/session-manager"

export async function killTerminalSessions({
  problemId,
  testcaseId,
}: {
  problemId: number
  testcaseId: number
}) {
  const user = (await auth())?.user
  if (!user) return null

  const problemSlug = await getProblemSlugFromId(problemId)

  // Find active sessions before marking them deleted
  const activeSessions = await db
    .select({ id: terminalSessions.id })
    .from(terminalSessions)
    .where(
      and(
        eq(terminalSessions.userId, user.id),
        eq(terminalSessions.problemId, problemId),
        eq(terminalSessions.testcaseId, testcaseId),
        isNull(terminalSessions.deletedAt),
      ),
    )

  // Mark sessions as deleted in DB
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

  // Kill the actual Docker containers
  for (const session of activeSessions) {
    const containerName = `easyshell-${problemSlug}-${testcaseId}-session-${session.id}`
    try {
      await sessionManagerKill(containerName)
    } catch {
      // Container may already be stopped -- ignore errors
    }
  }

  return {
    deletedSessions: updated.length,
  }
}
