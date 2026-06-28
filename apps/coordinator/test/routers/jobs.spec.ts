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

vi.mock("@easyshell/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    trace: vi.fn(),
    fatal: vi.fn(),
    child: vi.fn(() => ({})),
  }),
}))

vi.mock("../../src/services/problems", () => ({
  getProblemSlugFromId: vi.fn().mockResolvedValue("list-files"),
  getProblemInfo: vi.fn().mockResolvedValue({
    testcases: [
      {
        id: 1,
        expected_stdout: "hello\n",
        // `expected_*` fields are optional() in problems schema — undefined
        // means "do not check this" in passed-check.ts.
        expected_stderr: undefined,
        expected_exit_code: undefined,
        expected_fs: undefined,
      },
    ],
  }),
}))

// ── Drizzle chain mock ──────────────────────────────────────────────────────
type AnyFn = (...args: unknown[]) => unknown

// SELECT chain (`db.select(cols?).from(tbl).where(cond).limit(n)` → Promise<rows[]>)
const selectColumnsSpy = vi.fn<AnyFn>()
const selectFromSpy = vi.fn<AnyFn>()
const selectWhereSpy = vi.fn<AnyFn>()
const selectLimitSpy = vi.fn<AnyFn>()

// INSERT chain (`db.insert(tbl).values(vals).onConflictDoNothing()`)
const insertTableSpy = vi.fn<AnyFn>()
const insertValuesSpy = vi.fn<AnyFn>()
const onConflictDoNothingSpy = vi.fn<AnyFn>().mockResolvedValue([])

// UPDATE chain (`db.update(tbl).set(vals).where(cond)`)
const updateTableSpy = vi.fn<AnyFn>()
const updateSetSpy = vi.fn<AnyFn>()
const updateWhereSpy = vi.fn<AnyFn>().mockResolvedValue([])

vi.mock("../../src/db", () => {
  const selectChain = {
    from: (table: unknown) => {
      selectFromSpy(table)
      return selectChain
    },
    where: (cond: unknown) => {
      selectWhereSpy(cond)
      return selectChain
    },
    limit: (n: number) => selectLimitSpy(n),
  }
  const insertChain = {
    values: (vals: unknown) => {
      insertValuesSpy(vals)
      const p: Promise<unknown[]> & {
        onConflictDoNothing?: typeof onConflictDoNothingSpy
      } = Promise.resolve([])
      p.onConflictDoNothing = onConflictDoNothingSpy
      return p
    },
  }
  const updateChain = {
    set: (vals: unknown) => {
      updateSetSpy(vals)
      return {
        where: (cond: unknown) => updateWhereSpy(cond),
      }
    },
  }
  return {
    db: {
      select: (cols?: unknown) => {
        selectColumnsSpy(cols)
        return selectChain
      },
      insert: (table: unknown) => {
        insertTableSpy(table)
        return insertChain
      },
      update: (table: unknown) => {
        updateTableSpy(table)
        return updateChain
      },
    },
  }
})

// ── Import the SUT after mocks are registered ──────────────────────────────
const { jobsRouter } = await import("../../src/routers/jobs")

beforeEach(() => {
  selectColumnsSpy.mockReset()
  selectFromSpy.mockReset()
  selectWhereSpy.mockReset()
  selectLimitSpy.mockReset().mockResolvedValue([])
  insertTableSpy.mockReset()
  insertValuesSpy.mockReset()
  onConflictDoNothingSpy.mockReset().mockResolvedValue([])
  updateTableSpy.mockReset()
  updateSetSpy.mockReset()
  updateWhereSpy.mockReset().mockResolvedValue([])
})

const runnerCtx = { actor: "runner" as const, runnerId: "r-1" }

const successOutcome = {
  status: "succeeded" as const,
  stdout: "hello\n",
  stderr: "",
  exit_code: 0,
  fs: {},
  started_at: new Date(0).toISOString(),
  finished_at: new Date(1000).toISOString(),
}

