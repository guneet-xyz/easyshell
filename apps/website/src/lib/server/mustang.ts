// ============================================================================
// Mustang client — pre-configured for the website app.
// Wraps @easyshell/mustang with the website's db and env config.
// ============================================================================
import { createMustangClient } from "@easyshell/mustang/client"
import {
  checkSession as _checkSession,
  getSessionReadiness as _getSessionReadiness,
  getTerminalSession as _getTerminalSession,
  insertTerminalSessionLog as _insertTerminalSessionLog,
  killTerminalSessions as _killTerminalSessions,
  submitCommand as _submitCommand,
} from "@easyshell/mustang/sessions"

import { db } from "@/db"
import { env } from "@/env"
import { getProblemInfo, getProblemSlugFromId } from "@/lib/server/problems"

export const mustangClient = createMustangClient({
  baseUrl: env.MUSTANG_URL,
  token: env.MUSTANG_TOKEN,
})

export type { ExecResult, CheckSessionResponse } from "@easyshell/mustang"

// =============================================================================
// Pre-bound convenience functions (inject db + client automatically)
// =============================================================================

export async function getTerminalSession({
  userId,
  problemId,
  testcaseId,
}: {
  userId: string
  problemId: number
  testcaseId: number
}) {
  const problemSlug = await getProblemSlugFromId(problemId)
  if (!problemSlug) throw new Error("Problem not found")
  const problemInfo = await getProblemInfo(problemSlug)

  return _getTerminalSession({
    db,
    client: mustangClient,
    userId,
    problemId,
    testcaseId,
    problemSlug,
    problemInfo,
  })
}

export async function killTerminalSessions({
  userId,
  problemId,
  testcaseId,
}: {
  userId: string
  problemId: number
  testcaseId: number
}) {
  return _killTerminalSessions({
    db,
    client: mustangClient,
    userId,
    problemId,
    testcaseId,
  })
}

export async function submitCommand({
  sessionId,
  containerName,
  command,
  timeoutMs,
}: {
  sessionId: number
  containerName: string
  command: string
  timeoutMs?: number
}) {
  return _submitCommand({
    db,
    client: mustangClient,
    sessionId,
    containerName,
    command,
    timeoutMs,
  })
}

export async function checkSession(containerName: string) {
  return _checkSession({
    client: mustangClient,
    containerName,
  })
}

export async function insertTerminalSessionLog(params: {
  sessionId: number
  stdin: string
  stdout: string
  stderr: string
  startedAt: Date
  finishedAt: Date
}) {
  return _insertTerminalSessionLog(db, params)
}

export async function getSessionReadiness(containerName: string) {
  return _getSessionReadiness({
    client: mustangClient,
    containerName,
  })
}
