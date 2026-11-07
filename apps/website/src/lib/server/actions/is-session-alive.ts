"use server"

import { terminalSessions } from "@easyshell/db/schema"

import { db } from "@/db"
import { getAuthSession } from "@/lib/server/auth"

import { and, eq } from "drizzle-orm"

export async function isSessionAlive(sessionId: number) {
  const userId = (await getAuthSession())?.user.id
  if (!userId) return false

  const session = await db
    .select()
    .from(terminalSessions)
    .where(
      and(
        eq(terminalSessions.id, sessionId),
        eq(terminalSessions.userId, userId),
      ),
    )

  if (!session[0]) {
    return false
  }

  if (session[0].deletedAt) {
    return false
  }

  return true
}
