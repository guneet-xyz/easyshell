// ==========================================
// Unit tests for the bootstrap worker.
//
// `bootstrap()` runs once at process start. The contract is:
//   • RUNNER_ID + RUNNER_SECRET both set → early return, no network.
//   • Either missing → call coordinator.runners.register and process.exit(0).
//   • Registration throws → process.exit(1).
//
// We mock `@trpc/client`, `../../src/env` (mutable via vi.hoisted), and
// the logger. process.exit is replaced with a throw so the function
// aborts cleanly at the exit point instead of continuing into code
// that would NPE on the undefined `result`.
// ==========================================

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { envState, mutateMock, createTRPCClientMock, httpBatchLinkMock } =
  vi.hoisted(() => ({
    envState: {
      RUNNER_SECRET: undefined as string | undefined,
      RUNNER_PORT: 4200,
      RUNNER_NAME: "test-runner",
      RUNNER_PUBLIC_URL: "http://localhost:4200",
      RUNNER_ID: undefined as string | undefined,
      RUNNER_REGION: undefined as string | undefined,
      COORDINATOR_URL: "http://localhost:4100",
      COORDINATOR_REGISTRATION_TOKEN: "test-reg",
      WORKING_DIR: "/tmp/easyshell-test",
      RUNNER_DB_PATH: ":memory:",
      SUBMISSION_MAX_CONCURRENCY: 4,
      SESSION_MAX_CONCURRENCY: 64,
      LOG_LEVEL: "silent",
      NODE_ENV: "test",
      RUNNER_LABELS: {} as Record<string, string>,
      DOCKER_REGISTRY: undefined as string | undefined,
    },
    mutateMock: vi.fn(),
    createTRPCClientMock: vi.fn(),
    httpBatchLinkMock: vi.fn(),
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
      runners: {
        register: { mutate: mutateMock },
      },
    }
  },
  httpBatchLink: httpBatchLinkMock,
}))

describe("workers/bootstrap", () => {
  beforeEach(() => {
    vi.resetModules()
    mutateMock.mockReset()
    createTRPCClientMock.mockReset()
    httpBatchLinkMock.mockReset()
    envState.RUNNER_ID = undefined
    envState.RUNNER_SECRET = undefined
    envState.RUNNER_REGION = undefined
    envState.RUNNER_LABELS = {}
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("skips registration when RUNNER_ID and RUNNER_SECRET are both set", async () => {
    envState.RUNNER_ID = "preset-id"
    envState.RUNNER_SECRET = "preset-secret"
    const exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation((() => undefined) as never)

    const { bootstrap } = await import("../../src/workers/bootstrap")
    await bootstrap()

    expect(createTRPCClientMock).not.toHaveBeenCalled()
    expect(mutateMock).not.toHaveBeenCalled()
    expect(exitSpy).not.toHaveBeenCalled()
  })

  it("calls runners.register.mutate and exits 0 on a successful registration", async () => {
    // Both creds missing → register path.
    mutateMock.mockResolvedValue({
      runner_id: "new-id",
      runner_secret: "new-secret",
    })

    const exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation(((code?: number) => {
        // Throw to abort the bootstrap function at the exit point — the
        // function would otherwise continue past `process.exit(0)`.
        throw new Error(`__EXIT_${code ?? 0}__`)
      }) as never)
    const stderrSpy = vi
      .spyOn(process.stderr, "write")
      .mockImplementation((() => true) as never)

    const { bootstrap } = await import("../../src/workers/bootstrap")
    await expect(bootstrap()).rejects.toThrow("__EXIT_0__")

    expect(createTRPCClientMock).toHaveBeenCalledTimes(1)
    expect(mutateMock).toHaveBeenCalledTimes(1)
    expect(mutateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "test-runner",
        public_url: "http://localhost:4200",
        capabilities: expect.arrayContaining([
          { mode: "submission", concurrency: 4 },
          { mode: "session", concurrency: 64 },
        ]) as unknown,
      }),
    )
    expect(exitSpy).toHaveBeenCalledWith(0)
    expect(stderrSpy).toHaveBeenCalled()
    // BOOTSTRAP-ME must include both the runner_id and runner_secret so
    // the operator can copy them into env.
    const written = stderrSpy.mock.calls.map((c) => String(c[0])).join("")
    expect(written).toContain("BOOTSTRAP-ME")
    expect(written).toContain("runner_id=new-id")
    expect(written).toContain("runner_secret=new-secret")
  })

  it("treats a missing RUNNER_SECRET (with RUNNER_ID set) as bootstrap-required", async () => {
    envState.RUNNER_ID = "preset-id"
    // RUNNER_SECRET stays undefined → bootstrap should still run.
    mutateMock.mockResolvedValue({
      runner_id: "regenerated-id",
      runner_secret: "fresh-secret",
    })
    const exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation(((code?: number) => {
        throw new Error(`__EXIT_${code ?? 0}__`)
      }) as never)
    vi.spyOn(process.stderr, "write").mockImplementation((() => true) as never)

    const { bootstrap } = await import("../../src/workers/bootstrap")
    await expect(bootstrap()).rejects.toThrow("__EXIT_0__")

    expect(mutateMock).toHaveBeenCalledTimes(1)
    expect(exitSpy).toHaveBeenCalledWith(0)
  })

  it("calls process.exit(1) when the registration mutate rejects", async () => {
    mutateMock.mockRejectedValue(new Error("coordinator unreachable"))
    const exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation(((code?: number) => {
        throw new Error(`__EXIT_${code ?? 0}__`)
      }) as never)
    const stderrSpy = vi
      .spyOn(process.stderr, "write")
      .mockImplementation((() => true) as never)

    const { bootstrap } = await import("../../src/workers/bootstrap")
    await expect(bootstrap()).rejects.toThrow("__EXIT_1__")

    expect(mutateMock).toHaveBeenCalledTimes(1)
    expect(exitSpy).toHaveBeenCalledWith(1)
    const written = stderrSpy.mock.calls.map((c) => String(c[0])).join("")
    expect(written).toContain("BOOTSTRAP-FAILED")
  })
})
