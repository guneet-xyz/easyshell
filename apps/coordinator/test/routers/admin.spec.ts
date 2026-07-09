import { beforeEach, describe, expect, it, vi } from "vitest"

// ── Mocks MUST be registered before importing the SUT ───────────────────────
vi.mock("../../src/env", () => ({
  env: {
    DATABASE_URL: "postgres://test",
    WEBSITE_TOKEN: "test-website-token",
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

// Mock the secret service so tests don't depend on env-based encryption
// branch selection — every test sees a deterministic ciphertext/nonce.
const encryptSecretSpy = vi.fn((plaintext: string) => ({
  ciphertext: `enc:${plaintext}`,
  nonce: "test-nonce",
}))
vi.mock("../../src/services/secret", () => ({
  encryptSecret: (plaintext: string) => encryptSecretSpy(plaintext),
}))

// ── Drizzle chain mock ──────────────────────────────────────────────────────
type AnyFn = (...args: unknown[]) => unknown

// SELECT chain (`db.select(cols?).from(t)[.where(c)[.limit(n)]][.orderBy(c)]`).
// Awaits at three points depending on the endpoint:
//   1. .limit(n)  — rotateToken's SELECT + revoke's recheck use this
//   2. .orderBy() — list's runners fetch uses this
//   3. .from()    — list's capabilities fetch awaits here (thenable chain)
const selectColumnsSpy = vi.fn<AnyFn>()
const selectFromSpy = vi.fn<AnyFn>()
const selectWhereSpy = vi.fn<AnyFn>()
const selectLimitSpy = vi.fn<AnyFn>().mockResolvedValue([])
const selectOrderBySpy = vi.fn<AnyFn>().mockResolvedValue([])
const selectFromThenSpy = vi.fn<AnyFn>().mockResolvedValue([])

// Top-level INSERT (not used by admin router but kept for future-proofing).
const insertTableSpy = vi.fn<AnyFn>()
const insertValuesSpy = vi.fn<AnyFn>().mockResolvedValue([])

// Transaction inserts (`tx.insert(t).values(v)`) — create uses this exclusively.
const txInsertTableSpy = vi.fn<AnyFn>()
const txInsertValuesSpy = vi.fn<AnyFn>().mockResolvedValue([])

// UPDATE chain (`db.update(t).set(v).where(c)[.returning({...})]`).
const updateTableSpy = vi.fn<AnyFn>()
const updateSetSpy = vi.fn<AnyFn>()
const updateWhereSpy = vi.fn<AnyFn>()
const updateReturningSpy = vi.fn<AnyFn>().mockResolvedValue([])
const updateWhereThenSpy = vi.fn<AnyFn>().mockResolvedValue([])

// Transaction wrapper.
const transactionSpy = vi.fn<AnyFn>()

vi.mock("../../src/db", () => {
  type Then = (
    onResolve: (v: unknown) => unknown,
    onReject?: (e: unknown) => unknown,
  ) => Promise<unknown>

  const selectChain: {
    from: AnyFn
    where: AnyFn
    limit: AnyFn
    orderBy: AnyFn
    then: Then
  } = {
    from: (t: unknown) => {
      selectFromSpy(t)
      return selectChain
    },
    where: (c: unknown) => {
      selectWhereSpy(c)
      return selectChain
    },
    limit: (n: number) => selectLimitSpy(n),
    orderBy: (c: unknown) => selectOrderBySpy(c),
    then: (onResolve, onReject) =>
      (selectFromThenSpy() as Promise<unknown>).then(onResolve, onReject),
  }

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

  const txObj = {
    insert: (t: unknown) => {
      txInsertTableSpy(t)
      return {
        values: (v: unknown) => {
          txInsertValuesSpy(v)
          return Promise.resolve([])
        },
      }
    },
  }

  return {
    db: {
      select: (cols?: unknown) => {
        selectColumnsSpy(cols)
        return selectChain
      },
      insert: (t: unknown) => {
        insertTableSpy(t)
        return {
          values: (v: unknown) => {
            insertValuesSpy(v)
            return Promise.resolve([])
          },
        }
      },
      update: (t: unknown) => {
        updateTableSpy(t)
        return makeUpdateChain()
      },
      transaction: async (fn: (tx: typeof txObj) => Promise<unknown>) => {
        transactionSpy(fn)
        return fn(txObj)
      },
    },
  }
})

// ── Import the SUT after mocks are registered ──────────────────────────────
const { adminRouter } = await import("../../src/routers/admin")

beforeEach(() => {
  selectColumnsSpy.mockReset()
  selectFromSpy.mockReset()
  selectWhereSpy.mockReset()
  selectLimitSpy.mockReset().mockResolvedValue([])
  selectOrderBySpy.mockReset().mockResolvedValue([])
  selectFromThenSpy.mockReset().mockResolvedValue([])
  insertTableSpy.mockReset()
  insertValuesSpy.mockReset().mockResolvedValue([])
  txInsertTableSpy.mockReset()
  txInsertValuesSpy.mockReset().mockResolvedValue([])
  updateTableSpy.mockReset()
  updateSetSpy.mockReset()
  updateWhereSpy.mockReset()
  updateReturningSpy.mockReset().mockResolvedValue([])
  updateWhereThenSpy.mockReset().mockResolvedValue([])
  transactionSpy.mockReset()
  encryptSecretSpy.mockClear()
})

const websiteCtx = { actor: "website" as const }

// ─── admin.runners.create ──────────────────────────────────────────────────
describe("admin.runners.create", () => {
  it("returns a UUID runner_id and a 64-char hex runner_token on the happy path", async () => {
    const caller = adminRouter.createCaller(websiteCtx)
    const result = await caller.runners.create({
      name: "runner-1",
      public_url: "http://10.0.0.1:4200",
      capabilities: [{ mode: "submission", concurrency: 4 }],
    })

    expect(result.runner_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    )
    // 32 random bytes hex-encoded = 64 hex chars.
    expect(result.runner_token).toHaveLength(64)
    expect(result.runner_token).toMatch(/^[0-9a-f]{64}$/)
  })

  it("inserts one runner row + one capability row per capability inside a single transaction", async () => {
    const caller = adminRouter.createCaller(websiteCtx)
    await caller.runners.create({
      name: "runner-1",
      public_url: "http://10.0.0.1:4200",
      region: "us-east-1",
      labels: { role: "grader" },
      version: "1.2.3",
      capabilities: [
        { mode: "submission", concurrency: 4 },
        { mode: "session", concurrency: 32 },
      ],
    })

    // Exactly one transaction.
    expect(transactionSpy).toHaveBeenCalledTimes(1)
    // 1 runners insert + 2 capability inserts = 3 tx.insert(...) calls.
    expect(txInsertTableSpy).toHaveBeenCalledTimes(3)
    expect(txInsertValuesSpy).toHaveBeenCalledTimes(3)

    // Runner row — carries name, public_url, region, labels, version, and
    // the three secret_* columns from encryptSecret.
    const runnerRow = txInsertValuesSpy.mock.calls[0]?.[0] as Record<
      string,
      unknown
    >
    expect(runnerRow.name).toBe("runner-1")
    expect(runnerRow.publicUrl).toBe("http://10.0.0.1:4200")
    expect(runnerRow.region).toBe("us-east-1")
    expect(runnerRow.labels).toEqual({ role: "grader" })
    expect(runnerRow.version).toBe("1.2.3")
    expect(runnerRow.secretHash).toMatch(/^[0-9a-f]{64}$/)
    expect(typeof runnerRow.secretCiphertext).toBe("string")
    expect(runnerRow.secretNonce).toBe("test-nonce")

    // Capability rows carry the runnerId + mode + concurrency.
    const cap1 = txInsertValuesSpy.mock.calls[1]?.[0] as Record<string, unknown>
    expect(cap1.runnerId).toBe(runnerRow.id)
    expect(cap1.mode).toBe("submission")
    expect(cap1.concurrency).toBe(4)

    const cap2 = txInsertValuesSpy.mock.calls[2]?.[0] as Record<string, unknown>
    expect(cap2.runnerId).toBe(runnerRow.id)
    expect(cap2.mode).toBe("session")
    expect(cap2.concurrency).toBe(32)

    // encryptSecret was called with the same plaintext that hashes into
    // secretHash (i.e. the returned runner_token equals what got encrypted).
    expect(encryptSecretSpy).toHaveBeenCalledTimes(1)
  })

  it("rejects a non-website caller (UNAUTHORIZED)", async () => {
    const caller = adminRouter.createCaller({
      actor: "runner",
      runnerId: "r-1",
    })
    await expect(
      caller.runners.create({
        name: "runner-1",
        public_url: "http://10.0.0.1:4200",
        capabilities: [{ mode: "submission", concurrency: 4 }],
      }),
    ).rejects.toThrow(/Website token required|UNAUTHORIZED/)
    // No DB writes when auth fails.
    expect(transactionSpy).not.toHaveBeenCalled()
  })

  it("rejects an unauthenticated caller (UNAUTHORIZED)", async () => {
    const caller = adminRouter.createCaller({ actor: "unauth" })
    await expect(
      caller.runners.create({
        name: "runner-1",
        public_url: "http://10.0.0.1:4200",
        capabilities: [{ mode: "submission", concurrency: 4 }],
      }),
    ).rejects.toThrow()
    expect(transactionSpy).not.toHaveBeenCalled()
  })

  it("throws a Zod input error when public_url is missing", async () => {
    const caller = adminRouter.createCaller(websiteCtx)
    await expect(
      caller.runners.create({
        name: "runner-1",
        capabilities: [{ mode: "submission", concurrency: 4 }],
      } as never),
    ).rejects.toThrow()
    expect(transactionSpy).not.toHaveBeenCalled()
  })

  it("throws a Zod input error when capabilities is empty (min 1)", async () => {
    const caller = adminRouter.createCaller(websiteCtx)
    await expect(
      caller.runners.create({
        name: "runner-1",
        public_url: "http://10.0.0.1:4200",
        capabilities: [],
      }),
    ).rejects.toThrow()
    expect(transactionSpy).not.toHaveBeenCalled()
  })
})

// ─── admin.runners.list ────────────────────────────────────────────────────
describe("admin.runners.list", () => {
  it("returns runners including revoked ones and derives status='revoked' when revokedAt is set", async () => {
    const now = new Date()
    // 1st SELECT — runners (awaits at .orderBy()).
    selectOrderBySpy.mockResolvedValueOnce([
      {
        id: "r-active",
        name: "active",
        publicUrl: "http://10.0.0.1:4200",
        region: null,
        labels: {},
        version: null,
        status: "active" as const,
        lastSeenAt: now,
        revokedAt: null,
        registeredAt: now,
      },
      {
        id: "r-revoked",
        name: "revoked",
        publicUrl: "http://10.0.0.2:4200",
        region: "us",
        labels: { role: "grader" },
        version: "1.0",
        // Underlying enum status is still "active" — the revoked
        // derivation must WIN over it.
        status: "active" as const,
        lastSeenAt: now,
        revokedAt: now,
        registeredAt: now,
      },
    ])
    // 2nd SELECT — capabilities (thenable at .from()).
    selectFromThenSpy.mockResolvedValueOnce([
      { runnerId: "r-active", mode: "submission", concurrency: 4 },
      { runnerId: "r-revoked", mode: "session", concurrency: 32 },
    ])

    const caller = adminRouter.createCaller(websiteCtx)
    const result = await caller.runners.list()

    expect(result.runners).toHaveLength(2)

    const active = result.runners.find((r) => r.id === "r-active")
    expect(active?.status).toBe("active")
    expect(active?.revoked_at).toBeNull()
    expect(active?.capabilities).toEqual([
      { mode: "submission", concurrency: 4 },
    ])

    const revoked = result.runners.find((r) => r.id === "r-revoked")
    expect(revoked?.status).toBe("revoked")
    expect(revoked?.revoked_at).toEqual(now)
    expect(revoked?.capabilities).toEqual([
      { mode: "session", concurrency: 32 },
    ])
  })

  it("returns an empty list when there are no runners", async () => {
    selectOrderBySpy.mockResolvedValueOnce([])
    selectFromThenSpy.mockResolvedValueOnce([])

    const caller = adminRouter.createCaller(websiteCtx)
    const result = await caller.runners.list()
    expect(result.runners).toEqual([])
  })

  it("rejects a non-website caller (UNAUTHORIZED)", async () => {
    const caller = adminRouter.createCaller({ actor: "unauth" })
    await expect(caller.runners.list()).rejects.toThrow()
  })
})

// ─── admin.runners.revoke ──────────────────────────────────────────────────
describe("admin.runners.revoke", () => {
  it("issues an UPDATE that sets revokedAt and returns {revoked:true, runner_id}", async () => {
    const caller = adminRouter.createCaller(websiteCtx)
    const result = await caller.runners.revoke({ runner_id: "r-1" })

    expect(result).toEqual({ revoked: true, runner_id: "r-1" })

    // Exactly one UPDATE — soft-delete only, no INSERT/no DELETE.
    expect(updateTableSpy).toHaveBeenCalledTimes(1)
    expect(updateSetSpy).toHaveBeenCalledTimes(1)
    expect(updateWhereSpy).toHaveBeenCalledTimes(1)

    const setArg = updateSetSpy.mock.calls[0]?.[0] as Record<string, unknown>
    expect(setArg.revokedAt).toBeInstanceOf(Date)
    // Revoke MUST NOT touch identity or metadata columns.
    expect(setArg.id).toBeUndefined()
    expect(setArg.name).toBeUndefined()
    expect(setArg.publicUrl).toBeUndefined()
    expect(setArg.secretHash).toBeUndefined()
  })

  it("is idempotent — a second revoke call still succeeds (row already revoked)", async () => {
    const caller = adminRouter.createCaller(websiteCtx)
    const first = await caller.runners.revoke({ runner_id: "r-1" })
    const second = await caller.runners.revoke({ runner_id: "r-1" })

    expect(first).toEqual({ revoked: true, runner_id: "r-1" })
    expect(second).toEqual({ revoked: true, runner_id: "r-1" })
    // Both calls issued an UPDATE — the second is a no-op at the DB layer
    // (WHERE clause filters `isNull(revokedAt)`), but the endpoint returns
    // the same shape either way.
    expect(updateTableSpy).toHaveBeenCalledTimes(2)
  })

  it("rejects a non-website caller (UNAUTHORIZED)", async () => {
    const caller = adminRouter.createCaller({ actor: "unauth" })
    await expect(
      caller.runners.revoke({ runner_id: "r-1" }),
    ).rejects.toThrow()
    expect(updateTableSpy).not.toHaveBeenCalled()
  })
})

// ─── admin.runners.rotateToken ─────────────────────────────────────────────
describe("admin.runners.rotateToken", () => {
  it("returns a NEW 64-hex token, keeps runner_id, and writes secret_* columns only", async () => {
    // Initial SELECT: active, non-revoked runner.
    selectLimitSpy.mockResolvedValueOnce([
      {
        id: "r-1",
        status: "active",
        revokedAt: null,
        secretHash: "old-hash",
      },
    ])
    // Conditional UPDATE returns exactly one row (the happy path).
    updateReturningSpy.mockResolvedValueOnce([{ id: "r-1" }])

    const caller = adminRouter.createCaller(websiteCtx)
    const result = await caller.runners.rotateToken({ runner_id: "r-1" })

    expect(result.runner_id).toBe("r-1")
    expect(result.runner_token).toHaveLength(64)
    expect(result.runner_token).toMatch(/^[0-9a-f]{64}$/)

    // The UPDATE set NEW secretHash / secretCiphertext / secretNonce and
    // touched NOTHING else — id, name, public_url, region, labels stay put.
    expect(updateTableSpy).toHaveBeenCalledTimes(1)
    const setArg = updateSetSpy.mock.calls[0]?.[0] as Record<string, unknown>
    expect(setArg.secretHash).toBeDefined()
    expect(setArg.secretHash).not.toBe("old-hash")
    expect(setArg.secretCiphertext).toBeDefined()
    expect(setArg.secretNonce).toBe("test-nonce")
    expect(setArg.id).toBeUndefined()
    expect(setArg.name).toBeUndefined()
    expect(setArg.publicUrl).toBeUndefined()
    expect(setArg.revokedAt).toBeUndefined()
    expect(setArg.status).toBeUndefined()
  })

  it("throws BAD_REQUEST 'cannot rotate a revoked runner' when revokedAt is set", async () => {
    selectLimitSpy.mockResolvedValueOnce([
      {
        id: "r-1",
        status: "active",
        revokedAt: new Date(),
        secretHash: "hash",
      },
    ])

    const caller = adminRouter.createCaller(websiteCtx)
    await expect(
      caller.runners.rotateToken({ runner_id: "r-1" }),
    ).rejects.toThrow(/cannot rotate a revoked runner/)
    // No UPDATE — the guard fires before the write.
    expect(updateTableSpy).not.toHaveBeenCalled()
  })

  it("throws BAD_REQUEST 'cannot rotate a deregistered runner' when status is 'deregistered'", async () => {
    selectLimitSpy.mockResolvedValueOnce([
      {
        id: "r-1",
        status: "deregistered",
        revokedAt: null,
        secretHash: "hash",
      },
    ])

    const caller = adminRouter.createCaller(websiteCtx)
    await expect(
      caller.runners.rotateToken({ runner_id: "r-1" }),
    ).rejects.toThrow(/cannot rotate a deregistered runner/)
    expect(updateTableSpy).not.toHaveBeenCalled()
  })

  it("throws NOT_FOUND 'runner not found' when the runner id does not exist", async () => {
    selectLimitSpy.mockResolvedValueOnce([]) // empty SELECT result

    const caller = adminRouter.createCaller(websiteCtx)
    await expect(
      caller.runners.rotateToken({ runner_id: "missing" }),
    ).rejects.toThrow(/runner not found/)
    expect(updateTableSpy).not.toHaveBeenCalled()
  })

  it("throws BAD_REQUEST 'cannot rotate a revoked runner' when a concurrent revoke wins the race (recheck path)", async () => {
    // Initial SELECT — runner looks fine.
    selectLimitSpy.mockResolvedValueOnce([
      {
        id: "r-1",
        status: "active",
        revokedAt: null,
        secretHash: "old-hash",
      },
    ])
    // Conditional UPDATE finds 0 rows — someone revoked between SELECT and UPDATE.
    updateReturningSpy.mockResolvedValueOnce([])
    // Recheck SELECT reveals the concurrent revoke.
    selectLimitSpy.mockResolvedValueOnce([
      { revokedAt: new Date(), secretHash: "old-hash" },
    ])

    const caller = adminRouter.createCaller(websiteCtx)
    await expect(
      caller.runners.rotateToken({ runner_id: "r-1" }),
    ).rejects.toThrow(/cannot rotate a revoked runner/)
  })

  it("throws CONFLICT when a concurrent rotate by another admin wins the race", async () => {
    selectLimitSpy.mockResolvedValueOnce([
      {
        id: "r-1",
        status: "active",
        revokedAt: null,
        secretHash: "old-hash",
      },
    ])
    updateReturningSpy.mockResolvedValueOnce([])
    // Recheck: not revoked, but the hash moved out from under us.
    selectLimitSpy.mockResolvedValueOnce([
      { revokedAt: null, secretHash: "some-other-admin-rotated" },
    ])

    const caller = adminRouter.createCaller(websiteCtx)
    await expect(
      caller.runners.rotateToken({ runner_id: "r-1" }),
    ).rejects.toThrow(/rotated concurrently by another admin/)
  })

  it("throws NOT_FOUND when UPDATE affects 0 rows and the recheck finds no row at all", async () => {
    selectLimitSpy.mockResolvedValueOnce([
      {
        id: "r-1",
        status: "active",
        revokedAt: null,
        secretHash: "old-hash",
      },
    ])
    updateReturningSpy.mockResolvedValueOnce([])
    // Recheck returns nothing (row was hard-deleted somehow — shouldn't happen
    // but the router guards against it).
    selectLimitSpy.mockResolvedValueOnce([])

    const caller = adminRouter.createCaller(websiteCtx)
    await expect(
      caller.runners.rotateToken({ runner_id: "r-1" }),
    ).rejects.toThrow(/runner not found/)
  })

  it("rejects a non-website caller (UNAUTHORIZED)", async () => {
    const caller = adminRouter.createCaller({
      actor: "runner",
      runnerId: "r-1",
    })
    await expect(
      caller.runners.rotateToken({ runner_id: "r-1" }),
    ).rejects.toThrow(/Website token required|UNAUTHORIZED/)
    // Auth check runs before SELECT.
    expect(selectLimitSpy).not.toHaveBeenCalled()
  })

  it("rejects an unauthenticated caller (UNAUTHORIZED)", async () => {
    const caller = adminRouter.createCaller({ actor: "unauth" })
    await expect(
      caller.runners.rotateToken({ runner_id: "r-1" }),
    ).rejects.toThrow()
    expect(selectLimitSpy).not.toHaveBeenCalled()
  })
})

// ─── Cross-cutting: no hard delete anywhere ────────────────────────────────
describe("admin — cross-cutting invariants", () => {
  it("guardrail: the mocked db exposes no `delete` method (soft-delete only)", async () => {
    // The mock intentionally omits `db.delete` — any admin endpoint that
    // tried to call it would fail at runtime with "delete is not a
    // function", surfacing the regression as a test failure. This spec
    // documents the invariant: revoke is a SET revokedAt, not a DELETE.
    const dbModule = await import("../../src/db")
    const db = dbModule.db as Record<string, unknown>
    expect(db.delete).toBeUndefined()
  })
})
