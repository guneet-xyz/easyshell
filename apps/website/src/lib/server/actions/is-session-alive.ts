"use server"

import { eq } from "drizzle-orm"

import { terminalSessions } from "@easyshell/db/schema"

import { db } from "@/db"

export async function isSessionAlive(sessionId: number) {
  const session = await db
    .select()
    .from(terminalSessions)
    .where(eq(terminalSessions.id, sessionId))

  if (!session[0]) {
    return false
  }

  if (session[0].deletedAt) {
    return false
  }

  return true
}
