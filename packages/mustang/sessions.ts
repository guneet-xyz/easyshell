// ============================================================================
// Mustang Sessions — high-level session management combining API + DB ops.
// All functions accept `db` and `client` via dependency injection.
// ============================================================================
import { and, asc, eq, isNull } from "drizzle-orm"

import { terminalSessionLogs, terminalSessions } from "@easyshell/db/schema"
import {
  isLiveEnvironmentProblem,
  type ProblemInfo,
} from "@easyshell/problems/schema"
import { sleep } from "@easyshell/utils"

import type { CheckSessionResponse, ExecResult, MustangClient } from "./client"

// The DB type accepted by all functions. This is the return type of drizzle().
// Using a generic to avoid coupling to a specific drizzle instance.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any

const log = (...args: unknown[]) => console.log("[mustang:sessions]", ...args)
const logError = (...args: unknown[]) =>
  console.error("[mustang:sessions]", ...args)

// =============================================================================
// Terminal Session Lifecycle
// =============================================================================

/**
 * Create and start a terminal session container.
 * For k3s problems, the container is created but readiness is NOT polled here —
 * the caller (client UI) should poll via getSessionReadiness().
 * Returns the container name.
 */
export async function runTerminalSession({
  db,
  client,
  problemSlug,
  problemInfo,
  testcaseId,
  sessionId,
}: {
  db: Db
  client: MustangClient
  problemSlug: string
  problemInfo: ProblemInfo
  testcaseId: number
  sessionId: number
}): Promise<string> {
  if (isLiveEnvironmentProblem(problemInfo)) {
    log(
      `runTerminalSession: creating k3s session (problem=${problemSlug}, testcase=${testcaseId}, session=${sessionId})`,
    )

    // Try to claim a warm container first (k3s containers have long startup times)
    const claimed = await tryClaimWarmContainer({
      client,
      problemSlug,
      testcaseId,
    })

    if (claimed) {
      await db
        .update(terminalSessions)
        .set({ containerName: claimed })
        .where(eq(terminalSessions.id, sessionId))

      log(`claimed warm k3s container ${claimed} for session ${sessionId}`)

      return claimed
    }

    // No warm container available — create on-demand
    // K3s container with higher resource limits
    const { container_name: containerName } = await client.createSession({
      image: `easyshell-${problemSlug}-${testcaseId}`,
      problem: problemSlug,
      testcase: testcaseId,
      mode: "session",
      type: "k3s",
      memory: "1g",
      cpu: "1.0",
      privileged: true,
      cgroupns: "private",
      tmpfs: ["/run", "/var/run"],
      command: ["-mode", "k3s-session"],
    })

    // Store the container name in the DB
    await db
      .update(terminalSessions)
      .set({ containerName })
      .where(eq(terminalSessions.id, sessionId))

    log(
      `k3s container ${containerName} created for session ${sessionId} (readiness polling deferred to client)`,
    )

    return containerName
  } else {
    log(
      `runTerminalSession: creating standard session (problem=${problemSlug}, testcase=${testcaseId}, session=${sessionId})`,
    )

    // Try to claim a warm container first (faster than creating on-demand)
    const containerName = await tryClaimWarmContainer({
      client,
      problemSlug,
      testcaseId,
    })

    if (containerName) {
      // Store the claimed container name in the DB
      await db
        .update(terminalSessions)
        .set({ containerName })
        .where(eq(terminalSessions.id, sessionId))

      log(`claimed warm container ${containerName} for session ${sessionId}`)

      return containerName
    }

    // No warm container available — create on-demand
    const { container_name: newContainerName } = await client.createSession({
      image: `easyshell-${problemSlug}-${testcaseId}`,
      problem: problemSlug,
      testcase: testcaseId,
      mode: "session",
      type: "standard",
    })

    // Store the container name in the DB
    await db
      .update(terminalSessions)
      .set({ containerName: newContainerName })
      .where(eq(terminalSessions.id, sessionId))

    log(
      `standard container ${newContainerName} created for session ${sessionId}`,
    )

    return newContainerName
  }
}

