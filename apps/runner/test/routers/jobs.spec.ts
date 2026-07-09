// ==========================================
// Unit tests for the jobs.* tRPC router.
//
// We mock:
//   • `../../src/docker/cli` so dockerRun / dockerKill never spawn a
//     real `docker` process
//   • `../../src/db/sqlite` so getDb returns a real in-memory
//     better-sqlite3 instance with the production schema applied
//   • `../../src/services/capacity` so we can drive submissionUsed
//     deterministically per test
//
// `accept` fires the submission runner in the background. We let the
// background promise complete (it writes input.sh / output.json on disk
// under a unique WORKING_DIR, runs the mocked dockerRun, reads back
// the "{}" output.json, and updates the row to status='succeeded'). The
// test assertions only care that the row was inserted and that
// dockerRun was invoked — the final status is allowed to be anywhere
// in {accepted, running, succeeded} depending on microtask timing.
// ==========================================

import fs from "node:fs"
import Database from "better-sqlite3"
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

import { migrate } from "../../src/db/migrations"

const { TEST_WORKING_DIR, dockerState, dbHolder, capacityState } = vi.hoisted(
  () => {
    const dir = `/tmp/easyshell-test-jobs-${process.pid}`
    return {
      TEST_WORKING_DIR: dir,
      dockerState: {
        run: vi.fn(),
        kill: vi.fn(),
        inspect: vi.fn(),
      },
      dbHolder: { db: null as Database.Database | null },
      capacityState: { submission_used: 0 },
    }
  },
)

