import { beforeEach, describe, expect, it, vi } from "vitest"

// ── Mocks MUST be registered before importing the SUT ───────────────────────
vi.mock("../../src/env", () => ({
  env: {
    DATABASE_URL: "postgres://test",
    COORDINATOR_TOKEN: "test-coord-token",
    COORDINATOR_REGISTRATION_TOKEN: "test-reg-token",
    COORDINATOR_PORT: 4100,
    MAX_ATTEMPTS: 3,
    LOG_LEVEL: "silent",
    NODE_ENV: "test",
    COORDINATOR_SECRET_KEY: undefined,
  },
}))

// Share a single warn/info spy across the watchdog logger so tests can
// assert on log side-effects (markStaleRunners only logs when stale rows
// were found).
const logInfoSpy = vi.fn()
const logWarnSpy = vi.fn()
const logErrorSpy = vi.fn()

vi.mock("@easyshell/logger", () => ({
  createLogger: () => ({
    info: logInfoSpy,
    debug: vi.fn(),
    warn: logWarnSpy,
    error: logErrorSpy,
    trace: vi.fn(),
    fatal: vi.fn(),
    child: vi.fn(() => ({})),
  }),
}))

// Runner client mock — only `jobs.get.query` is exercised by the watchdog.
const runnerClientJobsGetQuery = vi
  .fn()
  .mockResolvedValue({ status: "unknown" })
const mockRunnerClient = {
  jobs: { get: { query: runnerClientJobsGetQuery } },
}
const createRunnerClientFromDbSpy = vi
  .fn()
  .mockResolvedValue(mockRunnerClient)

vi.mock("../../src/services/runner-client", () => ({
  createRunnerClientFromDb: createRunnerClientFromDbSpy,
}))

// ── Drizzle chain mock ──────────────────────────────────────────────────────
type AnyFn = (...args: unknown[]) => unknown

const selectColumnsSpy = vi.fn<AnyFn>()
const selectFromSpy = vi.fn<AnyFn>()
const innerJoinSpy = vi.fn<AnyFn>()
const selectWhereSpy = vi.fn<AnyFn>()
const selectLimitSpy = vi.fn<AnyFn>().mockResolvedValue([])

const insertTableSpy = vi.fn<AnyFn>()
const insertValuesSpy = vi.fn<AnyFn>()
const onConflictDoNothingSpy = vi.fn<AnyFn>().mockResolvedValue([])

const updateTableSpy = vi.fn<AnyFn>()
const updateSetSpy = vi.fn<AnyFn>()
const updateWhereSpy = vi.fn<AnyFn>()
const updateReturningSpy = vi.fn<AnyFn>().mockResolvedValue([])
const updateWhereThenSpy = vi.fn<AnyFn>().mockResolvedValue([])

vi.mock("../../src/db", () => {
  type Then = (
    onResolve: (v: unknown) => unknown,
    onReject?: (e: unknown) => unknown,
  ) => Promise<unknown>

  const selectChain = {
    from: (table: unknown) => {
      selectFromSpy(table)
      return selectChain
    },
    innerJoin: (table: unknown, cond: unknown) => {
      innerJoinSpy(table, cond)
      return selectChain
    },
    where: (cond: unknown) => {
      selectWhereSpy(cond)
      return selectChain
    },
    limit: (n: number) => selectLimitSpy(n),
  }

  const makeInsertChain = () => ({
    values: (vals: unknown) => {
      insertValuesSpy(vals)
      const p: Promise<unknown[]> & {
        onConflictDoNothing?: typeof onConflictDoNothingSpy
      } = Promise.resolve([])
      p.onConflictDoNothing = onConflictDoNothingSpy
      return p
    },
  })

  const makeUpdateChain = () => ({
    set: (vals: unknown) => {
      updateSetSpy(vals)
      return {
        where: (cond: unknown) => {
          updateWhereSpy(cond)
          const thenable: { returning: AnyFn; then: Then } = {
            returning: (cols: unknown) => updateReturningSpy(cols),
            then: (onResolve, onReject) =>
              (updateWhereThenSpy() as Promise<unknown>).then(
                onResolve,
                onReject,
              ),
          }
          return thenable
        },
      }
    },
  })

  return {
    db: {
      select: (cols?: unknown) => {
        selectColumnsSpy(cols)
        return selectChain
      },
      insert: (table: unknown) => {
        insertTableSpy(table)
        return makeInsertChain()
      },
      update: (table: unknown) => {
        updateTableSpy(table)
        return makeUpdateChain()
      },
    },
  }
})