/**
 * Get an existing active terminal session or create a new one.
 * Returns session info with logs and a `ready` flag.
 * For k3s sessions that were just created, ready=false — the client should
 * poll getSessionReadiness() until ready.
 */
export async function getTerminalSession({
  db,
  client,
  userId,
  problemId,
  testcaseId,
  problemSlug,
  problemInfo,
}: {
  db: Db
  client: MustangClient
  userId: string
  problemId: number
  testcaseId: number
  problemSlug: string
  problemInfo: ProblemInfo
}) {
  let session = await getActiveTerminalSession({
    db,
    client,
    userId,
    problemId,
    testcaseId,
  })

  // Existing session is alive — return it as ready
  if (session) {
    log(
      `getTerminalSession: returning existing session ${session.id} (container=${session.containerName})`,
    )
    const logs = await getTerminalSessionLogs(db, session.id)
    return {
      id: session.id,
      containerName: session.containerName,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      deletedAt: session.deletedAt,
      ready: true as const,
      logs,
    }
  }

  // No active session — create a new one
  log(
    `getTerminalSession: no active session found, creating new one (user=${userId}, problem=${problemId}, testcase=${testcaseId})`,
  )
  await createTerminalSession({
    db,
    client,
    userId,
    problemId,
    testcaseId,
    problemSlug,
    problemInfo,
  })

  // Fetch the session we just created directly from DB
  // (don't use getActiveTerminalSession which re-checks container liveness —
  //  for k3s sessions the container isn't ready yet)
  const newSession = (
    await db
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
  )[0]

  if (!newSession) throw new Error("Failed to create terminal session")

  log(
    `getTerminalSession: returning new session ${newSession.id} (container=${newSession.containerName})`,
  )

  const logs = await getTerminalSessionLogs(db, newSession.id)
  const isK3s = isLiveEnvironmentProblem(problemInfo)

  return {
    id: newSession.id,
    containerName: newSession.containerName,
    createdAt: newSession.createdAt,
    expiresAt: newSession.expiresAt,
    deletedAt: newSession.deletedAt,
    // K3s sessions need client-side readiness polling; standard sessions are ready immediately
    ready: !isK3s as boolean,
    logs,
  }
}

/**
 * Create a new terminal session: insert DB record + start container.
 */
export async function createTerminalSession({
  db,
  client,
  userId,
  problemId,
  testcaseId,
  problemSlug,
  problemInfo,
}: {
  db: Db
  client: MustangClient
  userId: string
  problemId: number
  testcaseId: number
  problemSlug: string
  problemInfo: ProblemInfo
}) {
  const sessionId = await insertTerminalSession(db, {
    userId,
    problemId,
    testcaseId,
  })

  await runTerminalSession({
    db,
    client,
    problemSlug,
    problemInfo,
    testcaseId,
    sessionId,
  })
}

/**
 * Find an active (non-deleted) session and verify its container is alive.
 * If the container is dead, soft-deletes the session and returns null.
 */
