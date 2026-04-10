import { and, asc, eq, isNull, lt } from "drizzle-orm"

import type { createDb } from "@easyshell/db"
import { terminalSessionLogs, terminalSessions } from "@easyshell/db/schema"

type Db = ReturnType<typeof createDb>

// =============================================================================
// Terminal Session CRUD
// =============================================================================

/** Insert a new terminal session with a 1-hour expiry. Returns the session ID. */
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

/** Find an active (non-deleted) session for a user/problem/testcase. */
export async function findActiveSession(
  db: Db,
  params: {
    userId: string
    problemId: number
    testcaseId: number
  },
) {
  const result = await db
    .select()
    .from(terminalSessions)
    .where(
      and(
        eq(terminalSessions.userId, params.userId),
        eq(terminalSessions.problemId, params.problemId),
        eq(terminalSessions.testcaseId, params.testcaseId),
        isNull(terminalSessions.deletedAt),
      ),
    )
    .limit(1)

  return result[0] ?? null
}

/** Soft-delete a single terminal session by ID. */
export async function softDeleteSession(db: Db, sessionId: number) {
  await db
    .update(terminalSessions)
    .set({ deletedAt: new Date() })
    .where(
      and(
        eq(terminalSessions.id, sessionId),
        isNull(terminalSessions.deletedAt),
      ),
    )
}

/** Update a session's container name. */
export async function updateSessionContainerName(
  db: Db,
  sessionId: number,
  containerName: string,
) {
  await db
    .update(terminalSessions)
    .set({ containerName })
    .where(eq(terminalSessions.id, sessionId))
}

/**
 * Soft-delete all active sessions for a user/problem/testcase.
 * Returns the deleted session IDs and their container names.
 */
export async function softDeleteSessions(
  db: Db,
  params: {
    userId: string
    problemId: number
    testcaseId: number
  },
) {
  // First find them (we need container names for cleanup)
  const activeSessions = await db
    .select({
      id: terminalSessions.id,
      containerName: terminalSessions.containerName,
    })
    .from(terminalSessions)
    .where(
      and(
        eq(terminalSessions.userId, params.userId),
        eq(terminalSessions.problemId, params.problemId),
        eq(terminalSessions.testcaseId, params.testcaseId),
        isNull(terminalSessions.deletedAt),
      ),
    )

  if (activeSessions.length === 0) return []

  // Soft-delete them all
  await db
    .update(terminalSessions)
    .set({ deletedAt: new Date() })
    .where(
      and(
        eq(terminalSessions.userId, params.userId),
        eq(terminalSessions.problemId, params.problemId),
        eq(terminalSessions.testcaseId, params.testcaseId),
        isNull(terminalSessions.deletedAt),
      ),
    )

  return activeSessions
}

// =============================================================================
// Terminal Session Logs
// =============================================================================

export type TerminalSessionLog = {
  id: number
  stdin: string
  stdout: string
  stderr: string
  startedAt: Date
  finishedAt: Date
}

/** Get all logs for a session, with latin1 -> utf8 conversion. */
export async function getSessionLogs(
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

/** Insert a session log entry. Returns the log ID. */
export async function insertSessionLog(
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
  const result = await db
    .insert(terminalSessionLogs)
    .values(params)
    .returning({ id: terminalSessionLogs.id })

  if (!result[0]) {
    throw new Error("Failed to insert terminal session log")
  }
  return result[0].id
}

// =============================================================================
// Cleanup Helpers
// =============================================================================

/**
 * Find all expired, non-deleted sessions.
 * Returns their IDs and container names for cleanup.
 */
export async function findExpiredSessions(db: Db) {
  return db
    .select({
      id: terminalSessions.id,
      containerName: terminalSessions.containerName,
      expiresAt: terminalSessions.expiresAt,
    })
    .from(terminalSessions)
    .where(
      and(
        lt(terminalSessions.expiresAt, new Date()),
        isNull(terminalSessions.deletedAt),
      ),
    )
}
