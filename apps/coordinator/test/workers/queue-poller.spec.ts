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

vi.mock("@easyshell/utils", () => ({
  sleep: vi.fn().mockResolvedValue(undefined),
}))

const getProblemSlugFromIdSpy = vi.fn<(id: number) => Promise<string>>()
vi.mock("../../src/services/problems", () => ({
  getProblemSlugFromId: (id: number) => getProblemSlugFromIdSpy(id),
}))

const insertExecutionJobSpy =
  vi.fn<(tx: unknown, params: Record<string, unknown>) => Promise<void>>()
vi.mock("../../src/services/jobs", () => ({
  insertExecutionJob: (tx: unknown, params: Record<string, unknown>) =>
    insertExecutionJobSpy(tx, params),
}))

vi.mock("../../src/services/job-name", () => ({
  generateContainerName: vi.fn(() => "easyshell-test-container"),
}))

// ── Drizzle chain mock ──────────────────────────────────────────────────────
type AnyFn = (...args: unknown[]) => unknown

// CTE-style chain (`db.with(...).update(...).set(...).where(...).returning(...)`)
const cteReturningSpy = vi.fn<AnyFn>()
const cteUpdateSpy = vi.fn<AnyFn>()
const cteSetSpy = vi.fn<AnyFn>()
const cteWhereSpy = vi.fn<AnyFn>()
const withSpy = vi.fn<AnyFn>()

// Select chain (`db.select(...).from(...).where(...).limit(...)`)
const selectLimitSpy = vi.fn<AnyFn>()
const selectFromSpy = vi.fn<AnyFn>()
const selectWhereSpy = vi.fn<AnyFn>()
const selectColumnsSpy = vi.fn<AnyFn>()

// Plain update chain (revertQueueItem: `db.update(...).set(...).where(...)`)
const updateTableSpy = vi.fn<AnyFn>()
const updateSetSpy = vi.fn<AnyFn>()
const updateWhereSpy = vi.fn<AnyFn>()

// Transaction
const transactionSpy = vi.fn<AnyFn>()

// `$with("item").as(...)` returns a stub that satisfies later property
// reads (`item.submissionId`, `item.testcaseId`) and SQL template
// interpolation. Drizzle never renders these in unit tests because we
// stop at the chain boundary.
const itemStub = {
  submissionId: { __mock: "submissionId" },
  testcaseId: { __mock: "testcaseId" },
}

const dollarWithSpy = vi.fn((_name: string) => ({
  as: vi.fn((_query: unknown) => itemStub),
}))

vi.mock("../../src/db", () => {
  const cteChain = {
    update: (table: unknown) => {
      cteUpdateSpy(table)
      return cteChain
    },
    set: (vals: unknown) => {
      cteSetSpy(vals)
      return cteChain
    },
    where: (cond: unknown) => {
      cteWhereSpy(cond)
      return cteChain
    },
    returning: (cols: unknown) => cteReturningSpy(cols),
  }

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
      $with: (name: string) => dollarWithSpy(name),
      with: (item: unknown) => {
        withSpy(item)
        return cteChain
      },
      select: (cols: unknown) => {
        selectColumnsSpy(cols)
        return selectChain
      },
      update: (table: unknown) => {
        updateTableSpy(table)
        return updateChain
      },
      transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
        transactionSpy(fn)
        const tx = { __mock: "tx" }
        return fn(tx)
      },
    },
  }
})

// ── Import the SUT after all mocks are in place ─────────────────────────────
const {
  claimNextQueueItem,
  processClaimedItem,
  revertQueueItem,
  startQueuePoller,
} = await import("../../src/workers/queue-poller")

beforeEach(() => {
  cteReturningSpy.mockReset().mockResolvedValue([])
  cteUpdateSpy.mockReset()
  cteSetSpy.mockReset()
  cteWhereSpy.mockReset()
  withSpy.mockReset()
  selectLimitSpy.mockReset().mockResolvedValue([])
  selectFromSpy.mockReset()
  selectWhereSpy.mockReset()
  selectColumnsSpy.mockReset()
  updateTableSpy.mockReset()
  updateSetSpy.mockReset()
  updateWhereSpy.mockReset().mockResolvedValue([])
  transactionSpy.mockReset()
  dollarWithSpy.mockClear()
  getProblemSlugFromIdSpy.mockReset().mockResolvedValue("test-slug")
  insertExecutionJobSpy.mockReset().mockResolvedValue(undefined)
})

describe("module exports", () => {
  it("exports startQueuePoller as a function", () => {
    expect(typeof startQueuePoller).toBe("function")
  })

  it("exports claimNextQueueItem, processClaimedItem, revertQueueItem", () => {
    expect(typeof claimNextQueueItem).toBe("function")
    expect(typeof processClaimedItem).toBe("function")
    expect(typeof revertQueueItem).toBe("function")
  })
})

