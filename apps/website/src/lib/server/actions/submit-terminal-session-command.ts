"use server"

import { and, eq, isNull } from "drizzle-orm"

import { terminalSessions } from "@easyshell/db/schema"

import { db } from "@/db"
import { auth } from "@/lib/server/auth"
import { submitCommand } from "@/lib/server/mustang"

import type { getTerminalSession } from "./get-terminal-session"

export async function submitTerminalSessionCommand({
  sessionId,
  command,
}: {
  sessionId: number
  command: string
}): Promise<
  | {
      status: "success"
      log: Exclude<
        Awaited<ReturnType<typeof getTerminalSession>>,
        null
      >["logs"][0]
    }
  | ({
      status: "error"
    } & (
      | {
          type:
            | "took_too_long"
            | "session_not_running"
            | "session_error"
            | "critical_server_error"
          message: string
        }
      | {
          type: "not-authenticated"
        }
    ))
> {
  const user = (await auth())?.user
  if (!user) return { status: "error", type: "not-authenticated" }

  // Ownership check: verify the session belongs to this user
  const terminalSession = await db
    .select()
    .from(terminalSessions)
    .where(
      and(
        eq(terminalSessions.id, sessionId),
        eq(terminalSessions.userId, user.id),
        isNull(terminalSessions.deletedAt),
      ),
    )
    .limit(1)
  if (!terminalSession[0]) {
    throw new Error("Session not found")
  }

  const containerName = terminalSession[0].containerName
  if (!containerName) {
    throw new Error("Session has no container name (legacy session)")
  }

  const startedAt = new Date()
  const result = await submitCommand({
    sessionId,
    containerName,
    command,
  })
  const finishedAt = new Date()

  if (result.status === "error") {
    return result
  }

  return {
    status: "success",
    log: {
      id: result.logId,
      stdin: command,
      stdout: result.stdout,
      stderr: result.stderr,
      startedAt,
      finishedAt,
    },
  }
}
