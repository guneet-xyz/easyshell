"use server"

import { terminalSessions } from "@easyshell/db/schema"

import { db } from "@/db"
import { getAuthSession } from "@/lib/server/auth"
import {
  insertTerminalSessionLog,
  sessionManagerExec,
} from "@/lib/server/session-manager"

import type { getTerminalSession } from "./get-terminal-session"

import { and, eq, isNull } from "drizzle-orm"

const MAX_COMMAND_LENGTH = 10_000

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
      | Awaited<ReturnType<typeof sessionManagerExec>>
      | {
          type: "not-authenticated"
        }
    ))
> {
  const user = (await getAuthSession())?.user
  if (!user) return { status: "error", type: "not-authenticated" }
  if (typeof command !== "string" || command.length > MAX_COMMAND_LENGTH) {
    throw new Error("Command too long")
  }

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

  const container_name = `easyshell-${terminalSession[0].problemId}-${terminalSession[0].testcaseId}-session-${sessionId}`

  const startedAt = new Date()
  const execResponse = await sessionManagerExec({
    containerName: container_name,
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