describe("claimNextQueueItem", () => {
  it("returns null when the CTE update finds no `pending` rows", async () => {
    cteReturningSpy.mockResolvedValueOnce([])
    const result = await claimNextQueueItem()
    expect(result).toBeNull()
    expect(cteReturningSpy).toHaveBeenCalledTimes(1)
    // Second select (for submission lookup) must NOT have been called.
    // selectLimitSpy is still called once for the inner CTE select that
    // gets wrapped in `$with(...).as(...)` (its return is discarded), so
    // assert exactly one call.
    expect(selectLimitSpy).toHaveBeenCalledTimes(1)
  })

  it("returns a fully-formed claim when a pending row exists", async () => {
    cteReturningSpy.mockResolvedValueOnce([
      { submissionId: 42, testcaseId: 7, attempts: 1 },
    ])
    // 1st selectLimitSpy call: inner CTE select (discarded by `.as(...)`).
    // 2nd selectLimitSpy call: submission lookup.
    selectLimitSpy
      .mockResolvedValueOnce([]) // inner CTE select — value ignored
      .mockResolvedValueOnce([{ input: "ls -la", problemId: 5 }])

    getProblemSlugFromIdSpy.mockResolvedValueOnce("list-files")

    const result = await claimNextQueueItem()
    expect(result).not.toBeNull()
    expect(result?.submissionId).toBe(42)
    expect(result?.testcaseId).toBe(7)
    expect(result?.input).toBe("ls -la")
    expect(result?.image).toBe("easyshell-list-files-7")
    expect(result?.containerName).toBe("easyshell-test-container")
    expect(result?.jobId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    )
  })

  it("sets attempts++, claimedAt, claimedBy, updatedAt in the UPDATE", async () => {
    cteReturningSpy.mockResolvedValueOnce([
      { submissionId: 1, testcaseId: 1, attempts: 1 },
    ])
    selectLimitSpy
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ input: "x", problemId: 1 }])

    const before = Date.now()
    const result = await claimNextQueueItem()
    const after = Date.now()

    expect(result).not.toBeNull()
    expect(cteSetSpy).toHaveBeenCalledTimes(1)
    const setArg = cteSetSpy.mock.calls[0]?.[0] as Record<string, unknown>
    expect(setArg.status).toBe("running")
    expect(setArg.claimedAt).toBeInstanceOf(Date)
    expect((setArg.claimedAt as Date).getTime()).toBeGreaterThanOrEqual(before)
    expect((setArg.claimedAt as Date).getTime()).toBeLessThanOrEqual(after)
    expect(setArg.updatedAt).toBeInstanceOf(Date)
    expect(setArg.claimedBy).toBe(result?.jobId)
    // `attempts` is set to an SQL expression (sql`... + 1`) — just assert
    // it is defined and not a plain number.
    expect(setArg.attempts).toBeDefined()
    expect(typeof setArg.attempts).not.toBe("number")
  })

  it("throws when the claimed submission row is missing", async () => {
    cteReturningSpy.mockResolvedValueOnce([
      { submissionId: 99, testcaseId: 1, attempts: 1 },
    ])
    selectLimitSpy
      .mockResolvedValueOnce([]) // inner CTE
      .mockResolvedValueOnce([]) // submission lookup → empty

    await expect(claimNextQueueItem()).rejects.toThrow(/Submission 99 not found/)
  })
})

describe("revertQueueItem", () => {
  it("resets the row to pending and clears the claim columns", async () => {
    await revertQueueItem(7, 3, "container died")

    expect(updateTableSpy).toHaveBeenCalledTimes(1)
    expect(updateSetSpy).toHaveBeenCalledTimes(1)
    expect(updateWhereSpy).toHaveBeenCalledTimes(1)

    const setArg = updateSetSpy.mock.calls[0]?.[0] as Record<string, unknown>
    expect(setArg.status).toBe("pending")
    expect(setArg.lastError).toBe("container died")
    expect(setArg.claimedAt).toBeNull()
    expect(setArg.claimedBy).toBeNull()
    expect(setArg.updatedAt).toBeInstanceOf(Date)
    // attempts is rolled back via SQL expression GREATEST(... - 1, 0).
    expect(setArg.attempts).toBeDefined()
    expect(typeof setArg.attempts).not.toBe("number")
  })
})

describe("processClaimedItem", () => {
  const fakeClaim = {
    jobId: "job-123",
    containerName: "easyshell-container-abc",
    submissionId: 1,
    testcaseId: 2,
    input: "echo hi",
    image: "easyshell-greeting-2",
  }

  it("inserts an execution_job row inside a transaction on success", async () => {
    await processClaimedItem(fakeClaim)

    expect(transactionSpy).toHaveBeenCalledTimes(1)
    expect(insertExecutionJobSpy).toHaveBeenCalledTimes(1)

    const [, params] = insertExecutionJobSpy.mock.calls[0] ?? []
    expect(params).toMatchObject({
      id: "job-123",
      containerName: "easyshell-container-abc",
      // T14 will replace this placeholder with a real runner id.
      runnerId: "unassigned",
      mode: "submission",
      image: "easyshell-greeting-2",
      submissionId: 1,
      testcaseId: 2,
      attempt: 1,
    })
  })

  it("reverts the queue row when the transaction throws", async () => {
    insertExecutionJobSpy.mockRejectedValueOnce(new Error("FK violation"))

    // processClaimedItem must NOT propagate — it handles failures internally
    // by reverting the queue row.
    await expect(processClaimedItem(fakeClaim)).resolves.toBeUndefined()

    // The revert path goes through `db.update(...).set(...).where(...)`.
    expect(updateTableSpy).toHaveBeenCalledTimes(1)
    const setArg = updateSetSpy.mock.calls[0]?.[0] as Record<string, unknown>
    expect(setArg.status).toBe("pending")
    expect(setArg.lastError).toBe("FK violation")
  })

  it("stringifies non-Error throwables when reverting", async () => {
    insertExecutionJobSpy.mockRejectedValueOnce("boom-string")

    await processClaimedItem(fakeClaim)

    const setArg = updateSetSpy.mock.calls[0]?.[0] as Record<string, unknown>
    expect(setArg.lastError).toBe("boom-string")
  })
})
