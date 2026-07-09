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
