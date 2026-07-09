// ==========================================
// Unit tests for the boot-time recovery worker.
//
// `runRecovery()` walks every non-terminal `accepted_job` row and
// reconciles SQLite against `docker inspect`:
//
//   container missing       → status='lost' + enqueue cleanup_pending
//   container present, up   → promote accepted/starting rows to running
//   container present, down → status='lost' + enqueue cleanup_pending
//
// Then it drains `cleanup_pending` by calling `dockerRm` and rm -rf-ing
// the working-dir trees. We mock the docker adapter and swap a real
// in-memory better-sqlite3 instance for the SQLite singleton.
// ==========================================

import Database from "better-sqlite3"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { migrate } from "../../src/db/migrations"

const { dockerState, dbHolder } = vi.hoisted(() => ({
  dockerState: {
    inspect: vi.fn(),
    rm: vi.fn(),
  },
  dbHolder: { db: null as Database.Database | null },
}))

vi.mock("../../src/env", () => ({
  env: {
    RUNNER_TOKEN:
      "test-token-64hex00000000000000000000000000000000000000000000000000000",
    RUNNER_PORT: 4200,
    RUNNER_NAME: "test-runner",
    RUNNER_PUBLIC_URL: "http://localhost:4200",
    RUNNER_ID: "test-runner-id",
    COORDINATOR_URL: "http://localhost:4100",
    WORKING_DIR: "/tmp/easyshell-test-recovery",
    RUNNER_DB_PATH: ":memory:",
    SUBMISSION_MAX_CONCURRENCY: 4,
    SESSION_MAX_CONCURRENCY: 64,
    LOG_LEVEL: "silent",
    NODE_ENV: "test",
    RUNNER_LABELS: {},
    DOCKER_REGISTRY: undefined,
  },
}))

vi.mock("@easyshell/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(() => ({})),
  }),
}))

vi.mock("../../src/docker/cli", () => ({
  dockerInspect: (...args: unknown[]) => dockerState.inspect(...args),
  dockerRm: (...args: unknown[]) => dockerState.rm(...args),
}))

vi.mock("../../src/db/sqlite", () => ({
  getDb: () => {
    if (!dbHolder.db) throw new Error("test db not initialized")
    return dbHolder.db
  },
}))

function makeMemDb(): Database.Database {
  const db = new Database(":memory:")
  db.pragma("foreign_keys = ON")
  migrate(db)
  return db
}

function seedAcceptedJob(
  db: Database.Database,
  row: {
    job_id: string
    container_name: string
    image?: string
    mode?: "submission" | "session"
    status:
      | "accepted"
      | "starting"
      | "running"
      | "succeeded"
      | "failed"
      | "cancelled"
      | "lost"
  },
): void {
  db.prepare(
    `INSERT INTO accepted_job
       (job_id, container_name, image, mode, status, accepted_at)
     VALUES (?,?,?,?,?,?)`,
  ).run(
    row.job_id,
    row.container_name,
    row.image ?? "easyshell-foo",
    row.mode ?? "submission",
    row.status,
    Date.now(),
  )
}

const { runRecovery } = await import("../../src/workers/recovery")

