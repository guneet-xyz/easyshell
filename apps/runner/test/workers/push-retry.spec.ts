// ==========================================
// Unit tests for the push-retry worker.
//
// `pushRetryLoop()` runs forever once started. Every 10s it scans
// `accepted_job` for terminal-status rows that have not been ack'd by
// the coordinator and replays them via `jobs.reportResult.mutate`. On
// success it sets `push_acked=1`; on failure it bumps `push_attempts`
// and `last_push_at` and lets the next tick retry.
//
// We exercise the loop with fake timers and a real in-memory SQLite
// instance — no `pushOnce` export is needed.
// ==========================================

import Database from "better-sqlite3"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { migrate } from "../../src/db/migrations"

const {
  envState,
  reportResultMock,
  createTRPCClientMock,
  httpBatchLinkMock,
  dbHolder,
} = vi.hoisted(() => ({
  envState: {
    RUNNER_TOKEN: "test-token" as string | undefined,
    RUNNER_PORT: 4200,
    RUNNER_NAME: "test-runner",
    RUNNER_PUBLIC_URL: "http://localhost:4200",
    RUNNER_ID: "runner-id" as string | undefined,
    COORDINATOR_URL: "http://localhost:4100",
    WORKING_DIR: "/tmp/easyshell-test-push-retry",
    RUNNER_DB_PATH: ":memory:",
    SUBMISSION_MAX_CONCURRENCY: 4,
    SESSION_MAX_CONCURRENCY: 64,
    LOG_LEVEL: "silent",
    NODE_ENV: "test",
    RUNNER_LABELS: {} as Record<string, string>,
    DOCKER_REGISTRY: undefined as string | undefined,
  },
  reportResultMock: vi.fn(),
  createTRPCClientMock: vi.fn(),
  httpBatchLinkMock: vi.fn(),
  dbHolder: { db: null as Database.Database | null },
}))

vi.mock("../../src/env", () => ({ env: envState }))

vi.mock("@easyshell/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(() => ({})),
  }),
}))