export async function getActiveTerminalSession({
  db,
  client,
  userId,
  problemId,
  testcaseId,
}: {
  db: Db
  client: MustangClient
  userId: string
  problemId: number
  testcaseId: number
}) {
  const session = (
    await db
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
  )[0]

  if (!session) return null

  // Check if the session has expired
  if (session.expiresAt && session.expiresAt < new Date()) {
    log(
      `getActiveTerminalSession: session ${session.id} has expired (expiresAt=${session.expiresAt.toISOString()})`,
    )
    // Soft-delete the expired session
    await db
      .update(terminalSessions)
      .set({ deletedAt: new Date() })
      .where(eq(terminalSessions.id, session.id))

    // Best-effort kill the container
    if (session.containerName) {
      try {
        await client.killSession(session.containerName)
      } catch {
        // Container may already be gone
      }
    }

    return null
  }

  // Check container liveness via the ready endpoint
  if (session.containerName) {
    log(
      `getActiveTerminalSession: checking liveness of container ${session.containerName} for session ${session.id}`,
    )
    const readyResult = await client.getSessionReady(session.containerName)
    if (readyResult.exists && readyResult.running) {
      log(`getActiveTerminalSession: session ${session.id} is alive`)
      return session
    }
    log(
      `getActiveTerminalSession: session ${session.id} container is dead (exists=${readyResult.exists}, running=${readyResult.running})`,
    )
  } else {
    log(
      `getActiveTerminalSession: session ${session.id} has no container name, marking dead`,
    )
  }

  // Container is dead — soft-delete the session
  await db
    .update(terminalSessions)
    .set({ deletedAt: new Date() })
    .where(eq(terminalSessions.id, session.id))

  return null
}

/**
 * Check the readiness of a session's container.
 * Used by the client to poll for k3s session readiness.
 * Returns { ready, exists, running, error? }.
 */
export async function getSessionReadiness({
  client,
  containerName,
}: {
  client: MustangClient
  containerName: string
}) {
  log(`getSessionReadiness: checking ${containerName}`)
  const result = await client.getSessionReady(containerName)
  log(
    `getSessionReadiness: ${containerName} -> exists=${result.exists} running=${result.running} ready=${result.ready}${result.error ? ` error=${result.error}` : ""}`,
  )
  return result
}

/**
 * Kill all active terminal sessions for a user/problem/testcase.
 */
export async function killTerminalSessions({
  db,
  client,
  userId,
  problemId,
  testcaseId,
}: {
  db: Db
  client: MustangClient
  userId: string
  problemId: number
  testcaseId: number
}) {
  // Find active sessions
  const activeSessions = await db
    .select({
      id: terminalSessions.id,
      containerName: terminalSessions.containerName,
    })
    .from(terminalSessions)
    .where(
      and(
        eq(terminalSessions.userId, userId),
        eq(terminalSessions.problemId, problemId),
        eq(terminalSessions.testcaseId, testcaseId),
        isNull(terminalSessions.deletedAt),
      ),
    )

  // Mark as deleted in DB
  const updated = await db
    .update(terminalSessions)
    .set({ deletedAt: new Date() })
    .where(
      and(
        eq(terminalSessions.userId, userId),
        eq(terminalSessions.problemId, problemId),
        eq(terminalSessions.testcaseId, testcaseId),
        isNull(terminalSessions.deletedAt),
      ),
    )
    .returning({ id: terminalSessions.id })

  // Kill the actual Docker containers
  log(
    `killTerminalSessions: killing ${activeSessions.length} containers for user=${userId} problem=${problemId} testcase=${testcaseId}`,
  )
  for (const session of activeSessions) {
    if (session.containerName) {
      try {
        await client.killSession(session.containerName)
      } catch {
        // Container may already be stopped — ignore errors
      }
    }
  }

  return { deletedSessions: updated.length }
}

/**
 * Execute a command in a session container and log it.
 */
export async function submitCommand({
  db,
  client,
  sessionId,
  containerName,
  command,
  timeoutMs,
}: {
  db: Db
  client: MustangClient
  sessionId: number
  containerName: string
  command: string
  timeoutMs?: number
}): Promise<ExecResult & { logId?: number }> {
  log(
    `submitCommand: session=${sessionId} container=${containerName} command=${JSON.stringify(command.slice(0, 100))}`,
  )
  const startedAt = new Date()
  const execResponse = await client.execSession({
    containerName,
    command,
    timeoutMs,
  })
  const finishedAt = new Date()

  if (execResponse.status === "error") {
    logError(
      `submitCommand: exec error: ${execResponse.type} - ${execResponse.message}`,
    )
    return execResponse
  }

  const logId = await insertTerminalSessionLog(db, {
    sessionId,
    stdin: command,
    stdout: execResponse.stdout,
    stderr: execResponse.stderr,
    startedAt,
    finishedAt,
  })

  return { ...execResponse, logId }
}

