import { beforeEach, describe, expect, it, vi } from "vitest"

// ── Mocks must come before the SUT import ──────────────────────────────────
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

// Drizzle mock — chainable. Calls captured via spies for assertions.
type AnyFn = (...args: unknown[]) => unknown
const insertSpy = vi.fn<AnyFn>()
const updateSpy = vi.fn<AnyFn>()
const txInsertSpy = vi.fn<AnyFn>()
const insertValuesSpy = vi.fn<AnyFn>()
const txInsertValuesSpy = vi.fn<AnyFn>()
const onConflictSpy = vi.fn<AnyFn>().mockResolvedValue([])
const transactionSpy = vi.fn<AnyFn>()
const updateSetSpy = vi.fn<AnyFn>()
const updateWhereSpy = vi.fn<AnyFn>().mockResolvedValue([])

function makeInsertChain(spy: typeof insertValuesSpy) {
  // `.values(...)` must be both awaitable AND chain to `.onConflictDoUpdate(...)`
  const values = (vals: unknown) => {
    spy(vals)
    const p: Promise<unknown[]> & {
      onConflictDoUpdate?: typeof onConflictSpy
    } = Promise.resolve([])
    p.onConflictDoUpdate = onConflictSpy
    return p
  }
  return { values }
}

vi.mock("../../src/db", () => {
  const txObj = {
    insert: (table: unknown) => {
      txInsertSpy(table)
      return makeInsertChain(txInsertValuesSpy)
    },
  }
  return {
    db: {
      insert: (table: unknown) => {
        insertSpy(table)
        return makeInsertChain(insertValuesSpy)
      },
      update: (table: unknown) => {
        updateSpy(table)
        return {
          set: (vals: unknown) => {
            updateSetSpy(vals)
            return {
              where: (cond: unknown) => {
                updateWhereSpy(cond)
                return Promise.resolve([])
              },
            }
          },
        }
      },
      transaction: (fn: (tx: typeof txObj) => Promise<unknown>) => {
        transactionSpy(fn)
        return fn(txObj)
      },
    },
  }
})

// ── Import the SUT after mocks are registered ──────────────────────────────
const { runnersRouter } = await import("../../src/routers/runners")

beforeEach(() => {
  insertSpy.mockClear()
  updateSpy.mockClear()
  txInsertSpy.mockClear()
  insertValuesSpy.mockClear()
  txInsertValuesSpy.mockClear()
  onConflictSpy.mockClear()
  transactionSpy.mockClear()
  updateSetSpy.mockClear()
  updateWhereSpy.mockClear()
})