describe("jobs.reportResult — succeeded path", () => {
  it("inserts a submission_testcase row + flips queue → finished + job → succeeded", async () => {
    // 1st select: job lookup; 2nd select: submission lookup
    selectLimitSpy
      .mockResolvedValueOnce([
        {
          id: "job-1",
          mode: "submission",
          submissionId: 1,
          testcaseId: 1,
          status: "running",
        },
      ])
      .mockResolvedValueOnce([{ problemId: 5 }])

    const caller = jobsRouter.createCaller(runnerCtx)
    const result = await caller.reportResult({
      job_id: "job-1",
      outcome: successOutcome,
    })

    expect(result).toEqual({ acked: true })

    // INSERT submission_testcases (via .values().onConflictDoNothing())
    expect(insertTableSpy).toHaveBeenCalledTimes(1)
    expect(insertValuesSpy).toHaveBeenCalledTimes(1)
    expect(onConflictDoNothingSpy).toHaveBeenCalledTimes(1)
    const insertedRow = insertValuesSpy.mock.calls[0]?.[0] as Record<
      string,
      unknown
    >
    expect(insertedRow.submissionId).toBe(1)
    expect(insertedRow.testcaseId).toBe(1)
    expect(insertedRow.stdout).toBe("hello\n")
    expect(insertedRow.exitCode).toBe(0)
    expect(insertedRow.passed).toBe(true) // expected_stdout matches

    // TWO updates: queue then executionJobs
    expect(updateTableSpy).toHaveBeenCalledTimes(2)
    const queueSet = updateSetSpy.mock.calls[0]?.[0] as Record<string, unknown>
    expect(queueSet.status).toBe("finished")
    const jobSet = updateSetSpy.mock.calls[1]?.[0] as Record<string, unknown>
    expect(jobSet.status).toBe("succeeded")
  })
})

describe("jobs.reportResult — failed path", () => {
  it("requeues queue row when attempts < MAX_ATTEMPTS", async () => {
    selectLimitSpy
      .mockResolvedValueOnce([
        {
          id: "job-1",
          mode: "submission",
          submissionId: 1,
          testcaseId: 1,
          status: "running",
        },
      ])
      .mockResolvedValueOnce([{ attempts: 1 }])

    const caller = jobsRouter.createCaller(runnerCtx)
    await caller.reportResult({
      job_id: "job-1",
      outcome: { status: "failed", error: "boom" },
    })

    // No synthetic-fail insert when re-queueing
    expect(insertTableSpy).not.toHaveBeenCalled()

    // Two updates: queue → pending, executionJobs → failed
    expect(updateTableSpy).toHaveBeenCalledTimes(2)
    const queueSet = updateSetSpy.mock.calls[0]?.[0] as Record<string, unknown>
    expect(queueSet.status).toBe("pending")
    expect(queueSet.claimedAt).toBeNull()
    expect(queueSet.claimedBy).toBeNull()
    expect(queueSet.lastError).toBe("boom")

    const jobSet = updateSetSpy.mock.calls[1]?.[0] as Record<string, unknown>
    expect(jobSet.status).toBe("failed")
    expect(jobSet.errorMessage).toBe("boom")
  })

  it("writes synthetic fail + sets queue → failed at MAX_ATTEMPTS", async () => {
    selectLimitSpy
      .mockResolvedValueOnce([
        {
          id: "job-1",
          mode: "submission",
          submissionId: 1,
          testcaseId: 1,
          status: "running",
        },
      ])
      .mockResolvedValueOnce([{ attempts: 3 }]) // env.MAX_ATTEMPTS = 3

    const caller = jobsRouter.createCaller(runnerCtx)
    await caller.reportResult({
      job_id: "job-1",
      outcome: { status: "failed", error: "kaboom" },
    })

    // Synthetic fail row inserted
    expect(insertTableSpy).toHaveBeenCalledTimes(1)
    expect(insertValuesSpy).toHaveBeenCalledTimes(1)
    const insertedRow = insertValuesSpy.mock.calls[0]?.[0] as Record<
      string,
      unknown
    >
    expect(insertedRow.passed).toBe(false)
    expect(insertedRow.exitCode).toBe(-1)
    expect((insertedRow.stderr as string)).toContain("max attempts exceeded")

    // Queue → failed (not pending), executionJobs → failed
    expect(updateTableSpy).toHaveBeenCalledTimes(2)
    const queueSet = updateSetSpy.mock.calls[0]?.[0] as Record<string, unknown>
    expect(queueSet.status).toBe("failed")
  })
})