vi.mock("@trpc/client", () => ({
  createTRPCClient: (...args: unknown[]) => {
    createTRPCClientMock(...args)
    return {
      jobs: {
        reportResult: { mutate: reportResultMock },
      },
    }
  },
  httpBatchLink: httpBatchLinkMock,
  // The SUT imports TRPCClientError for a runtime `instanceof` check inside
  // is401(). Without a real class here, `err instanceof undefined` throws a
  // TypeError inside the catch handler — is401 never returns false, the
  // UPDATE that bumps push_attempts never runs, and the outer try/catch
  // swallows the TypeError as a benign log.
  TRPCClientError: class TRPCClientError extends Error {},
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

function seedTerminalJob(
  db: Database.Database,
  row: {
    job_id: string
    status: "succeeded" | "failed" | "cancelled"
    push_acked?: number
    stdout?: string
    stderr?: string
    exit_code?: number
    error_message?: string
    fs?: Record<string, string>
    started_at?: number
    finished_at?: number
  },
): void {
  db.prepare(
    `INSERT INTO accepted_job
       (job_id, container_name, image, mode, status, accepted_at,
        stdout, stderr, exit_code, fs, error_message,
        started_at, finished_at, push_acked)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  ).run(
    row.job_id,
    `container-${row.job_id}`,
    "easyshell-foo",
    "submission",
    row.status,
    Date.now() - 60_000,
    row.stdout ?? null,
    row.stderr ?? null,
    row.exit_code ?? null,
    row.fs ? JSON.stringify(row.fs) : null,
    row.error_message ?? null,
    row.started_at ?? Date.now() - 30_000,
    row.finished_at ?? Date.now() - 10_000,
    row.push_acked ?? 0,
  )
}

// Drain pending microtasks after advancing fake timers. The infinite
// loop awaits mutate → updates the DB → loops again; the assertions
// downstream need both promise resolutions to settle.
async function tick(ms: number): Promise<void> {
  await vi.advanceTimersByTimeAsync(ms)
  for (let i = 0; i < 5; i++) await Promise.resolve()
}

describe("workers/push-retry", () => {
  beforeEach(() => {
    vi.resetModules()
    reportResultMock.mockReset()
    createTRPCClientMock.mockReset()
    httpBatchLinkMock.mockReset()
    envState.RUNNER_ID = "runner-id"
    envState.RUNNER_TOKEN = "secret"
    dbHolder.db = makeMemDb()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("pushes a succeeded job and marks push_acked=1", async () => {
    seedTerminalJob(dbHolder.db!, {
      job_id: "job-ok",
      status: "succeeded",
      stdout: "ok",
      stderr: "",
      exit_code: 0,
      fs: { "/foo": "bar" },
      started_at: 1_700_000_000_000,
      finished_at: 1_700_000_001_000,
    })
    reportResultMock.mockResolvedValue({ acked: true })

    const { pushRetryLoop } = await import("../../src/workers/push-retry")
    void pushRetryLoop().catch(() => {
      /* loop is infinite */
    })
    await tick(10_001)

    expect(reportResultMock).toHaveBeenCalledTimes(1)
    expect(reportResultMock).toHaveBeenCalledWith({
      job_id: "job-ok",
      outcome: {
        status: "succeeded",
        stdout: "ok",
        stderr: "",
        exit_code: 0,
        fs: { "/foo": "bar" },
        started_at: new Date(1_700_000_000_000).toISOString(),
        finished_at: new Date(1_700_000_001_000).toISOString(),
      },
    })

    const row = dbHolder
      .db!.prepare("SELECT push_acked FROM accepted_job WHERE job_id=?")
      .get("job-ok") as { push_acked: number }
    expect(row.push_acked).toBe(1)
  })

  it("pushes a failed job with the error message in the outcome", async () => {
    seedTerminalJob(dbHolder.db!, {
      job_id: "job-fail",
      status: "failed",
      error_message: "exit 137",
    })
    reportResultMock.mockResolvedValue({ acked: true })

    const { pushRetryLoop } = await import("../../src/workers/push-retry")
    void pushRetryLoop().catch(() => {})
    await tick(10_001)

    expect(reportResultMock).toHaveBeenCalledWith({
      job_id: "job-fail",
      outcome: { status: "failed", error: "exit 137" },
    })
  })

  it("pushes a cancelled job with the cancelled discriminant", async () => {
    seedTerminalJob(dbHolder.db!, {
      job_id: "job-cancel",
      status: "cancelled",
    })
    reportResultMock.mockResolvedValue({ acked: true })

    const { pushRetryLoop } = await import("../../src/workers/push-retry")
    void pushRetryLoop().catch(() => {})
    await tick(10_001)

    expect(reportResultMock).toHaveBeenCalledWith({
      job_id: "job-cancel",
      outcome: { status: "cancelled" },
    })
  })

  it("does not push jobs that are already push_acked=1 (idempotency)", async () => {
    seedTerminalJob(dbHolder.db!, {
      job_id: "job-already-acked",
      status: "succeeded",
      push_acked: 1,
    })
    reportResultMock.mockResolvedValue({ acked: true })

    const { pushRetryLoop } = await import("../../src/workers/push-retry")
    void pushRetryLoop().catch(() => {})
    await tick(10_001)

    expect(reportResultMock).not.toHaveBeenCalled()
  })

  it("does not push jobs still in non-terminal status", async () => {
    seedTerminalJob(dbHolder.db!, {
      job_id: "job-running",
      // 'running' is filtered out by the SELECT — passed via cast below.
      status: "succeeded",
    })
    // Override status post-seed to a non-terminal value.
    dbHolder
      .db!.prepare("UPDATE accepted_job SET status='running' WHERE job_id=?")
      .run("job-running")
    reportResultMock.mockResolvedValue({ acked: true })

    const { pushRetryLoop } = await import("../../src/workers/push-retry")
    void pushRetryLoop().catch(() => {})
    await tick(10_001)

    expect(reportResultMock).not.toHaveBeenCalled()
  })

  it("bumps push_attempts when mutate rejects and keeps the loop alive", async () => {
    seedTerminalJob(dbHolder.db!, {
      job_id: "job-retry",
      status: "succeeded",
      stdout: "",
      stderr: "",
      exit_code: 0,
    })
    reportResultMock
      .mockRejectedValueOnce(new Error("502 bad gateway"))
      .mockResolvedValueOnce({ acked: true })

    const { pushRetryLoop } = await import("../../src/workers/push-retry")
    void pushRetryLoop().catch(() => {})

    // First tick: mutate rejects → push_attempts becomes 1, push_acked still 0.
    await tick(10_001)
    expect(reportResultMock).toHaveBeenCalledTimes(1)
    const afterFail = dbHolder
      .db!.prepare(
        "SELECT push_attempts, push_acked, last_push_at FROM accepted_job WHERE job_id=?",
      )
      .get("job-retry") as {
      push_attempts: number
      push_acked: number
      last_push_at: number | null
    }
    expect(afterFail.push_attempts).toBe(1)
    expect(afterFail.push_acked).toBe(0)
    expect(afterFail.last_push_at).toBeGreaterThan(0)

    // Second tick: mutate succeeds → push_acked=1 and the loop did not crash.
    await tick(10_001)
    expect(reportResultMock).toHaveBeenCalledTimes(2)
    const afterOk = dbHolder
      .db!.prepare("SELECT push_acked FROM accepted_job WHERE job_id=?")
      .get("job-retry") as { push_acked: number }
    expect(afterOk.push_acked).toBe(1)
  })

  it("sets the bearer + x-runner-id auth headers on the client links", async () => {
    seedTerminalJob(dbHolder.db!, {
      job_id: "job-headers",
      status: "succeeded",
      stdout: "",
      stderr: "",
      exit_code: 0,
    })
    reportResultMock.mockResolvedValue({ acked: true })
    envState.RUNNER_ID = "headers-id"
    envState.RUNNER_TOKEN = "headers-secret"

    const { pushRetryLoop } = await import("../../src/workers/push-retry")
    void pushRetryLoop().catch(() => {})
    await tick(10_001)

    expect(httpBatchLinkMock).toHaveBeenCalledTimes(1)
    const opts = httpBatchLinkMock.mock.calls[0]?.[0] as {
      url: string
      headers: Record<string, string>
    }
    expect(opts.url).toBe("http://localhost:4100")
    expect(opts.headers).toEqual({
      Authorization: "Bearer headers-secret",
      "x-runner-id": "headers-id",
    })
  })
})
