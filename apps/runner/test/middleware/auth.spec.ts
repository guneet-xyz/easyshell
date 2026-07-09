import { type IncomingMessage, type ServerResponse } from "node:http"
import { type CreateHTTPContextOptions } from "@trpc/server/adapters/standalone"
import { describe, expect, it, vi } from "vitest"

vi.mock("../../src/env", () => ({
  env: {
    RUNNER_TOKEN:
      "test-token-64hex00000000000000000000000000000000000000000000000000000",
    RUNNER_PORT: 4200,
    RUNNER_NAME: "test",
    RUNNER_PUBLIC_URL: "http://localhost:4200",
    RUNNER_ID: "test-runner-id",
    COORDINATOR_URL: "http://localhost:4100",
    WORKING_DIR: "/tmp",
    RUNNER_DB_PATH: "/tmp/test.db",
    SUBMISSION_MAX_CONCURRENCY: 4,
    SESSION_MAX_CONCURRENCY: 64,
    LOG_LEVEL: "silent",
    NODE_ENV: "test",
    RUNNER_LABELS: {},
  },
}))

const { createContext } = await import("../../src/context")

function makeOpts(auth?: string | { raw: string }): CreateHTTPContextOptions {
  const authHeader =
    typeof auth === "string" ? `Bearer ${auth}` : auth ? auth.raw : undefined
  return {
    req: {
      headers: authHeader ? { authorization: authHeader } : {},
    } as unknown as IncomingMessage,
    res: {} as unknown as ServerResponse,
    info: {} as unknown as CreateHTTPContextOptions["info"],
  }
}

describe("runner createContext", () => {
  it("returns coordinator when correct bearer provided", () => {
    const ctx = createContext(
      makeOpts(
        "test-token-64hex00000000000000000000000000000000000000000000000000000",
      ),
    )
    expect(ctx.actor).toBe("coordinator")
  })

  it("returns unauth when no authorization header", () => {
    const ctx = createContext(makeOpts())
    expect(ctx.actor).toBe("unauth")
  })

  it("returns unauth when wrong bearer of equal length", () => {
    const ctx = createContext(
      makeOpts(
        "xxxx-xxxxxx-64hex00000000000000000000000000000000000000000000000000000",
      ),
    )
    expect(ctx.actor).toBe("unauth")
  })

  it("returns unauth when wrong bearer of different length", () => {
    const ctx = createContext(makeOpts("wrong-secret"))
    expect(ctx.actor).toBe("unauth")
  })

  it("returns unauth when authorization header does not start with Bearer", () => {
    const ctx = createContext(makeOpts({ raw: "Basic abc" }))
    expect(ctx.actor).toBe("unauth")
  })
})