describe("jobs.reportResult — cancelled path", () => {
  it("marks executionJobs as cancelled", async () => {
    selectLimitSpy.mockResolvedValueOnce([
      {
        id: "job-1",
        mode: "submission",
        submissionId: 1,
        testcaseId: 1,
        status: "running",
      },
    ])

    const caller = jobsRouter.createCaller(runnerCtx)
    await caller.reportResult({
      job_id: "job-1",
      outcome: { status: "cancelled" },
    })

    // Only the execution job is updated; queue is untouched
    expect(updateTableSpy).toHaveBeenCalledTimes(1)
    const jobSet = updateSetSpy.mock.calls[0]?.[0] as Record<string, unknown>
    expect(jobSet.status).toBe("cancelled")
    expect(insertTableSpy).not.toHaveBeenCalled()
  })
})

describe("jobs.reportResult — idempotency", () => {
  it("is a no-op when the job is already in a terminal state", async () => {
    selectLimitSpy.mockResolvedValueOnce([
      {
        id: "job-1",
        mode: "submission",
        submissionId: 1,
        testcaseId: 1,
        status: "succeeded", // already terminal
      },
    ])

    const caller = jobsRouter.createCaller(runnerCtx)
    const result = await caller.reportResult({
      job_id: "job-1",
      outcome: successOutcome,
    })

    expect(result).toEqual({ acked: true })
    // The initial select for the job is the only DB call.
    expect(insertTableSpy).not.toHaveBeenCalled()
    expect(updateTableSpy).not.toHaveBeenCalled()
  })

  it("acks gracefully when the job row is missing", async () => {
    selectLimitSpy.mockResolvedValueOnce([]) // job not found

    const caller = jobsRouter.createCaller(runnerCtx)
    const result = await caller.reportResult({
      job_id: "job-missing",
      outcome: successOutcome,
    })

    expect(result).toEqual({ acked: true })
    expect(insertTableSpy).not.toHaveBeenCalled()
    expect(updateTableSpy).not.toHaveBeenCalled()
  })
})

describe("jobs.reportResult — auth", () => {
  it("rejects when actor is not runner (UNAUTHORIZED)", async () => {
    const caller = jobsRouter.createCaller({ actor: "unauth" })
    await expect(
      caller.reportResult({ job_id: "job-1", outcome: successOutcome }),
    ).rejects.toThrow(/Runner credentials required|UNAUTHORIZED/)
  })

  it("rejects when runnerId is missing (UNAUTHORIZED)", async () => {
    const caller = jobsRouter.createCaller({ actor: "runner" })
    await expect(
      caller.reportResult({ job_id: "job-1", outcome: successOutcome }),
    ).rejects.toThrow(/Runner credentials required|UNAUTHORIZED/)
  })
})

describe("jobs.reportProgress", () => {
  it("maps state=accepted → status=accepted in the UPDATE", async () => {
    const caller = jobsRouter.createCaller(runnerCtx)
    const result = await caller.reportProgress({
      job_id: "job-1",
      state: "accepted",
    })

    expect(result).toEqual({ acked: true })
    expect(updateTableSpy).toHaveBeenCalledTimes(1)
    const setArg = updateSetSpy.mock.calls[0]?.[0] as Record<string, unknown>
    expect(setArg.status).toBe("accepted")
    expect(setArg.lastPushAt).toBeInstanceOf(Date)
  })

  it("maps state=running → status=running in the UPDATE", async () => {
    const caller = jobsRouter.createCaller(runnerCtx)
    await caller.reportProgress({ job_id: "job-1", state: "running" })

    const setArg = updateSetSpy.mock.calls[0]?.[0] as Record<string, unknown>
    expect(setArg.status).toBe("running")
  })

  it("maps state=starting → status=running in the UPDATE", async () => {
    const caller = jobsRouter.createCaller(runnerCtx)
    await caller.reportProgress({ job_id: "job-1", state: "starting" })

    const setArg = updateSetSpy.mock.calls[0]?.[0] as Record<string, unknown>
    expect(setArg.status).toBe("running")
  })

  it("rejects unauthenticated callers (UNAUTHORIZED)", async () => {
    const caller = jobsRouter.createCaller({ actor: "unauth" })
    await expect(
      caller.reportProgress({ job_id: "job-1", state: "accepted" }),
    ).rejects.toThrow()
  })
})