/**
 * Run check.sh in a live-environment session container.
 */
export async function checkSession({
  client,
  containerName,
}: {
  client: MustangClient
  containerName: string
}): Promise<
  | { status: "success"; result: CheckSessionResponse }
  | { status: "error"; message: string }
> {
  try {
    const result = await client.checkSession(containerName)
    return { status: "success", result }
  } catch (e) {
    return {
      status: "error",
      message: e instanceof Error ? e.message : String(e),
    }
  }
}

// =============================================================================
// Warm Container Claiming
// =============================================================================

/**
 * Try to claim a warm container for the given problem+testcase.
 * Returns the container name if successfully claimed, or null if none available.
 * This is a best-effort operation — if it fails, the caller should fall back
 * to creating a container on-demand.
 */
async function tryClaimWarmContainer({
  client,
  problemSlug,
  testcaseId,
}: {
  client: MustangClient
  problemSlug: string
  testcaseId: number
}): Promise<string | null> {
  try {
    // Check if any warm containers are available for this problem+testcase
    const { containers } = await client.listContainers({
      mode: "warm",
      problem: problemSlug,
      testcase: testcaseId,
    })

    if (containers.length === 0) {
      log(
        `tryClaimWarmContainer: no warm containers for ${problemSlug} testcase=${testcaseId}`,
      )
      return null
    }

    // Try to claim the first available container
    for (const container of containers) {
      const result = await client.claimSession(container.name)
      if (result.claimed) {
        log(
          `tryClaimWarmContainer: claimed ${container.name} for ${problemSlug} testcase=${testcaseId}`,
        )
        return container.name
      }
      // If claim failed (another request beat us), try the next one
      log(
        `tryClaimWarmContainer: claim failed for ${container.name}: ${result.error}`,
      )
    }

    log(
      `tryClaimWarmContainer: all warm containers already claimed for ${problemSlug} testcase=${testcaseId}`,
    )
    return null
  } catch (error) {
    logError(
      `tryClaimWarmContainer: error (will fall back to on-demand): ${error}`,
    )
    return null
  }
}

// =============================================================================
// DB Helpers
// =============================================================================

export async function insertTerminalSession(
  db: Db,
  params: {
    userId: string
    problemId: number
    testcaseId: number
  },
): Promise<number> {
  const inserted = await db
    .insert(terminalSessions)
    .values({
      userId: params.userId,
      problemId: params.problemId,
      testcaseId: params.testcaseId,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60),
    })
    .returning({ id: terminalSessions.id })
  if (!inserted[0]) {
    throw new Error("Failed to insert terminal session")
  }
  return inserted[0].id
}

export type TerminalSessionLog = {
  id: number
  stdin: string
  stdout: string
  stderr: string
  startedAt: Date
  finishedAt: Date
}

export async function getTerminalSessionLogs(
  db: Db,
  sessionId: number,
): Promise<TerminalSessionLog[]> {
  const logs: TerminalSessionLog[] = await db
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

  return logs.map((log) => ({
    ...log,
    stdout: Buffer.from(log.stdout, "latin1").toString("utf-8"),
    stderr: Buffer.from(log.stderr, "latin1").toString("utf-8"),
  }))
}

export async function insertTerminalSessionLog(
  db: Db,
  params: {
    sessionId: number
    stdin: string
    stdout: string
    stderr: string
    startedAt: Date
    finishedAt: Date
  },
): Promise<number> {
  const log = await db
    .insert(terminalSessionLogs)
    .values(params)
    .returning({ id: terminalSessionLogs.id })
  if (!log[0]) {
    throw new Error("Failed to insert terminal session log")
  }
  return log[0].id
}
