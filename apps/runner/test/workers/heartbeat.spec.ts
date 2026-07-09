// ==========================================
// Unit tests for the heartbeat worker.
//
// `heartbeatLoop(getCapacity)` runs forever once started. It waits 5s
// between ticks, posts a capacity snapshot to coordinator.runners.heartbeat,
// and toggles a module-level `draining` flag on a "drain" or "deregister"
// response (exposed via `isDraining()`).
//
// We mock `@trpc/client`, `../../src/env`, and the logger, and step
// through one tick using fake timers. The loop is intentionally not
// awaited — its promise never resolves under normal operation.
// ==========================================

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const {
  envState,
  heartbeatMutateMock,
  createTRPCClientMock,
  httpBatchLinkMock,
} = vi.hoisted(() => ({
  envState: {
    RUNNER_TOKEN: undefined as string | undefined,
    RUNNER_PORT: 4200,
    RUNNER_NAME: "test-runner",
    RUNNER_PUBLIC_URL: "http://localhost:4200",
    RUNNER_ID: undefined as string | undefined,
    COORDINATOR_URL: "http://localhost:4100",
    WORKING_DIR: "/tmp/easyshell-test",
    RUNNER_DB_PATH: ":memory:",
    SUBMISSION_MAX_CONCURRENCY: 4,
    SESSION_MAX_CONCURRENCY: 64,
    LOG_LEVEL: "silent",
    NODE_ENV: "test",
    RUNNER_LABELS: {} as Record<string, string>,
    DOCKER_REGISTRY: undefined as string | undefined,
  },
  heartbeatMutateMock: vi.fn(),
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
        heartbeat: { mutate: heartbeatMutateMock },
      },
    }
  },
  httpBatchLink: httpBatchLinkMock,
  // The SUT imports TRPCClientError for a runtime `instanceof` check inside
  // is401(). Without a real class here, `err instanceof undefined` throws a
  // TypeError from the catch handler and silently kills the loop.
  TRPCClientError: class TRPCClientError extends Error {},
}))

type CapacitySnapshot = {
  session_used: number
  session_max: number
  submission_used: number
  submission_max: number
}

const DEFAULT_SNAPSHOT: CapacitySnapshot = {
  session_used: 0,
  session_max: 64,
  submission_used: 0,
  submission_max: 4,
}

// Helper: advance fake time AND drain microtasks. Vitest's
// advanceTimersByTimeAsync flushes pending timers, but the awaited
// mutate promise still needs a few microtask turns to settle the
// `draining` mutation before assertions can run.
async function tick(ms: number): Promise<void> {
  await vi.advanceTimersByTimeAsync(ms)
  for (let i = 0; i < 5; i++) await Promise.resolve()
}

describe("workers/heartbeat", () => {
  beforeEach(() => {
    vi.resetModules()
    heartbeatMutateMock.mockReset()
    createTRPCClientMock.mockReset()
    httpBatchLinkMock.mockReset()
    envState.RUNNER_ID = undefined
    envState.RUNNER_TOKEN = undefined
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it("isDraining returns false initially", async () => {
    const { isDraining } = await import("../../src/workers/heartbeat")
    expect(isDraining()).toBe(false)
  })

  it("sends a heartbeat carrying the capacity snapshot exactly as provided", async () => {
    envState.RUNNER_ID = "runner-1"
    envState.RUNNER_TOKEN = "secret"
    heartbeatMutateMock.mockResolvedValue({ status: "ack" })

    const snapshot: CapacitySnapshot = {
      session_used: 3,
      session_max: 64,
      submission_used: 1,
      submission_max: 4,
    }
    const { heartbeatLoop } = await import("../../src/workers/heartbeat")
    void heartbeatLoop(() => snapshot).catch(() => {
      /* loop is infinite; never resolves cleanly in tests */
    })

    await tick(5_001)

    expect(heartbeatMutateMock).toHaveBeenCalledWith({ capacity: snapshot })
  })

  it("flips draining=true when coordinator responds with 'drain'", async () => {
    envState.RUNNER_ID = "runner-1"
    envState.RUNNER_TOKEN = "secret"
    heartbeatMutateMock.mockResolvedValue({ status: "drain" })

    const { heartbeatLoop, isDraining } = await import(
      "../../src/workers/heartbeat"
    )
    expect(isDraining()).toBe(false)

    void heartbeatLoop(() => DEFAULT_SNAPSHOT).catch(() => {
      /* loop is infinite */
    })
    await tick(5_001)

    expect(heartbeatMutateMock).toHaveBeenCalledTimes(1)
    expect(isDraining()).toBe(true)
  })

  it("keeps draining=false on a normal 'ack' response", async () => {
    envState.RUNNER_ID = "runner-1"
    envState.RUNNER_TOKEN = "secret"
    heartbeatMutateMock.mockResolvedValue({ status: "ack" })

    const { heartbeatLoop, isDraining } = await import(
      "../../src/workers/heartbeat"
    )
    void heartbeatLoop(() => DEFAULT_SNAPSHOT).catch(() => {
      /* loop is infinite */
    })
    await tick(5_001)

    expect(isDraining()).toBe(false)
  })

  it("swallows a failed heartbeat and keeps looping", async () => {
    envState.RUNNER_ID = "runner-1"
    envState.RUNNER_TOKEN = "secret"
    heartbeatMutateMock
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValue({ status: "ack" })

    const { heartbeatLoop } = await import("../../src/workers/heartbeat")
    void heartbeatLoop(() => DEFAULT_SNAPSHOT).catch(() => {
      /* loop is infinite */
    })

    // First tick: rejection — should NOT crash the loop.
    await tick(5_001)
    expect(heartbeatMutateMock).toHaveBeenCalledTimes(1)

    // Second tick: succeeds — proves the loop survived.
    await tick(5_001)
    expect(heartbeatMutateMock).toHaveBeenCalledTimes(2)
  })

  it("sets the bearer + x-runner-id auth headers on the client links", async () => {
    envState.RUNNER_ID = "runner-1"
    envState.RUNNER_TOKEN = "the-secret"
    heartbeatMutateMock.mockResolvedValue({ status: "ack" })

    const { heartbeatLoop } = await import("../../src/workers/heartbeat")
    void heartbeatLoop(() => DEFAULT_SNAPSHOT).catch(() => {
      /* loop is infinite */
    })
    await tick(5_001)

    expect(httpBatchLinkMock).toHaveBeenCalledTimes(1)
    const opts = httpBatchLinkMock.mock.calls[0]?.[0] as {
      url: string
      headers: Record<string, string>
    }
    expect(opts.url).toBe("http://localhost:4100")
    expect(opts.headers).toEqual({
      Authorization: "Bearer the-secret",
      "x-runner-id": "runner-1",
    })
  })
})