// ── Import the SUT after all mocks are in place ─────────────────────────────
const {
  markStaleRunners,
  watchdogJobs,
  requeueLostJobs,
  expireTerminalSessions,
} = await import("../../src/workers/watchdog")

beforeEach(() => {
  selectColumnsSpy.mockReset()
  selectFromSpy.mockReset()
  innerJoinSpy.mockReset()
  selectWhereSpy.mockReset()
  selectLimitSpy.mockReset().mockResolvedValue([])
  insertTableSpy.mockReset()
  insertValuesSpy.mockReset()
  onConflictDoNothingSpy.mockReset().mockResolvedValue([])
  updateTableSpy.mockReset()
  updateSetSpy.mockReset()
  updateWhereSpy.mockReset()
  updateReturningSpy.mockReset().mockResolvedValue([])
  updateWhereThenSpy.mockReset().mockResolvedValue([])
  runnerClientJobsGetQuery
    .mockReset()
    .mockResolvedValue({ status: "unknown" })
  createRunnerClientFromDbSpy.mockReset().mockResolvedValue(mockRunnerClient)
  logInfoSpy.mockReset()
  logWarnSpy.mockReset()
  logErrorSpy.mockReset()
})

describe("watchdog.markStaleRunners", () => {
  it("flips active runners with old heartbeats to stale", async () => {
    updateReturningSpy.mockResolvedValueOnce([{ id: "r-1" }, { id: "r-2" }])

    await markStaleRunners()

    expect(updateTableSpy).toHaveBeenCalledTimes(1)
    const setArg = updateSetSpy.mock.calls[0]?.[0] as Record<string, unknown>
    expect(setArg.status).toBe("stale")
    expect(updateReturningSpy).toHaveBeenCalledTimes(1)
    // Log fires only when at least one runner was actually marked stale.
    expect(logWarnSpy).toHaveBeenCalledTimes(1)
  })

  it("does not log when no runners are stale", async () => {
    updateReturningSpy.mockResolvedValueOnce([])

    await markStaleRunners()

    expect(updateReturningSpy).toHaveBeenCalledTimes(1)
    expect(logWarnSpy).not.toHaveBeenCalled()
  })
})

describe("watchdog.watchdogJobs", () => {
  it("marks the job lost when the assigned runner is stale", async () => {
    // 1: stale-jobs select; 2: runner-status select; 3: markJobLost re-reads
    //    the job; submission/testcase id are null so requeueOrFailQueueRow
    //    is skipped.
    selectLimitSpy
      .mockResolvedValueOnce([
        {
          id: "job-1",
          runnerId: "r-1",
          submissionId: null,
          testcaseId: null,
        },
      ])
      .mockResolvedValueOnce([{ status: "stale" }])
      .mockResolvedValueOnce([
        {
          id: "job-1",
          runnerId: "r-1",
          submissionId: null,
          testcaseId: null,
        },
      ])

    await watchdogJobs()

    // markJobLost ran → executionJobs.status = "lost".
    expect(updateTableSpy).toHaveBeenCalledTimes(1)
    const setArg = updateSetSpy.mock.calls[0]?.[0] as Record<string, unknown>
    expect(setArg.status).toBe("lost")
    expect(typeof setArg.errorMessage).toBe("string")
    expect(setArg.finishedAt).toBeInstanceOf(Date)
    // The runner is stale so we never opened a runner client.
    expect(createRunnerClientFromDbSpy).not.toHaveBeenCalled()
  })

  it("marks the job lost when the runner reports status=unknown", async () => {
    selectLimitSpy
      .mockResolvedValueOnce([
        {
          id: "job-1",
          runnerId: "r-1",
          submissionId: null,
          testcaseId: null,
        },
      ])
      .mockResolvedValueOnce([{ status: "active" }])
      .mockResolvedValueOnce([
        {
          id: "job-1",
          runnerId: "r-1",
          submissionId: null,
          testcaseId: null,
        },
      ])
    runnerClientJobsGetQuery.mockResolvedValueOnce({ status: "unknown" })

    await watchdogJobs()

    expect(createRunnerClientFromDbSpy).toHaveBeenCalledWith("r-1")
    expect(runnerClientJobsGetQuery).toHaveBeenCalledWith({ job_id: "job-1" })
    // Two updates: lastPollAt bump + markJobLost's status=lost.
    expect(updateTableSpy).toHaveBeenCalledTimes(2)
    const lostSet = updateSetSpy.mock.calls[1]?.[0] as Record<string, unknown>
    expect(lostSet.status).toBe("lost")
  })

  it("does nothing when no stale jobs are found", async () => {
    selectLimitSpy.mockResolvedValueOnce([])

    await watchdogJobs()

    expect(updateTableSpy).not.toHaveBeenCalled()
    expect(createRunnerClientFromDbSpy).not.toHaveBeenCalled()
  })
})

