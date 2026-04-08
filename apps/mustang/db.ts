import { and, eq, isNull, sql } from "drizzle-orm"

import type { createDb } from "@easyshell/db"
import { containers } from "@easyshell/db/schema"

type Db = ReturnType<typeof createDb>

// =============================================================================
// Container CRUD helpers
// =============================================================================

interface InsertContainerData {
  name: string
  image: string
  problem: string
  testcase: number
  mode: string
  type: string
  memory: string
  cpu: string
}

/** Insert a new container record. */
export async function insertContainer(
  db: Db,
  data: InsertContainerData,
): Promise<void> {
  await db.insert(containers).values({
    name: data.name,
    image: data.image,
    problem: data.problem,
    testcase: data.testcase,
    mode: data.mode,
    type: data.type,
    status: "created",
    memory: data.memory,
    cpu: data.cpu,
  })
}

/** Get a container by name (non-deleted only). */
export async function getContainerByName(db: Db, name: string) {
  const results = await db
    .select()
    .from(containers)
    .where(and(eq(containers.name, name), isNull(containers.deletedAt)))
    .limit(1)

  return results[0] ?? null
}

interface FindContainersFilters {
  mode?: string
  problem?: string
  testcase?: number
}

/** Find containers matching optional filters (non-deleted, non-claimed for warm). */
export async function findContainers(db: Db, filters: FindContainersFilters) {
  const conditions = [isNull(containers.deletedAt)]

  if (filters.mode) {
    conditions.push(eq(containers.mode, filters.mode))
    // When filtering for warm, exclude claimed containers
    if (filters.mode === "warm") {
      conditions.push(sql`${containers.status} != 'claimed'`)
    }
  }
  if (filters.problem) {
    conditions.push(eq(containers.problem, filters.problem))
  }
  if (filters.testcase !== undefined) {
    conditions.push(eq(containers.testcase, filters.testcase))
  }

  return db
    .select()
    .from(containers)
    .where(and(...conditions))
}

/**
 * Atomically claim a warm container.
 * Returns true if the container was claimed, false otherwise.
 * The WHERE clause provides atomicity -- no mutex needed.
 */
export async function claimContainer(db: Db, name: string): Promise<boolean> {
  const result = await db
    .update(containers)
    .set({
      status: "claimed",
      claimedAt: new Date(),
    })
    .where(
      and(
        eq(containers.name, name),
        eq(containers.mode, "warm"),
        sql`${containers.status} != 'claimed'`,
        isNull(containers.deletedAt),
      ),
    )
    .returning({ id: containers.id })

  return result.length > 0
}

/** Soft-delete a container record. */
export async function softDeleteContainer(db: Db, name: string): Promise<void> {
  await db
    .update(containers)
    .set({ deletedAt: new Date(), status: "stopped" })
    .where(and(eq(containers.name, name), isNull(containers.deletedAt)))
}

/** Update a container's status. */
export async function updateContainerStatus(
  db: Db,
  name: string,
  status: string,
): Promise<void> {
  await db
    .update(containers)
    .set({ status })
    .where(and(eq(containers.name, name), isNull(containers.deletedAt)))
}
