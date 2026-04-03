// ================================================================
// Internal Functions to interact with the terminal session manager
// ================================================================
import { and, asc, eq, isNull } from "drizzle-orm"
import { z } from "zod"

import { terminalSessionLogs, terminalSessions } from "@easyshell/db/schema"
import { isLiveEnvironmentProblem } from "@easyshell/problems/schema"

import { db } from "@/db"
import { env } from "@/env"
import { getProblemInfo, getProblemSlugFromId } from "@/lib/server/problems"
import {
  HTTP_STATUS_INTERNAL_SERVER_ERROR,
  HTTP_STATUS_LOCKED,
} from "@/lib/utils"

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

  const problemInfo = await getProblemInfo(problemSlug)

  if (isLiveEnvironmentProblem(problemInfo)) {
    // K3s container with higher resource limits
    await sessionManagerCreate({
      image: `easyshell-${problemSlug}-${testcaseId}`,
      container_name: `easyshell-${problemSlug}-${testcaseId}-session-${sessionId}`,
      memory: "1g",
      cpu: "1.0",
      privileged: true,
      cgroupns: "private",
      tmpfs: ["/run", "/var/run"],
      command: ["-mode", "k3s-session"],
    })
  } else {
    // Standard container (existing behavior)
    await sessionManagerCreate({
      image: `easyshell-${problemSlug}-${testcaseId}`,
      container_name: `easyshell-${problemSlug}-${testcaseId}-session-${sessionId}`,
    })
  }
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

const SessionManagerExecResponseSchema = z.object({
  stdout: z.string(),
  stderr: z.string(),
})

export async function sessionManagerExec({
  containerName,
  command,
  timeoutMs = 5000,
}: {
  containerName: string
  command: string
  timeoutMs?: number
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
  const isSessionRunning = await sessionManagerIsRunning(containerName)
  if (!isSessionRunning)
    return {
      status: "error",
      type: "session_not_running",
      message: "The session is not running",
    }

  let resp: Response
  try {
    resp = await fetch(`${env.SESSION_MANAGER_URL}/exec`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.SESSION_MANAGER_TOKEN}`,
      },
      body: JSON.stringify({
        container_name: containerName,
        command,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (e) {
    if (e instanceof Error && e.name === "TimeoutError")
      return {
        status: "error",
        type: "took_too_long",
        message: "The command took too long to execute",
      }
    if (e instanceof Error && e.name === "TypeError")
      return {
        status: "error",
        type: "critical_server_error",
        message: "Request Failed (session manager might be down)",
      }

    return {
      status: "error",
      type: "critical_server_error",
      message: "Request Failed",
    }
  }

  let json: unknown
  try {
    json = await resp.json()
  } catch {
    return {
      status: "error",
      type: "critical_server_error",
      message: "Failed to parse response from session manager",
    }
  }

  if (resp.status === HTTP_STATUS_LOCKED)
    return {
      status: "error",
      type: "session_error",
      message: "The session is locked because it is running another command",
    }

  if (resp.status === HTTP_STATUS_INTERNAL_SERVER_ERROR)
    return {
      status: "error",
      type: "session_error",
      message: "The session encountered an error",
    }

  const parsing_result = SessionManagerExecResponseSchema.safeParse(json)

  if (!parsing_result.success)
    return {
      status: "error",
      type: "critical_server_error",
      message: "Failed to parse response from session manager",
    }

  const data = parsing_result.data

  return {
    status: "success",
    stdout: data.stdout,
    stderr: data.stderr,
  }
}

const SessionManagerIsRunningResponseSchema = z.object({
  is_running: z.boolean(),
})

export async function sessionManagerIsRunning(containerName: string) {
  const resp = await fetch(`${env.SESSION_MANAGER_URL}/is-running`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.SESSION_MANAGER_TOKEN}`,
    },
    body: JSON.stringify({
      container_name: containerName,
    }),
  })
  if (!resp.ok) {
    throw new Error(await resp.text())
  }
  const resp_body = SessionManagerIsRunningResponseSchema.parse(
    await resp.json(),
  )
  return resp_body.is_running
}

export async function sessionManagerCreate(args: {
  container_name: string
  image: string
  memory?: string
  cpu?: string
  privileged?: boolean
  cgroupns?: string
  tmpfs?: string[]
  command?: string[]
}) {
  const resp = await fetch(`${env.SESSION_MANAGER_URL}/create`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.SESSION_MANAGER_TOKEN}`,
    },
    body: JSON.stringify(args),
  })
  if (!resp.ok) {
    throw new Error(await resp.text())
  }
}

export async function sessionManagerKill(containerName: string) {
  const resp = await fetch(`${env.SESSION_MANAGER_URL}/kill`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.SESSION_MANAGER_TOKEN}`,
    },
    body: JSON.stringify({
      container_name: containerName,
    }),
  })
  if (!resp.ok) {
    throw new Error(await resp.text())
  }
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

// ========================== Check (live-environment) ==========================

const SessionManagerCheckResponseSchema = z.object({
  score: z.number(),
  total: z.number(),
  percentage: z.number(),
  passed: z.boolean(),
  raw_output: z.string(),
})

export type CheckResult = z.infer<typeof SessionManagerCheckResponseSchema>

export async function sessionManagerCheck(
  containerName: string,
): Promise<
  | { status: "success"; result: CheckResult }
  | { status: "error"; message: string }
> {
  let resp: Response
  try {
    resp = await fetch(`${env.SESSION_MANAGER_URL}/check`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.SESSION_MANAGER_TOKEN}`,
      },
      body: JSON.stringify({
        container_name: containerName,
      }),
      signal: AbortSignal.timeout(30000), // 30s timeout for kubectl operations
    })
  } catch (e) {
    if (e instanceof Error && e.name === "TimeoutError")
      return {
        status: "error",
        message: "The check took too long to execute",
      }
    return {
      status: "error",
      message: "Request failed (session manager might be down)",
    }
  }

  if (!resp.ok) {
    return {
      status: "error",
      message: `Check failed: ${await resp.text()}`,
    }
  }

  let json: unknown
  try {
    json = await resp.json()
  } catch {
    return {
      status: "error",
      message: "Failed to parse check response",
    }
  }

  const parseResult = SessionManagerCheckResponseSchema.safeParse(json)
  if (!parseResult.success) {
    return {
      status: "error",
      message: "Invalid check response format",
    }
  }

  return {
    status: "success",
    result: parseResult.data,
  }
}
