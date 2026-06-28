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
      { id: 1, expected_stdout: "a\n" },
      { id: 2, expected_stdout: "b\n" },
    ],
  }),
}))

// ── Drizzle chain mock ──────────────────────────────────────────────────────
type AnyFn = (...args: unknown[]) => unknown

// SELECT chain (`select(cols?).from(tbl).where(cond)[.limit(n)]`).
// Two terminators: `selectLimitSpy` (chain ends at .limit) and
// `selectWhereThenSpy` (chain ends at .where, i.e. .from(...).where(...)
// is awaited directly without .limit — used by submissions.getStatus).
const selectColumnsSpy = vi.fn<AnyFn>()
const selectFromSpy = vi.fn<AnyFn>()
const selectWhereSpy = vi.fn<AnyFn>()
const selectLimitSpy = vi.fn<AnyFn>().mockResolvedValue([])
const selectWhereThenSpy = vi.fn<AnyFn>().mockResolvedValue([])

// INSERT chain (`insert(tbl).values(vals)[.returning({...})]`).
const insertTableSpy = vi.fn<AnyFn>()
const insertValuesSpy = vi.fn<AnyFn>()
const insertReturningSpy = vi.fn<AnyFn>().mockResolvedValue([])
const insertValuesThenSpy = vi.fn<AnyFn>().mockResolvedValue([])

