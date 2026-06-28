"use server"

import { and, eq, isNull } from "drizzle-orm"

import { createCoordinatorClient } from "@easyshell/coordinator/client"
import { terminalSessions } from "@easyshell/db/schema"

import { db } from "@/db"
import { env } from "@/env"
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

  // Kill the actual containers via Coordinator (non-blocking — DB cleanup is authoritative)
  if (updated.length > 0) {
    const client = createCoordinatorClient({
      url: env.COORDINATOR_URL,
      token: env.COORDINATOR_TOKEN,
    })
    await Promise.allSettled(
      updated.map((s) =>
        client.terminalSessions.kill.mutate({ terminal_session_id: s.id }),
      ),
    )
  }

  return {
    deletedSessions: updated.length,
  }
}
