// ================================================================
// Internal Functions to interact with the terminal session manager
// ================================================================
import { and, asc, eq, isNull } from "drizzle-orm"

import { terminalSessionLogs, terminalSessions } from "@easyshell/db/schema"
import { createSessionManagerClient } from "@easyshell/session-manager-client"

import { db } from "@/db"
import { env } from "@/env"
import { getProblemSlugFromId } from "@/lib/server/problems"

const _smClient = createSessionManagerClient({
  url: env.SESSION_MANAGER_URL,
  token: env.SESSION_MANAGER_TOKEN,
})

export async function runTerminalSession({
  problemId,
  testcaseId,
  sessionId,
}: {
  problemId: string
  testcaseId: string
  sessionId: number
}) {
  const problemSlug = await getProblemSlugFromId(parseInt(problemId))
  if (!problemSlug) throw new Error("Problem not found")

  await sessionManagerCreate({
    image: `easyshell-${problemSlug}-${testcaseId}`,
    container_name: `easyshell-${problemSlug}-${testcaseId}-session-${sessionId}`,
  })
}

export async function getTerminalSession({
  userId,
  problemId,
  testcaseId,
}: {
  userId: string
  problemId: number
  testcaseId: number
}) {
  let session = await getActiveTerminalSession({
    userId,
    problemId,
    testcaseId,
  })
  if (!session) {
    await createTerminalSession({ userId, problemId, testcaseId })
    session = await getActiveTerminalSession({ userId, problemId, testcaseId })
  }

  if (!session) throw new Error("Failed to create terminal session")

  const logs = await getTerminalSessionLogs(session.id)

  return {
    id: session.id,
    createdAt: session.createdAt,
    expiresAt: session.expiresAt,
    deletedAt: session.deletedAt,
    logs: logs,
  }
}

export async function createTerminalSession({
  userId,
  problemId,
  testcaseId,
}: {
  userId: string
  problemId: number
  testcaseId: number
}) {
  const sessionId = await insertTerminalSession({
    userId: userId,
    problemId: problemId,
    testcaseId: testcaseId,
  })

  await runTerminalSession({
    problemId: problemId.toString(),
    testcaseId: testcaseId.toString(),
    sessionId: sessionId,
  })
}

export async function getActiveTerminalSession({
  userId,
  problemId,
  testcaseId,
}: {
  userId: string
  problemId: number
  testcaseId: number
}) {
  const problemSlug = await getProblemSlugFromId(problemId)

  const session = await db
    .select()
    .from(terminalSessions)
    .where(
      and(
        eq(terminalSessions.userId, userId),
        eq(terminalSessions.problemId, problemId),
        eq(terminalSessions.testcaseId, testcaseId),
        isNull(terminalSessions.deletedAt),
      ),
    )
    .limit(1)

  if (!session[0]) return null

  const container_name = `easyshell-${problemSlug}-${testcaseId}-session-${session[0].id}`
  const isRunning = await sessionManagerIsRunning(container_name)

  if (isRunning) return session[0]
  await db
    .update(terminalSessions)
    .set({ deletedAt: new Date() })
    .where(eq(terminalSessions.id, session[0].id))

  return null
}

export async function getTerminalSessionLogs(sessionId: number) {
  let logs = await db
    .select({
      id: terminalSessionLogs.id,
      stdin: terminalSessionLogs.stdin,
      stdout: terminalSessionLogs.stdout,
      stderr: terminalSessionLogs.stderr,
      startedAt: terminalSessionLogs.startedAt,
      finishedAt: terminalSessionLogs.finishedAt,
    })
    .from(terminalSessionLogs)
    .where(eq(terminalSessionLogs.sessionId, sessionId))
    .orderBy(asc(terminalSessionLogs.id))

  logs = logs.map((log) => ({
    ...log,
    stdout: Buffer.from(log.stdout, "latin1").toString("utf-8"),
    stderr: Buffer.from(log.stderr, "latin1").toString("utf-8"),
  }))
  return logs
}

export async function insertTerminalSession({
  problemId,
  userId,
  testcaseId,
}: {
  userId: string
  problemId: number
  testcaseId: number
}) {
  const inserted = await db
    .insert(terminalSessions)
    .values({
      userId: userId,
      problemId: problemId,
      testcaseId: testcaseId,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60),
    })
    .returning({ id: terminalSessions.id })
  if (!inserted[0]) {
    throw new Error("Failed to insert terminal session")
  }
  return inserted[0].id
}

export async function sessionManagerExec({
  containerName,
  command,
}: {
  containerName: string
  command: string
}): Promise<
  | {
      status: "success"
      stdout: string
      stderr: string
    }
  | {
      status: "error"
      type:
        | "took_too_long"
        | "session_not_running"
        | "session_error"
        | "critical_server_error"
      message: string
    }
> {
  return _smClient.exec({ containerName, command })
}

export async function sessionManagerIsRunning(containerName: string) {
  return _smClient.isRunning(containerName)
}

export async function sessionManagerCreate(args: {
  container_name: string
  image: string
}) {
  return _smClient.create(args)
}

export async function sessionManagerKill(containerName: string) {
  return _smClient.kill(containerName)
}

export async function insertTerminalSessionLog({
  sessionId,
  stdin,
  stdout,
  stderr,
  startedAt,
  finishedAt,
}: {
  sessionId: number
  stdin: string
  stdout: string
  stderr: string
  startedAt: Date
  finishedAt: Date
}) {
  const log = await db
    .insert(terminalSessionLogs)
    .values({
      sessionId: sessionId,
      stdin: stdin,
      stdout: stdout,
      stderr: stderr,
      startedAt: startedAt,
      finishedAt: finishedAt,
    })
    .returning({ id: terminalSessionLogs.id })
  if (!log[0]) {
    throw new Error("Failed to insert terminal session log")
  }
  return log[0].id
}