vi.mock("../../src/env", () => ({
  env: {
    RUNNER_TOKEN:
      "test-token-64hex00000000000000000000000000000000000000000000000000000",
    RUNNER_PORT: 4200,
    RUNNER_NAME: "test-runner",
    RUNNER_PUBLIC_URL: "http://localhost:4200",
    RUNNER_ID: "test-runner-id",
    COORDINATOR_URL: "http://localhost:4100",
    WORKING_DIR: TEST_WORKING_DIR,
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
  dockerRun: (...args: unknown[]) => dockerState.run(...args),
  dockerKill: (...args: unknown[]) => dockerState.kill(...args),
  dockerInspect: (...args: unknown[]) => dockerState.inspect(...args),
}))

vi.mock("../../src/db/sqlite", () => ({
  getDb: () => {
    if (!dbHolder.db) throw new Error("test db not initialized")
    return dbHolder.db
  },
}))

vi.mock("../../src/services/capacity", () => ({
  getCapacity: () => ({
    session_used: 0,
    session_max: 64,
    submission_used: capacityState.submission_used,
    submission_max: 4,
  }),
  incrementSubmission: vi.fn(() => {
    capacityState.submission_used++
  }),
  decrementSubmission: vi.fn(() => {
    capacityState.submission_used = Math.max(
      0,
      capacityState.submission_used - 1,
    )
  }),
  incrementSession: vi.fn(),
  decrementSession: vi.fn(),
}))

function makeMemDb(): Database.Database {
  const db = new Database(":memory:")
  db.pragma("foreign_keys = ON")
  migrate(db)
  return db
}

function buildInput(overrides: {
  job_id: string
  container_name?: string
  mode?: "submission" | "session"
  image?: string
  input?: string
}) {
  return {
    job_id: overrides.job_id,
    container_name: overrides.container_name ?? `cnt-${overrides.job_id}`,
    mode: overrides.mode ?? ("submission" as const),
    image: overrides.image ?? "easyshell-foo",
    input: overrides.input ?? "echo hi",
    resource_limits: { memory: "10m", cpus: "0.1" },
  }
}

// Wait for queued microtasks so the background runSubmissionJob IIFE
// has a chance to write its UPDATE statements. Tests still treat the
// final row status as a don't-care.
async function flushMicrotasks(): Promise<void> {
  for (let i = 0; i < 10; i++) await Promise.resolve()
}

const { jobsRouter } = await import("../../src/routers/jobs")

afterAll(() => {
  if (fs.existsSync(TEST_WORKING_DIR)) {
    fs.rmSync(TEST_WORKING_DIR, { recursive: true, force: true })
  }
})

describe("routers/jobs", () => {
  beforeEach(() => {
    dockerState.run.mockReset()
    dockerState.kill.mockReset()
    dockerState.inspect.mockReset()
    capacityState.submission_used = 0
    dbHolder.db = makeMemDb()
    // Pre-create the WORKING_DIR so the background runner's mkdirSync
    // doesn't race with the test assertions.
    fs.mkdirSync(TEST_WORKING_DIR, { recursive: true })
  })

  describe("auth", () => {
    it("rejects callers without the coordinator actor", async () => {
      const caller = jobsRouter.createCaller({ actor: "unauth" })
      await expect(caller.accept(buildInput({ job_id: "j" }))).rejects.toThrow(
        /UNAUTHORIZED|Coordinator credentials required/,
      )
      await expect(caller.get({ job_id: "j" })).rejects.toThrow(
        /UNAUTHORIZED|Coordinator credentials required/,
      )
      await expect(caller.cancel({ job_id: "j" })).rejects.toThrow(
        /UNAUTHORIZED|Coordinator credentials required/,
      )
    })
  })

  describe("accept", () => {
    it("returns at_capacity when the submission counter is already full", async () => {
      capacityState.submission_used = 4
      dockerState.run.mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 })
      const caller = jobsRouter.createCaller({ actor: "coordinator" })
      const result = await caller.accept(buildInput({ job_id: "capped" }))
      expect(result).toEqual({ status: "at_capacity" })
      // No row should have been inserted.
      const row = dbHolder
        .db!.prepare("SELECT job_id FROM accepted_job WHERE job_id=?")
        .get("capped")
      expect(row).toBeUndefined()
      // dockerRun must NOT have been spawned.
      expect(dockerState.run).not.toHaveBeenCalled()
    })

    it("inserts accepted_job + container rows and returns 'accepted'", async () => {
      dockerState.run.mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 })
      const caller = jobsRouter.createCaller({ actor: "coordinator" })

      const result = await caller.accept(buildInput({ job_id: "j-accept" }))
      expect(result).toEqual({ status: "accepted" })

      const job = dbHolder
        .db!.prepare(
          "SELECT job_id, mode, image FROM accepted_job WHERE job_id=?",
        )
        .get("j-accept") as
        | { job_id: string; mode: string; image: string }
        | undefined
      expect(job).toEqual({
        job_id: "j-accept",
        mode: "submission",
        image: "easyshell-foo",
      })

      const container = dbHolder
        .db!.prepare("SELECT job_id FROM container WHERE container_name=?")
        .get("cnt-j-accept") as { job_id: string } | undefined
      expect(container?.job_id).toBe("j-accept")

      // Allow the background IIFE to fire its `await dockerRun(...)`.
      await flushMicrotasks()
      expect(dockerState.run).toHaveBeenCalledTimes(1)
    })

    it("returns 'duplicate' when the same job_id is accepted twice", async () => {
      dockerState.run.mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 })
      const caller = jobsRouter.createCaller({ actor: "coordinator" })

      await caller.accept(
        buildInput({ job_id: "j-dup", container_name: "cnt-1" }),
      )
      const second = await caller.accept(
        buildInput({ job_id: "j-dup", container_name: "cnt-2" }),
      )
      expect(second).toEqual({ status: "duplicate" })

      // Still only one row + only one dockerRun call (the first accept).
      const count = dbHolder
        .db!.prepare("SELECT COUNT(*) AS c FROM accepted_job WHERE job_id=?")
        .get("j-dup") as { c: number }
      expect(count.c).toBe(1)
    })

    it("increments submissionUsed exactly once per accepted submission", async () => {
      // Never-resolving dockerRun → the background IIFE hangs at `await
      // dockerRun(...)` and the `finally { decrementSubmission() }`
      // branch never fires, so we observe the post-increment count
      // without any decrement racing in.
      dockerState.run.mockReturnValue(new Promise(() => undefined))
      const caller = jobsRouter.createCaller({ actor: "coordinator" })

      expect(capacityState.submission_used).toBe(0)
      await caller.accept(buildInput({ job_id: "j-cap-1" }))
      expect(capacityState.submission_used).toBe(1)
      await caller.accept(buildInput({ job_id: "j-cap-2" }))
      expect(capacityState.submission_used).toBe(2)
    })
  })

  describe("get", () => {
    it("returns 'unknown' for an absent job_id", async () => {
      const caller = jobsRouter.createCaller({ actor: "coordinator" })
      const result = await caller.get({ job_id: "missing" })
      expect(result).toEqual({ status: "unknown" })
    })

    it("returns 'accepted' status for an accepted row", async () => {
      dbHolder
        .db!.prepare(
          `INSERT INTO accepted_job (job_id, container_name, image, mode, status, accepted_at) VALUES (?,?,?,?,?,?)`,
        )
        .run("j-a", "cnt-a", "img", "submission", "accepted", Date.now())
      const caller = jobsRouter.createCaller({ actor: "coordinator" })
      const result = await caller.get({ job_id: "j-a" })
      expect(result).toEqual({ status: "accepted" })
    })

    it("collapses starting/running statuses to 'running'", async () => {
      dbHolder
        .db!.prepare(
          `INSERT INTO accepted_job (job_id, container_name, image, mode, status, accepted_at) VALUES (?,?,?,?,?,?)`,
        )
        .run("j-s", "cnt-s", "img", "submission", "starting", Date.now())
      const caller = jobsRouter.createCaller({ actor: "coordinator" })
      const result = await caller.get({ job_id: "j-s" })
      expect(result).toEqual({ status: "running" })
    })

    it("returns the full payload for a succeeded row", async () => {
      const startedAt = 1_700_000_000_000
      const finishedAt = 1_700_000_001_000
      dbHolder
        .db!.prepare(
          `INSERT INTO accepted_job
             (job_id, container_name, image, mode, status, accepted_at,
              started_at, finished_at, exit_code, stdout, stderr, fs)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        )
        .run(
          "j-ok",
          "cnt-ok",
          "img",
          "submission",
          "succeeded",
          Date.now(),
          startedAt,
          finishedAt,
          0,
          "stdout-bytes",
          "stderr-bytes",
          JSON.stringify({ "/tmp/foo": "bar" }),
        )
      const caller = jobsRouter.createCaller({ actor: "coordinator" })
      const result = await caller.get({ job_id: "j-ok" })
      expect(result).toEqual({
        status: "succeeded",
        stdout: "stdout-bytes",
        stderr: "stderr-bytes",
        exit_code: 0,
        fs: { "/tmp/foo": "bar" },
        started_at: new Date(startedAt).toISOString(),
        finished_at: new Date(finishedAt).toISOString(),
      })
    })

    it("returns 'failed' with the error_message for a failed row", async () => {
      dbHolder
        .db!.prepare(
          `INSERT INTO accepted_job (job_id, container_name, image, mode, status, accepted_at, error_message) VALUES (?,?,?,?,?,?,?)`,
        )
        .run(
          "j-fail",
          "cnt-f",
          "img",
          "submission",
          "failed",
          Date.now(),
          "exit 137",
        )
      const caller = jobsRouter.createCaller({ actor: "coordinator" })
      const result = await caller.get({ job_id: "j-fail" })
      expect(result).toEqual({ status: "failed", error: "exit 137" })
    })

    it("maps 'lost' to 'failed' with a fallback message", async () => {
      dbHolder
        .db!.prepare(
          `INSERT INTO accepted_job (job_id, container_name, image, mode, status, accepted_at) VALUES (?,?,?,?,?,?)`,
        )
        .run("j-lost", "cnt-l", "img", "submission", "lost", Date.now())
      const caller = jobsRouter.createCaller({ actor: "coordinator" })
      const result = await caller.get({ job_id: "j-lost" })
      expect(result).toEqual({ status: "failed", error: "container lost" })
    })

    it("returns 'cancelled' for a cancelled row", async () => {
      dbHolder
        .db!.prepare(
          `INSERT INTO accepted_job (job_id, container_name, image, mode, status, accepted_at) VALUES (?,?,?,?,?,?)`,
        )
        .run("j-cnl", "cnt-c", "img", "submission", "cancelled", Date.now())
      const caller = jobsRouter.createCaller({ actor: "coordinator" })
      const result = await caller.get({ job_id: "j-cnl" })
      expect(result).toEqual({ status: "cancelled" })
    })
  })

  describe("cancel", () => {
    it("returns ok=true was_running=false when job_id is unknown", async () => {
      const caller = jobsRouter.createCaller({ actor: "coordinator" })
      const result = await caller.cancel({ job_id: "ghost" })
      expect(result).toEqual({ ok: true, was_running: false })
      expect(dockerState.kill).not.toHaveBeenCalled()
    })

    it("calls dockerKill, marks the row cancelled, and reports was_running=true for a running job", async () => {
      dbHolder
        .db!.prepare(
          `INSERT INTO accepted_job (job_id, container_name, image, mode, status, accepted_at) VALUES (?,?,?,?,?,?)`,
        )
        .run("j-run", "cnt-run", "img", "submission", "running", Date.now())
      dockerState.kill.mockResolvedValue({ ok: true })

      const caller = jobsRouter.createCaller({ actor: "coordinator" })
      const result = await caller.cancel({ job_id: "j-run" })

      expect(result).toEqual({ ok: true, was_running: true })
      expect(dockerState.kill).toHaveBeenCalledWith("cnt-run")
      const row = dbHolder
        .db!.prepare("SELECT status FROM accepted_job WHERE job_id=?")
        .get("j-run") as { status: string }
      expect(row.status).toBe("cancelled")
    })

    it("reports was_running=false when cancelling a row that already finished", async () => {
      dbHolder
        .db!.prepare(
          `INSERT INTO accepted_job (job_id, container_name, image, mode, status, accepted_at) VALUES (?,?,?,?,?,?)`,
        )
        .run("j-done", "cnt-done", "img", "submission", "succeeded", Date.now())
      dockerState.kill.mockResolvedValue({ ok: true })

      const caller = jobsRouter.createCaller({ actor: "coordinator" })
      const result = await caller.cancel({ job_id: "j-done" })
      expect(result).toEqual({ ok: true, was_running: false })
      // dockerKill is still called for idempotency, but the row was
      // already terminal — the status moves to 'cancelled' regardless.
      const row = dbHolder
        .db!.prepare("SELECT status FROM accepted_job WHERE job_id=?")
        .get("j-done") as { status: string }
      expect(row.status).toBe("cancelled")
    })
  })
})
