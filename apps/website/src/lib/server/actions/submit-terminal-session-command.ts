"use server"

import { and, eq, isNull } from "drizzle-orm"

import { terminalSessions } from "@easyshell/db/schema"

import { db } from "@/db"
import { auth } from "@/lib/server/auth"
import {
  coordinatorExec,
  insertTerminalSessionLog,
} from "@/lib/server/coordinator"

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
      | Awaited<ReturnType<typeof coordinatorExec>>
      | {
          type: "not-authenticated"
        }
    ))
> {
  const user = (await auth())?.user
  if (!user) return { status: "error", type: "not-authenticated" }

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

  const startedAt = new Date()
  const execResponse = await coordinatorExec({
    sessionId: terminalSession[0].id,
    command,
  })
  const finishedAt = new Date()

  if (execResponse.status === "error") {
    return execResponse
  }

  const { stdout, stderr } = execResponse

  const logId = await insertTerminalSessionLog({
    sessionId,
    stdin: command,
    stdout,
    stderr,
    startedAt,
    finishedAt,
  })

  return {
    status: "success",
    log: { id: logId, stdin: command, stdout, stderr, startedAt, finishedAt },
  }
}
