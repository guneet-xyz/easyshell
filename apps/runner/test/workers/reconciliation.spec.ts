// ==========================================
// Unit tests for the periodic reconciliation worker.
//
// The production path runs `scanOnce()` on a 30s setInterval. To keep
// tests deterministic we exercise `scanOnce` directly — it was
// promoted from a module-local to an exported symbol for this purpose.
// `startReconciliation` itself just schedules the interval and is
// covered separately by a smoke test that ensures it returns without
// scheduling work synchronously.
// ==========================================

import Database from "better-sqlite3"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { migrate } from "../../src/db/migrations"

const { dockerState, dbHolder } = vi.hoisted(() => ({
  dockerState: { inspect: vi.fn() },
  dbHolder: { db: null as Database.Database | null },
}))

vi.mock("../../src/env", () => ({
  env: {
    RUNNER_SECRET: "test-secret-64hex0000000000000000000000000000000000000000000000000000",
    RUNNER_PORT: 4200,
    RUNNER_NAME: "test-runner",
    RUNNER_PUBLIC_URL: "http://localhost:4200",
    RUNNER_ID: "test-runner-id",
    COORDINATOR_URL: "http://localhost:4100",
    COORDINATOR_REGISTRATION_TOKEN: "test-reg",
    WORKING_DIR: "/tmp/easyshell-test-reconciliation",
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
  row: { job_id: string; container_name: string; status: string },
): void {
  db.prepare(
    `INSERT INTO accepted_job
       (job_id, container_name, image, mode, status, accepted_at)
     VALUES (?,?,?,?,?,?)`,
  ).run(row.job_id, row.container_name, "easyshell-foo", "submission", row.status, Date.now())
}

const { scanOnce, startReconciliation } = await import(
  "../../src/workers/reconciliation"
)

describe("workers/reconciliation", () => {
  beforeEach(() => {
    dockerState.inspect.mockReset()
    dbHolder.db = makeMemDb()
  })

  describe("scanOnce", () => {
    it("is a no-op when there are no active jobs", async () => {
      await expect(scanOnce()).resolves.toBeUndefined()
      expect(dockerState.inspect).not.toHaveBeenCalled()
    })

    it("marks status='lost' and enqueues cleanup when container is gone", async () => {
      seedAcceptedJob(dbHolder.db!, {
        job_id: "job-1",
        container_name: "easyshell-job-1",
        status: "running",
      })
      dockerState.inspect.mockResolvedValue({ exists: false, running: false })

      await scanOnce()

      const row = dbHolder.db!
        .prepare(
          "SELECT status, error_message, finished_at FROM accepted_job WHERE job_id=?",
        )
        .get("job-1") as {
        status: string
        error_message: string | null
        finished_at: number | null
      }
      expect(row.status).toBe("lost")
      expect(row.error_message).toContain("reconciliation")
      expect(row.finished_at).toBeGreaterThan(0)

      const pending = dbHolder.db!
        .prepare(
          "SELECT container_name, reason FROM cleanup_pending WHERE container_name=?",
        )
        .get("easyshell-job-1") as
        | { container_name: string; reason: string }
        | undefined
      expect(pending).toEqual({
        container_name: "easyshell-job-1",
        reason: "orphaned",
      })
    })

    it("leaves rows unchanged when container is still running", async () => {
      seedAcceptedJob(dbHolder.db!, {
        job_id: "job-2",
        container_name: "easyshell-job-2",
        status: "running",
      })
      dockerState.inspect.mockResolvedValue({ exists: true, running: true })

      await scanOnce()

      const row = dbHolder.db!
        .prepare(
          "SELECT status, error_message FROM accepted_job WHERE job_id=?",
        )
        .get("job-2") as { status: string; error_message: string | null }
      expect(row.status).toBe("running")
      expect(row.error_message).toBeNull()

      const pending = dbHolder.db!
        .prepare("SELECT COUNT(*) AS c FROM cleanup_pending")
        .get() as { c: number }
      expect(pending.c).toBe(0)
    })

    it("marks lost when container exists but is stopped", async () => {
      seedAcceptedJob(dbHolder.db!, {
        job_id: "job-3",
        container_name: "easyshell-job-3",
        status: "starting",
      })
      dockerState.inspect.mockResolvedValue({ exists: true, running: false })

      await scanOnce()

      const row = dbHolder.db!
        .prepare("SELECT status FROM accepted_job WHERE job_id=?")
        .get("job-3") as { status: string }
      expect(row.status).toBe("lost")

      const pending = dbHolder.db!
        .prepare("SELECT reason FROM cleanup_pending WHERE container_name=?")
        .get("easyshell-job-3") as { reason: string } | undefined
      expect(pending?.reason).toBe("orphaned")
    })

    it("skips rows already in terminal status", async () => {
      seedAcceptedJob(dbHolder.db!, {
        job_id: "job-4",
        container_name: "easyshell-job-4",
        status: "succeeded",
      })
      seedAcceptedJob(dbHolder.db!, {
        job_id: "job-5",
        container_name: "easyshell-job-5",
        status: "lost",
      })

      await scanOnce()
      expect(dockerState.inspect).not.toHaveBeenCalled()
    })

    it("processes additional rows when one inspect throws", async () => {
      seedAcceptedJob(dbHolder.db!, {
        job_id: "job-6",
        container_name: "easyshell-job-6",
        status: "running",
      })
      seedAcceptedJob(dbHolder.db!, {
        job_id: "job-7",
        container_name: "easyshell-job-7",
        status: "running",
      })
      dockerState.inspect
        .mockRejectedValueOnce(new Error("docker socket broken"))
        .mockResolvedValueOnce({ exists: false, running: false })

      await expect(scanOnce()).resolves.toBeUndefined()

      const job6 = dbHolder.db!
        .prepare("SELECT status FROM accepted_job WHERE job_id=?")
        .get("job-6") as { status: string }
      // The throw was swallowed → status unchanged.
      expect(job6.status).toBe("running")

      const job7 = dbHolder.db!
        .prepare("SELECT status FROM accepted_job WHERE job_id=?")
        .get("job-7") as { status: string }
      expect(job7.status).toBe("lost")
    })
  })

  describe("startReconciliation", () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it("returns synchronously and schedules an interval", () => {
      const setIntervalSpy = vi.spyOn(globalThis, "setInterval")
      const result = startReconciliation()
      expect(result).toBeUndefined()
      expect(setIntervalSpy).toHaveBeenCalledTimes(1)
      // The 2nd argument is the period in ms — should be 30_000.
      const period = setIntervalSpy.mock.calls[0]?.[1]
      expect(period).toBe(30_000)
    })

    it("does not invoke scanOnce before the first interval fires", () => {
      startReconciliation()
      // No timer advancement → no scan should have run.
      expect(dockerState.inspect).not.toHaveBeenCalled()
    })
  })
})