describe("watchdog.requeueLostJobs", () => {
  it("re-queues orphaned queue rows when attempts < MAX_ATTEMPTS", async () => {
    selectLimitSpy
      .mockResolvedValueOnce([
        {
          jobId: "job-1",
          submissionId: 1,
          testcaseId: 1,
          errorMessage: "lost — runner crashed",
        },
      ])
      .mockResolvedValueOnce([{ attempts: 1 }])

    await requeueLostJobs()

    // requeueOrFailQueueRow took the pending branch:
    //   update(submissionTestcaseQueue).set({status:"pending", ...})
    expect(updateTableSpy).toHaveBeenCalledTimes(1)
    const setArg = updateSetSpy.mock.calls[0]?.[0] as Record<string, unknown>
    expect(setArg.status).toBe("pending")
    expect(setArg.claimedAt).toBeNull()
    expect(setArg.claimedBy).toBeNull()
    expect(setArg.lastError).toBe("lost — runner crashed")
    // No synthetic-fail insert when re-queueing.
    expect(insertTableSpy).not.toHaveBeenCalled()
  })

  it("inserts a synthetic fail + marks the queue row failed at MAX_ATTEMPTS", async () => {
    selectLimitSpy
      .mockResolvedValueOnce([
        {
          jobId: "job-1",
          submissionId: 1,
          testcaseId: 1,
          errorMessage: "lost",
        },
      ])
      .mockResolvedValueOnce([{ attempts: 3 }])

    await requeueLostJobs()

    expect(insertTableSpy).toHaveBeenCalledTimes(1)
    const insertedRow = insertValuesSpy.mock.calls[0]?.[0] as Record<
      string,
      unknown
    >
    expect(insertedRow.passed).toBe(false)
    expect(insertedRow.exitCode).toBe(-1)
    expect((insertedRow.stderr as string)).toContain("max attempts exceeded")

    expect(updateTableSpy).toHaveBeenCalledTimes(1)
    const setArg = updateSetSpy.mock.calls[0]?.[0] as Record<string, unknown>
    expect(setArg.status).toBe("failed")
  })

  it("does nothing when no orphans are found", async () => {
    selectLimitSpy.mockResolvedValueOnce([])

    await requeueLostJobs()

    expect(updateTableSpy).not.toHaveBeenCalled()
    expect(insertTableSpy).not.toHaveBeenCalled()
  })
})

describe("watchdog.expireTerminalSessions", () => {
  it("soft-deletes each expired session by stamping deletedAt", async () => {
    selectLimitSpy.mockResolvedValueOnce([{ id: 1 }, { id: 2 }])

    await expireTerminalSessions()

    // One UPDATE per expired session.
    expect(updateTableSpy).toHaveBeenCalledTimes(2)
    for (const call of updateSetSpy.mock.calls) {
      const setArg = call[0] as Record<string, unknown>
      expect(setArg.deletedAt).toBeInstanceOf(Date)
    }
  })

  it("does not issue any UPDATE when nothing has expired", async () => {
    selectLimitSpy.mockResolvedValueOnce([])

    await expireTerminalSessions()

    expect(updateTableSpy).not.toHaveBeenCalled()
  })
})