describe("runners.register", () => {
  it("generates a uuid runner_id and a 64-char hex runner_secret", async () => {
    const caller = runnersRouter.createCaller({ actor: "runner" })
    const result = await caller.register({
      name: "test-runner",
      public_url: "http://localhost:4200",
      labels: {},
      capabilities: [{ mode: "submission", concurrency: 4 }],
    })

    expect(result.runner_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    )
    // 32 random bytes → 64 hex chars
    expect(result.runner_secret).toHaveLength(64)
    expect(result.runner_secret).toMatch(/^[0-9a-f]{64}$/)
  })

  it("stores secretHash but NEVER stores the plaintext secret", async () => {
    const caller = runnersRouter.createCaller({ actor: "runner" })
    const result = await caller.register({
      name: "test",
      public_url: "http://localhost:4200",
      labels: {},
      capabilities: [{ mode: "submission", concurrency: 4 }],
    })

    // The first tx.insert(runners).values(...) captured the runner row.
    expect(txInsertValuesSpy).toHaveBeenCalled()
    const runnerRow = txInsertValuesSpy.mock.calls[0]?.[0] as Record<
      string,
      unknown
    >
    expect(runnerRow.secretHash).toBeDefined()
    expect(typeof runnerRow.secretHash).toBe("string")
    expect((runnerRow.secretHash as string).length).toBe(64) // sha256 hex
    // The secret must NOT appear anywhere in the stored row
    const serialized = JSON.stringify(runnerRow)
    expect(serialized).not.toContain(result.runner_secret)
  })

  it("inserts a row per capability inside the transaction", async () => {
    const caller = runnersRouter.createCaller({ actor: "runner" })
    await caller.register({
      name: "multi-cap",
      public_url: "http://localhost:4200",
      labels: {},
      capabilities: [
        { mode: "submission", concurrency: 4 },
        { mode: "session", concurrency: 64 },
      ],
    })

    expect(transactionSpy).toHaveBeenCalledTimes(1)
    // 1 insert for runner row + 2 inserts for capabilities = 3 tx.insert calls
    expect(txInsertSpy).toHaveBeenCalledTimes(3)
  })

  it("rejects when actor is not runner (UNAUTHORIZED)", async () => {
    const caller = runnersRouter.createCaller({ actor: "unauth" })
    await expect(
      caller.register({
        name: "test",
        public_url: "http://localhost:4200",
        labels: {},
        capabilities: [{ mode: "submission", concurrency: 4 }],
      }),
    ).rejects.toThrow(/Registration token required|UNAUTHORIZED/)
  })

  it("rejects when actor is website (UNAUTHORIZED)", async () => {
    const caller = runnersRouter.createCaller({ actor: "website" })
    await expect(
      caller.register({
        name: "test",
        public_url: "http://localhost:4200",
        labels: {},
        capabilities: [{ mode: "submission", concurrency: 4 }],
      }),
    ).rejects.toThrow()
  })

  it("rejects when a runnerId is already present (already registered)", async () => {
    const caller = runnersRouter.createCaller({
      actor: "runner",
      runnerId: "already-set",
    })
    await expect(
      caller.register({
        name: "test",
        public_url: "http://localhost:4200",
        labels: {},
        capabilities: [{ mode: "submission", concurrency: 4 }],
      }),
    ).rejects.toThrow()
  })
})

describe("runners.heartbeat", () => {
  it("upserts a heartbeat row and bumps lastSeenAt", async () => {
    const caller = runnersRouter.createCaller({
      actor: "runner",
      runnerId: "runner-abc",
    })

    const result = await caller.heartbeat({
      capacity: {
        session_used: 1,
        session_max: 64,
        submission_used: 0,
        submission_max: 4,
      },
    })

    expect(result).toEqual({ status: "ack" })
    expect(updateSpy).toHaveBeenCalled() // runners.lastSeenAt bump
    expect(insertSpy).toHaveBeenCalled() // runnerHeartbeats upsert
    expect(onConflictSpy).toHaveBeenCalled()
    const setArg = updateSetSpy.mock.calls[0]?.[0] as Record<string, unknown>
    expect(setArg.lastSeenAt).toBeInstanceOf(Date)
  })

  it("rejects when no runnerId in context", async () => {
    const caller = runnersRouter.createCaller({ actor: "runner" })
    await expect(
      caller.heartbeat({
        capacity: {
          session_used: 0,
          session_max: 64,
          submission_used: 0,
          submission_max: 4,
        },
      }),
    ).rejects.toThrow(/Runner credentials required|UNAUTHORIZED/)
  })

  it("rejects when actor is unauth", async () => {
    const caller = runnersRouter.createCaller({
      actor: "unauth",
      runnerId: "runner-abc",
    })
    await expect(
      caller.heartbeat({
        capacity: {
          session_used: 0,
          session_max: 64,
          submission_used: 0,
          submission_max: 4,
        },
      }),
    ).rejects.toThrow()
  })
})

describe("runners.deregister", () => {
  it("marks the runner as deregistered and stamps deregisteredAt", async () => {
    const caller = runnersRouter.createCaller({
      actor: "runner",
      runnerId: "runner-xyz",
    })

    const result = await caller.deregister({})
    expect(result).toEqual({ ok: true })

    expect(updateSpy).toHaveBeenCalled()
    const setArg = updateSetSpy.mock.calls[0]?.[0] as Record<string, unknown>
    expect(setArg.status).toBe("deregistered")
    expect(setArg.deregisteredAt).toBeInstanceOf(Date)
  })

  it("rejects without runnerId", async () => {
    const caller = runnersRouter.createCaller({ actor: "runner" })
    await expect(caller.deregister({})).rejects.toThrow()
  })
})
