// Session lifecycle: ending a session releases capacity exactly once, expired
// session containers are reaped, and finished working directories are drained
// during normal operation (not only at boot).
import fs from "node:fs"
import Database from "better-sqlite3"
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

import { migrate } from "../../src/db/migrations"

const { WORKING_DIR, dockerState, dbHolder, capacity } = vi.hoisted(() => ({
  WORKING_DIR: `/tmp/easyshell-test-session-expiry-${process.pid}`,
  dockerState: { kill: vi.fn(), rm: vi.fn(), expired: vi.fn() },
  dbHolder: { db: null as Database.Database | null },
  capacity: { decrementSession: vi.fn() },
}))

vi.mock("../../src/env", () => ({
  env: {
    WORKING_DIR,
    RUNNER_DB_PATH: ":memory:",
    LOG_LEVEL: "silent",
    NODE_ENV: "test",
  },
}))

vi.mock("@easyshell/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

vi.mock("../../src/docker/cli", () => ({
  dockerKill: (...args: unknown[]) => dockerState.kill(...args),
  dockerRm: (...args: unknown[]) => dockerState.rm(...args),
  dockerInspect: vi.fn(),
  listExpiredSessions: () => dockerState.expired(),
}))

vi.mock("../../src/db/sqlite", () => ({
  getDb: () => {
    if (!dbHolder.db) throw new Error("test db not initialized")
    return dbHolder.db
  },
}))

vi.mock("../../src/services/capacity", () => ({
  decrementSession: () => capacity.decrementSession(),
}))

const { endSession } = await import("../../src/services/session-lifecycle")
const { reapExpiredSessions } = await import("../../src/workers/reconciliation")
const { drainCleanupQueue } = await import("../../src/workers/recovery")

function seedSession(db: Database.Database, name: string): void {
  const now = Date.now()
  db.prepare(
    "INSERT INTO accepted_job (job_id, container_name, image, mode, status, accepted_at) VALUES (?,?,?,?,?,?)",
  ).run(`session-${name}`, name, "easyshell-foo-1", "session", "running", now)
  db.prepare(
    "INSERT INTO container (container_name, job_id, docker_state, working_dir, created_at) VALUES (?,?,?,?,?)",
  ).run(
    name,
    `session-${name}`,
    "running",
    `${WORKING_DIR}/sessions/${name}`,
    now,
  )
}

afterAll(() => fs.rmSync(WORKING_DIR, { recursive: true, force: true }))

describe("session lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    dbHolder.db = new Database(":memory:")
    dbHolder.db.pragma("foreign_keys = ON")
    migrate(dbHolder.db)
  })

  it("releases the capacity slot only on the first end", () => {
    const db = dbHolder.db!
    seedSession(db, "sess-a")
    expect(endSession(db, "sess-a", "cancelled", "cancelled")).toBe(true)
    expect(endSession(db, "sess-a", "cancelled", "cancelled")).toBe(false)
    expect(endSession(db, "sess-a", "lost", "orphaned")).toBe(false)
    expect(capacity.decrementSession).toHaveBeenCalledTimes(1)
    const job = db
      .prepare("SELECT status FROM accepted_job WHERE container_name='sess-a'")
      .get() as { status: string }
    expect(job.status).toBe("cancelled")
    const pending = db
      .prepare(
        "SELECT reason FROM cleanup_pending WHERE container_name='sess-a'",
      )
      .get()
    expect(pending).toEqual({ reason: "cancelled" })
  })

  it("does not release a slot for a session that never started", () => {
    const db = dbHolder.db!
    seedSession(db, "sess-starting")
    db.prepare(
      "UPDATE container SET docker_state='starting' WHERE container_name='sess-starting'",
    ).run()
    expect(endSession(db, "sess-starting", "cancelled", "cancelled")).toBe(true)
    expect(capacity.decrementSession).not.toHaveBeenCalled()
  })

  it("reaps expired session containers and ends them", async () => {
    const db = dbHolder.db!
    seedSession(db, "sess-old")
    seedSession(db, "sess-new")
    dockerState.expired.mockResolvedValue(["sess-old"])
    dockerState.kill.mockResolvedValue({ ok: true })

    await reapExpiredSessions()

    expect(dockerState.kill).toHaveBeenCalledExactlyOnceWith("sess-old")
    expect(capacity.decrementSession).toHaveBeenCalledTimes(1)
    const states = db
      .prepare("SELECT container_name, docker_state FROM container ORDER BY 1")
      .all()
    expect(states).toEqual([
      { container_name: "sess-new", docker_state: "running" },
      { container_name: "sess-old", docker_state: "removed" },
    ])
  })

  it("drains finished working directories", async () => {
    const db = dbHolder.db!
    seedSession(db, "sess-done")
    const dir = `${WORKING_DIR}/sessions/sess-done`
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(`${dir}/leftover`, "x")
    endSession(db, "sess-done", "cancelled", "cancelled")

    await drainCleanupQueue(db)

    expect(dockerState.rm).toHaveBeenCalledWith("sess-done")
    expect(fs.existsSync(dir)).toBe(false)
    expect(
      db.prepare("SELECT count(*) AS n FROM cleanup_pending").get(),
    ).toEqual({ n: 0 })
  })
})
