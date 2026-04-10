// ============================================================================
// Mustang client — pre-configured for the website app.
// Uses the higher-level client methods (no direct DB ops or sessions.ts imports).
// ============================================================================
import { createMustangClient } from "@easyshell/mustang/client"
import { isLiveEnvironmentProblem } from "@easyshell/problems/schema"

import { env } from "@/env"
import { getProblemInfo, getProblemSlugFromId } from "@/lib/server/problems"

export const mustangClient = createMustangClient({
  baseUrl: env.MUSTANG_URL,
  token: env.MUSTANG_TOKEN,
})

export type { CheckSessionResponse } from "@easyshell/mustang/client"

// =============================================================================
// Pre-bound convenience functions
// =============================================================================

/**
 * Get or create a terminal session. Maps the service's snake_case response
 * back to camelCase for the frontend.
 */
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

  const result = await mustangClient.getOrCreateTerminalSession({
    userId,
    problemId,
    testcaseId,
    problemSlug,
    problemType: isLiveEnvironmentProblem(problemInfo) ? "k3s" : "standard",
  })

  return {
    id: result.id,
    containerName: result.container_name,
    createdAt: new Date(result.created_at),
    expiresAt: new Date(result.expires_at),
    deletedAt: null as Date | null,
    ready: result.ready,
    logs: result.logs.map((l) => ({
      id: l.id,
      stdin: l.stdin,
      stdout: l.stdout,
      stderr: l.stderr,
      startedAt: new Date(l.started_at),
      finishedAt: new Date(l.finished_at),
    })),
  }
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
  const result = await mustangClient.killTerminalSessions({
    userId,
    problemId,
    testcaseId,
  })
  return { deletedSessions: result.deleted_sessions }
}

/**
 * Submit a command to a terminal session.
 * Maps the service's snake_case response to the ExecResult shape
 * that the frontend expects.
 */
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
}): Promise<
  | {
      status: "success"
      stdout: string
      stderr: string
      logId: number
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
  const result = await mustangClient.submitTerminalCommand({
    sessionId,
    containerName,
    command,
    timeoutMs,
  })

  if (result.status === "error") {
    return result
  }

  return {
    status: "success",
    stdout: result.stdout,
    stderr: result.stderr,
    logId: result.log_id,
  }
}

export async function checkSession(containerName: string) {
  try {
    const result = await mustangClient.checkSession(containerName)
    return { status: "success" as const, result }
  } catch (e) {
    return {
      status: "error" as const,
      message: e instanceof Error ? e.message : String(e),
    }
  }
}

export async function getSessionReadiness(containerName: string) {
  return mustangClient.getSessionReady(containerName)
}
