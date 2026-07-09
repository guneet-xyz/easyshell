import { beforeEach, describe, expect, it, vi } from "vitest"

import { runnerHeartbeats } from "@easyshell/db/schema"

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

// Select chain: db.select(cols).from(t).innerJoin(...).leftJoin(...)
//   .where(...).orderBy(...).limit(1)
type AnyFn = (...args: unknown[]) => unknown
const selectColumnsSpy = vi.fn<AnyFn>()
const selectFromSpy = vi.fn<AnyFn>()
const innerJoinSpy = vi.fn<AnyFn>()
const leftJoinSpy = vi.fn<AnyFn>()
const selectWhereSpy = vi.fn<AnyFn>()
const orderBySpy = vi.fn<AnyFn>()
const limitSpy = vi.fn<AnyFn>()

vi.mock("../../src/db", () => {
  const chain = {
    from: (t: unknown) => {
      selectFromSpy(t)
      return chain
    },
    innerJoin: (t: unknown, cond: unknown) => {
      innerJoinSpy(t, cond)
      return chain
    },
    leftJoin: (t: unknown, cond: unknown) => {
      leftJoinSpy(t, cond)
      return chain
    },
    where: (c: unknown) => {
      selectWhereSpy(c)
      return chain
    },
    orderBy: (c: unknown) => {
      orderBySpy(c)
      return chain
    },
    limit: (n: number) => limitSpy(n),
  }
  return {
    db: {
      select: (cols: unknown) => {
        selectColumnsSpy(cols)
        return chain
      },
    },
  }
})

// ── Import the SUT after all mocks are in place ─────────────────────────────
const { pickRunner } = await import("../../src/services/runner-picker")

beforeEach(() => {
  selectColumnsSpy.mockReset()
  selectFromSpy.mockReset()
  innerJoinSpy.mockReset()
  leftJoinSpy.mockReset()
  selectWhereSpy.mockReset()
  orderBySpy.mockReset()
  limitSpy.mockReset().mockResolvedValue([])
})

/**
 * Walks a drizzle `SQL` template (or any nested chunk) and yields every
 * non-SQL chunk so tests can assert specific column references appear.
 */
function flattenChunks(node: unknown): unknown[] {
  if (node == null) return []
  if (typeof node !== "object") return [node]
  // drizzle SQL has `.queryChunks`; SQL.Aliased wraps it in `.sql`.
  const queryChunks = (node as { queryChunks?: unknown[] }).queryChunks
  if (Array.isArray(queryChunks)) {
    return queryChunks.flatMap((c) => flattenChunks(c))
  }
  const innerSql = (node as { sql?: unknown }).sql
  if (innerSql && typeof innerSql === "object") {
    return flattenChunks(innerSql)
  }
  return [node]
}

describe("pickRunner", () => {
  it("returns null when the query returns no rows", async () => {
    limitSpy.mockResolvedValueOnce([])
    expect(await pickRunner("submission")).toBeNull()
    expect(selectColumnsSpy).toHaveBeenCalledTimes(1)
    expect(limitSpy).toHaveBeenCalledWith(1)
  })

  it("returns null when the best row has spareCapacity <= 0", async () => {
    limitSpy.mockResolvedValueOnce([
      {
        id: "r1",
        publicUrl: "http://localhost:4200",
        secretCiphertext: "c",
        secretNonce: "n",
        spareCapacity: 0,
      },
    ])
    expect(await pickRunner("submission")).toBeNull()
  })

  it("returns null when spareCapacity is negative", async () => {
    limitSpy.mockResolvedValueOnce([
      {
        id: "r1",
        publicUrl: "http://localhost:4200",
        secretCiphertext: "c",
        secretNonce: "n",
        spareCapacity: -3,
      },
    ])
    expect(await pickRunner("session")).toBeNull()
  })

  it("returns the runner row when spareCapacity > 0 (PickedRunner shape)", async () => {
    limitSpy.mockResolvedValueOnce([
      {
        id: "runner-best",
        publicUrl: "http://10.0.0.5:4200",
        secretCiphertext: "cipher-abc",
        secretNonce: "nonce-xyz",
        spareCapacity: 3,
      },
    ])
    const result = await pickRunner("submission")
    expect(result).toEqual({
      id: "runner-best",
      publicUrl: "http://10.0.0.5:4200",
      secretCiphertext: "cipher-abc",
      secretNonce: "nonce-xyz",
    })
  })

  it("trusts the SQL ordering — only the first row (highest spare_capacity) is returned", async () => {
    // The SUT uses `.limit(1)` and reads `results[0]`. To prove this we make
    // the mock return two rows; the picker must take the first.
    limitSpy.mockResolvedValueOnce([
      {
        id: "first",
        publicUrl: "http://first",
        secretCiphertext: "c1",
        secretNonce: "n1",
        spareCapacity: 5,
      },
      {
        id: "second",
        publicUrl: "http://second",
        secretCiphertext: "c2",
        secretNonce: "n2",
        spareCapacity: 1,
      },
    ])
    const result = await pickRunner("submission")
    expect(result?.id).toBe("first")
  })

  it("selects the submission concurrency columns when mode='submission'", async () => {
    limitSpy.mockResolvedValueOnce([])
    await pickRunner("submission")

    expect(selectColumnsSpy).toHaveBeenCalledTimes(1)
    const cols = selectColumnsSpy.mock.calls[0]?.[0] as {
      spareCapacity: unknown
    }
    const chunks = flattenChunks(cols.spareCapacity)
    expect(chunks).toContain(runnerHeartbeats.submissionConcurrencyUsed)
    expect(chunks).toContain(runnerHeartbeats.submissionConcurrencyMax)
    expect(chunks).not.toContain(runnerHeartbeats.sessionConcurrencyUsed)
    expect(chunks).not.toContain(runnerHeartbeats.sessionConcurrencyMax)
  })

  it("selects the session concurrency columns when mode='session'", async () => {
    limitSpy.mockResolvedValueOnce([])
    await pickRunner("session")

    const cols = selectColumnsSpy.mock.calls[0]?.[0] as {
      spareCapacity: unknown
    }
    const chunks = flattenChunks(cols.spareCapacity)
    expect(chunks).toContain(runnerHeartbeats.sessionConcurrencyUsed)
    expect(chunks).toContain(runnerHeartbeats.sessionConcurrencyMax)
    expect(chunks).not.toContain(runnerHeartbeats.submissionConcurrencyUsed)
    expect(chunks).not.toContain(runnerHeartbeats.submissionConcurrencyMax)
  })
})