describe("workers/recovery", () => {
  beforeEach(() => {
    dockerState.inspect.mockReset()
    dockerState.rm.mockReset()
    // Fresh in-memory DB per test → no row bleed between cases.
    dbHolder.db = makeMemDb()
  })

  it("returns cleanly when there are no orphaned jobs", async () => {
    dockerState.inspect.mockResolvedValue({ exists: true, running: true })

    await expect(runRecovery()).resolves.toBeUndefined()
    expect(dockerState.inspect).not.toHaveBeenCalled()
  })

  it("marks status='lost' and enqueues cleanup_pending when container is missing", async () => {
    seedAcceptedJob(dbHolder.db!, {
      job_id: "job-1",
      container_name: "easyshell-job-1",
      status: "running",
    })
    dockerState.inspect.mockResolvedValue({ exists: false, running: false })
    dockerState.rm.mockResolvedValue(undefined)

    await runRecovery()

    expect(dockerState.inspect).toHaveBeenCalledWith("easyshell-job-1")
    const row = dbHolder
      .db!.prepare(
        "SELECT status, error_message FROM accepted_job WHERE job_id=?",
      )
      .get("job-1") as { status: string; error_message: string | null }
    expect(row.status).toBe("lost")
    expect(row.error_message).toContain("disappeared")
    // cleanup_pending was inserted with reason='startup_recovery' but the
    // subsequent drainCleanupQueue successfully `dockerRm`-ed it and
    // removed it from the queue. So the row should be GONE after drain.
    const pending = dbHolder
      .db!.prepare(
        "SELECT container_name FROM cleanup_pending WHERE container_name=?",
      )
      .get("easyshell-job-1")
    expect(pending).toBeUndefined()
    // dockerRm was called as part of drainCleanupQueue.
    expect(dockerState.rm).toHaveBeenCalledWith("easyshell-job-1")
  })

  it("marks status='lost' when container exists but is not running", async () => {
    seedAcceptedJob(dbHolder.db!, {
      job_id: "job-2",
      container_name: "easyshell-job-2",
      status: "running",
    })
    dockerState.inspect.mockResolvedValue({ exists: true, running: false })
    dockerState.rm.mockResolvedValue(undefined)

    await runRecovery()

    const row = dbHolder
      .db!.prepare(
        "SELECT status, error_message FROM accepted_job WHERE job_id=?",
      )
      .get("job-2") as { status: string; error_message: string | null }
    expect(row.status).toBe("lost")
    expect(row.error_message).toContain("exited")
    expect(dockerState.rm).toHaveBeenCalledWith("easyshell-job-2")
  })

  it("promotes accepted/starting rows to running when container is still up", async () => {
    seedAcceptedJob(dbHolder.db!, {
      job_id: "job-3",
      container_name: "easyshell-job-3",
      status: "accepted",
    })
    dockerState.inspect.mockResolvedValue({ exists: true, running: true })

    await runRecovery()

    const row = dbHolder
      .db!.prepare(
        "SELECT status, error_message FROM accepted_job WHERE job_id=?",
      )
      .get("job-3") as { status: string; error_message: string | null }
    expect(row.status).toBe("running")
    expect(row.error_message).toBeNull()
    // No cleanup_pending should be enqueued for a healthy container.
    const pending = dbHolder
      .db!.prepare("SELECT COUNT(*) AS c FROM cleanup_pending")
      .get() as { c: number }
    expect(pending.c).toBe(0)
    // No dockerRm calls — nothing to clean up.
    expect(dockerState.rm).not.toHaveBeenCalled()
  })

  it("leaves already-running rows unchanged when container is still up", async () => {
    seedAcceptedJob(dbHolder.db!, {
      job_id: "job-4",
      container_name: "easyshell-job-4",
      status: "running",
    })
    dockerState.inspect.mockResolvedValue({ exists: true, running: true })

    await runRecovery()

    const row = dbHolder
      .db!.prepare("SELECT status FROM accepted_job WHERE job_id=?")
      .get("job-4") as { status: string }
    expect(row.status).toBe("running")
  })

  it("ignores jobs already in terminal status (no inspect performed)", async () => {
    seedAcceptedJob(dbHolder.db!, {
      job_id: "job-5",
      container_name: "easyshell-job-5",
      status: "succeeded",
    })
    seedAcceptedJob(dbHolder.db!, {
      job_id: "job-6",
      container_name: "easyshell-job-6",
      status: "failed",
    })

    await runRecovery()

    expect(dockerState.inspect).not.toHaveBeenCalled()
    const succeeded = dbHolder
      .db!.prepare("SELECT status FROM accepted_job WHERE job_id=?")
      .get("job-5") as { status: string }
    expect(succeeded.status).toBe("succeeded")
  })

  it("bumps cleanup_pending.attempts when dockerRm rejects (keeps row in queue)", async () => {
    // Seed a pre-existing cleanup_pending row directly so we can test
    // the failure branch of drainCleanupQueue in isolation.
    dbHolder
      .db!.prepare(
        "INSERT INTO cleanup_pending (container_name, reason, queued_at, attempts) VALUES (?,?,?,?)",
      )
      .run("ghost-container", "orphaned", Date.now(), 0)
    dockerState.rm.mockRejectedValue(new Error("docker daemon unreachable"))

    await runRecovery()

    const pending = dbHolder
      .db!.prepare(
        "SELECT attempts, last_attempt_at FROM cleanup_pending WHERE container_name=?",
      )
      .get("ghost-container") as { attempts: number; last_attempt_at: number }
    expect(pending).toBeDefined()
    expect(pending.attempts).toBe(1)
    expect(pending.last_attempt_at).toBeGreaterThan(0)
  })

  it("does not crash when docker inspect throws (per-row error handling)", async () => {
    seedAcceptedJob(dbHolder.db!, {
      job_id: "job-7",
      container_name: "easyshell-job-7",
      status: "running",
    })
    dockerState.inspect.mockRejectedValue(new Error("docker socket broken"))

    await expect(runRecovery()).resolves.toBeUndefined()
    // Status remains unchanged because the per-row catch swallows the
    // error rather than rewriting the row.
    const row = dbHolder
      .db!.prepare("SELECT status FROM accepted_job WHERE job_id=?")
      .get("job-7") as { status: string }
    expect(row.status).toBe("running")
  })
})
