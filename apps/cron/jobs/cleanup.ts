import { and, eq, isNull, lt } from "drizzle-orm"

import { terminalSessions } from "@easyshell/db/schema"
import type { MustangClient } from "@easyshell/mustang/client"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any

const log = (...args: unknown[]) => console.log("[cron:cleanup]", ...args)
const logError = (...args: unknown[]) =>
  console.error("[cron:cleanup]", ...args)

/**
 * Clean up expired and orphaned containers.
 *
 * 1. Expired sessions: sessions past their `expiresAt` that haven't been soft-deleted.
 *    Soft-delete them in DB and kill their Docker containers.
 *
 * 2. Orphaned containers: Docker containers matching `easyshell-*` that have no
 *    corresponding active DB session or running submission. Kill them unless they
 *    are warm pool containers or were created within the grace period.
 */
export async function runCleanup({
  db,
  client,
  orphanGraceSeconds,
}: {
  db: Db
  client: MustangClient
  orphanGraceSeconds: number
}) {
  log("starting cleanup job")

  const expiredCount = await cleanupExpiredSessions({ db, client })
  const orphanCount = await cleanupOrphanedContainers({
    db,
    client,
    orphanGraceSeconds,
  })

  log(
    `cleanup complete: ${expiredCount} expired sessions, ${orphanCount} orphaned containers`,
  )
}

// =============================================================================
// Expired Session Cleanup
// =============================================================================

async function cleanupExpiredSessions({
  db,
  client,
}: {
  db: Db
  client: MustangClient
}): Promise<number> {
  const now = new Date()

  // Find expired, non-deleted sessions
  const expiredSessions = await db
    .select({
      id: terminalSessions.id,
      containerName: terminalSessions.containerName,
      expiresAt: terminalSessions.expiresAt,
    })
    .from(terminalSessions)
    .where(
      and(
        lt(terminalSessions.expiresAt, now),
        isNull(terminalSessions.deletedAt),
      ),
    )

  if (expiredSessions.length === 0) {
    return 0
  }

  log(`found ${expiredSessions.length} expired sessions`)

  let cleanedCount = 0
  for (const session of expiredSessions) {
    try {
      // Soft-delete the session in DB
      await db
        .update(terminalSessions)
        .set({ deletedAt: now })
        .where(
          and(
            eq(terminalSessions.id, session.id),
            isNull(terminalSessions.deletedAt),
          ),
        )

      // Kill the Docker container if it exists
      if (session.containerName) {
        try {
          await client.killSession(session.containerName)
          log(
            `killed expired session ${session.id} (container=${session.containerName}, expired=${session.expiresAt.toISOString()})`,
          )
        } catch {
          // Container may already be gone — that's fine
          log(
            `session ${session.id} container already gone (container=${session.containerName})`,
          )
        }
      } else {
        log(
          `soft-deleted expired session ${session.id} (no container name, expired=${session.expiresAt.toISOString()})`,
        )
      }

      cleanedCount++
    } catch (error) {
      logError(`failed to clean up expired session ${session.id}:`, error)
    }
  }

  return cleanedCount
}

// =============================================================================
// Orphaned Container Cleanup
// =============================================================================

/**
 * Parse a Docker "CreatedAt" string like "2026-04-05 12:30:00 +0000 UTC"
 * into a Date object. Falls back to current time on parse failure.
 */
function parseDockerCreatedAt(createdAt: string): Date {
  // Docker format: "2026-04-05 12:30:00 +0000 UTC"
  // Replace the trailing " UTC" and parse
  const cleaned = createdAt.replace(/ UTC$/, "").replace(/ \+0000$/, "Z")
  const date = new Date(cleaned)
  if (isNaN(date.getTime())) {
    return new Date() // fallback: treat as just-created to avoid killing it
  }
  return date
}

async function cleanupOrphanedContainers({
  db,
  client,
  orphanGraceSeconds,
}: {
  db: Db
  client: MustangClient
  orphanGraceSeconds: number
}): Promise<number> {
  // Get all running easyshell containers (excluding warm pool containers)
  let containers
  try {
    const result = await client.listContainers()
    containers = result.containers
  } catch (error) {
    logError("failed to list containers:", error)
    return 0
  }

  if (containers.length === 0) {
    return 0
  }

  const now = new Date()
  const graceThreshold = new Date(now.getTime() - orphanGraceSeconds * 1000)

  // Get all active (non-deleted) sessions' container names
  const activeSessions: Array<{ containerName: string | null }> = await db
    .select({ containerName: terminalSessions.containerName })
    .from(terminalSessions)
    .where(isNull(terminalSessions.deletedAt))

  const activeContainerNames = new Set(
    activeSessions
      .map((s) => s.containerName)
      .filter((name): name is string => name !== null),
  )

  let killedCount = 0
  for (const container of containers) {
    const mode = container.labels["sh.easyshell.mode"]

    // Skip warm pool containers — they're managed by the pool job
    if (mode === "warm") continue

    // Skip submission containers — they are short-lived and self-cleanup
    if (mode === "submission") continue

    // Skip containers that have an active DB session
    if (activeContainerNames.has(container.name)) continue

    // Apply grace period — don't kill containers that were just created
    const createdAt = parseDockerCreatedAt(container.created_at)
    if (createdAt > graceThreshold) {
      log(
        `skipping orphaned container ${container.name} (created ${createdAt.toISOString()}, within grace period)`,
      )
      continue
    }

    // This container is orphaned — kill it
    try {
      await client.killSession(container.name)
      log(
        `killed orphaned container ${container.name} (mode=${mode}, problem=${container.labels["sh.easyshell.problem"]}, created=${createdAt.toISOString()})`,
      )
      killedCount++
    } catch (error) {
      logError(`failed to kill orphaned container ${container.name}:`, error)
    }
  }

  return killedCount
}
