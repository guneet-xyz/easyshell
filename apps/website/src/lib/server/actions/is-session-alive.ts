"use server"

import { and, eq } from "drizzle-orm"

import { terminalSessions } from "@easyshell/db/schema"

import { db } from "@/db"
import { auth } from "@/lib/server/auth"

export async function isSessionAlive(sessionId: number) {
  const userId = (await auth())?.user.id
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