// UPDATE chain (`update(tbl).set(vals).where(cond)[.returning({...})]`).
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

  const selectChain: {
    from: AnyFn
    where: AnyFn
    limit: AnyFn
    then: Then
  } = {
    from: (table: unknown) => {
      selectFromSpy(table)
      return selectChain
    },
    where: (cond: unknown) => {
      selectWhereSpy(cond)
      return selectChain
    },
    limit: (n: unknown) => selectLimitSpy(n),
    then: (onResolve, onReject) =>
      (selectWhereThenSpy() as Promise<unknown>).then(onResolve, onReject),
  }

  const makeInsertChain = () => ({
    values: (vals: unknown) => {
      insertValuesSpy(vals)
      const thenable: {
        returning: AnyFn
        then: Then
      } = {
        returning: (cols: unknown) => insertReturningSpy(cols),
        then: (onResolve, onReject) =>
          (insertValuesThenSpy() as Promise<unknown>).then(onResolve, onReject),
      }
      return thenable
    },
  })

  const makeUpdateChain = () => ({
    set: (vals: unknown) => {
      updateSetSpy(vals)
      return {
        where: (cond: unknown) => {
          updateWhereSpy(cond)
          const thenable: {
            returning: AnyFn
            then: Then
          } = {
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

// ── Import the SUT after mocks are registered ──────────────────────────────
const { submissionsRouter } = await import("../../src/routers/submissions")

beforeEach(() => {
  selectColumnsSpy.mockReset()
  selectFromSpy.mockReset()
  selectWhereSpy.mockReset()
  selectLimitSpy.mockReset().mockResolvedValue([])
  selectWhereThenSpy.mockReset().mockResolvedValue([])
  insertTableSpy.mockReset()
  insertValuesSpy.mockReset()
  insertReturningSpy.mockReset().mockResolvedValue([])
  insertValuesThenSpy.mockReset().mockResolvedValue([])
  updateTableSpy.mockReset()
  updateSetSpy.mockReset()
  updateWhereSpy.mockReset()
  updateReturningSpy.mockReset().mockResolvedValue([])
  updateWhereThenSpy.mockReset().mockResolvedValue([])
})

const websiteCtx = { actor: "website" as const }

describe("submissions.enqueue", () => {
  it("inserts 1 submission row + 1 queue row per testcase", async () => {
    insertReturningSpy.mockResolvedValueOnce([{ id: 42 }])

    const caller = submissionsRouter.createCaller(websiteCtx)
    const result = await caller.enqueue({
      user_id: "u-1",
      problem_id: 7,
      input: "echo hi",
    })

    expect(result).toEqual({ submission_id: 42, testcase_count: 2 })

    // 1 submissions insert + 2 queue inserts = 3 insertTableSpy calls.
    expect(insertTableSpy).toHaveBeenCalledTimes(3)
    expect(insertReturningSpy).toHaveBeenCalledTimes(1)

    // Submission row body
    const submissionRow = insertValuesSpy.mock.calls[0]?.[0] as Record<
      string,
      unknown
    >
    expect(submissionRow.userId).toBe("u-1")
    expect(submissionRow.problemId).toBe(7)
    expect(submissionRow.input).toBe("echo hi")

    // Queue rows reference the testcase ids.
    const queueRow1 = insertValuesSpy.mock.calls[1]?.[0] as Record<
      string,
      unknown
    >
    const queueRow2 = insertValuesSpy.mock.calls[2]?.[0] as Record<
      string,
      unknown
    >
    expect(queueRow1.submissionId).toBe(42)
    expect(queueRow1.testcaseId).toBe(1)
    expect(queueRow1.status).toBe("pending")
    expect(queueRow2.testcaseId).toBe(2)
  })
})

describe("submissions.retryTestcase", () => {
  it("queues retry when the queue row is failed and the user matches", async () => {
    // 1st select: submission lookup; 2nd select: queue row lookup.
    selectLimitSpy
      .mockResolvedValueOnce([{ userId: "u-1" }])
      .mockResolvedValueOnce([{ status: "failed", lastError: "boom" }])

    const caller = submissionsRouter.createCaller(websiteCtx)
    const result = await caller.retryTestcase({
      acting_user_id: "u-1",
      submission_id: 10,
      testcase_id: 1,
    })

    expect(result).toEqual({ status: "queued" })
    expect(updateTableSpy).toHaveBeenCalledTimes(1)
    const setArg = updateSetSpy.mock.calls[0]?.[0] as Record<string, unknown>
    expect(setArg.status).toBe("pending")
    expect(setArg.attempts).toBe(0)
    expect(setArg.lastError).toBeNull()
    expect(setArg.claimedAt).toBeNull()
    expect(setArg.claimedBy).toBeNull()
  })

  it("returns forbidden when acting_user_id != submission.userId", async () => {
    selectLimitSpy.mockResolvedValueOnce([{ userId: "u-1" }])

    const caller = submissionsRouter.createCaller(websiteCtx)
    const result = await caller.retryTestcase({
      acting_user_id: "u-other",
      submission_id: 10,
      testcase_id: 1,
    })

    expect(result).toEqual({ status: "forbidden" })
    expect(updateTableSpy).not.toHaveBeenCalled()
  })

  it("returns not_found when the submission row is missing", async () => {
    selectLimitSpy.mockResolvedValueOnce([])

    const caller = submissionsRouter.createCaller(websiteCtx)
    const result = await caller.retryTestcase({
      acting_user_id: "u-1",
      submission_id: 999,
      testcase_id: 1,
    })

    expect(result).toEqual({ status: "not_found" })
    expect(updateTableSpy).not.toHaveBeenCalled()
  })

  it("returns not_failed when the queue row status is not failed", async () => {
    selectLimitSpy
      .mockResolvedValueOnce([{ userId: "u-1" }])
      .mockResolvedValueOnce([{ status: "pending", lastError: null }])

    const caller = submissionsRouter.createCaller(websiteCtx)
    const result = await caller.retryTestcase({
      acting_user_id: "u-1",
      submission_id: 10,
      testcase_id: 1,
    })

    expect(result).toEqual({ status: "not_failed" })
    expect(updateTableSpy).not.toHaveBeenCalled()
  })
})

describe("submissions.retryAllFailedForSubmission", () => {
  it("returns the number of re-queued testcases on success", async () => {
    selectLimitSpy.mockResolvedValueOnce([{ userId: "u-1" }])
    updateReturningSpy.mockResolvedValueOnce([
      { testcaseId: 1 },
      { testcaseId: 2 },
    ])

    const caller = submissionsRouter.createCaller(websiteCtx)
    const result = await caller.retryAllFailedForSubmission({
      acting_user_id: "u-1",
      submission_id: 10,
    })

    expect(result).toEqual({ status: "queued", requeued_count: 2 })
    expect(updateTableSpy).toHaveBeenCalledTimes(1)
    const setArg = updateSetSpy.mock.calls[0]?.[0] as Record<string, unknown>
    expect(setArg.status).toBe("pending")
    expect(setArg.attempts).toBe(0)
  })

  it("returns forbidden for a non-owner", async () => {
    selectLimitSpy.mockResolvedValueOnce([{ userId: "u-1" }])

    const caller = submissionsRouter.createCaller(websiteCtx)
    const result = await caller.retryAllFailedForSubmission({
      acting_user_id: "intruder",
      submission_id: 10,
    })

    expect(result).toEqual({ status: "forbidden" })
    expect(updateTableSpy).not.toHaveBeenCalled()
  })

  it("returns not_found when the submission row is missing", async () => {
    selectLimitSpy.mockResolvedValueOnce([])

    const caller = submissionsRouter.createCaller(websiteCtx)
    const result = await caller.retryAllFailedForSubmission({
      acting_user_id: "u-1",
      submission_id: 999,
    })

    expect(result).toEqual({ status: "not_found" })
  })
})

describe("submissions.getStatus", () => {
  it("merges queue rows with testcase results into a single payload", async () => {
    // Both selects terminate at .where() (no .limit) — these awaits hit
    // selectWhereThenSpy.
    selectWhereThenSpy
      .mockResolvedValueOnce([
        {
          testcaseId: 1,
          status: "finished",
          attempts: 1,
          lastError: null,
        },
        {
          testcaseId: 2,
          status: "failed",
          attempts: 3,
          lastError: "boom",
        },
      ])
      .mockResolvedValueOnce([
        { testcaseId: 1, passed: true },
        { testcaseId: 2, passed: false },
      ])

    const caller = submissionsRouter.createCaller(websiteCtx)
    const result = await caller.getStatus({ submission_id: 10 })

    expect(result.submission_id).toBe(10)
    expect(result.testcases).toHaveLength(2)
    expect(result.testcases[0]).toEqual({
      testcase_id: 1,
      status: "finished",
      attempts: 1,
      last_error: null,
      passed: true,
    })
    expect(result.testcases[1]).toEqual({
      testcase_id: 2,
      status: "failed",
      attempts: 3,
      last_error: "boom",
      passed: false,
    })
  })

  it("returns null for `passed` when there is no testcase result row yet", async () => {
    selectWhereThenSpy
      .mockResolvedValueOnce([
        {
          testcaseId: 1,
          status: "running",
          attempts: 1,
          lastError: null,
        },
      ])
      .mockResolvedValueOnce([])

    const caller = submissionsRouter.createCaller(websiteCtx)
    const result = await caller.getStatus({ submission_id: 10 })

    expect(result.testcases[0]?.passed).toBeNull()
  })
})

describe("submissions auth", () => {
  it("rejects a non-website caller (UNAUTHORIZED)", async () => {
    const caller = submissionsRouter.createCaller({
      actor: "runner",
      runnerId: "r-1",
    })
    await expect(
      caller.enqueue({ user_id: "u-1", problem_id: 7, input: "echo hi" }),
    ).rejects.toThrow(/Website token required|UNAUTHORIZED/)
  })

  it("rejects an unauthenticated caller (UNAUTHORIZED)", async () => {
    const caller = submissionsRouter.createCaller({ actor: "unauth" })
    await expect(caller.getStatus({ submission_id: 1 })).rejects.toThrow()
  })
})
