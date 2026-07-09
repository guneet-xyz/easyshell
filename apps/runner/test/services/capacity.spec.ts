// ==========================================
// Unit tests for the in-memory capacity service.
//
// `services/capacity.ts` carries module-level mutable state
// (`submissionUsed`, `sessionUsed`). To get a clean slate per test we
// `vi.resetModules()` in beforeEach and dynamically re-import the SUT,
// so each test sees fresh zeroed counters.
//
// No SQLite or docker mocks are needed — pure arithmetic over the
// env-derived max values.
// ==========================================

import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("../../src/env", () => ({
  env: {
    RUNNER_TOKEN:
      "test-token-64hex00000000000000000000000000000000000000000000000000000",
    RUNNER_PORT: 4200,
    RUNNER_NAME: "test-runner",
    RUNNER_PUBLIC_URL: "http://localhost:4200",
    RUNNER_ID: "test-runner-id",
    COORDINATOR_URL: "http://localhost:4100",
    WORKING_DIR: "/tmp/easyshell-test",
    RUNNER_DB_PATH: ":memory:",
    SUBMISSION_MAX_CONCURRENCY: 4,
    SESSION_MAX_CONCURRENCY: 64,
    LOG_LEVEL: "silent",
    NODE_ENV: "test",
    RUNNER_LABELS: {},
    DOCKER_REGISTRY: undefined,
  },
}))

vi.mock("@easyshell/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(() => ({})),
  }),
}))

type CapacityModule = typeof import("../../src/services/capacity")

describe("services/capacity", () => {
  let cap: CapacityModule

  beforeEach(async () => {
    // Reset module state so each test sees fresh zero counters.
    vi.resetModules()
    cap = await import("../../src/services/capacity")
  })

  it("getCapacity starts with both counters at zero and surfaces env max values", () => {
    expect(cap.getCapacity()).toEqual({
      session_used: 0,
      session_max: 64,
      submission_used: 0,
      submission_max: 4,
    })
  })

  describe("submission counters", () => {
    it("incrementSubmission increases submission_used by 1 per call", () => {
      cap.incrementSubmission()
      expect(cap.getCapacity().submission_used).toBe(1)
      cap.incrementSubmission()
      cap.incrementSubmission()
      expect(cap.getCapacity().submission_used).toBe(3)
    })

    it("decrementSubmission reduces submission_used", () => {
      cap.incrementSubmission()
      cap.incrementSubmission()
      cap.decrementSubmission()
      expect(cap.getCapacity().submission_used).toBe(1)
    })

    it("decrementSubmission floors at 0 when already at 0", () => {
      cap.decrementSubmission()
      cap.decrementSubmission()
      expect(cap.getCapacity().submission_used).toBe(0)
    })

    it("session counters are unaffected by submission mutations", () => {
      cap.incrementSubmission()
      cap.incrementSubmission()
      expect(cap.getCapacity().session_used).toBe(0)
    })
  })

  describe("session counters", () => {
    it("incrementSession increases session_used by 1 per call", () => {
      cap.incrementSession()
      expect(cap.getCapacity().session_used).toBe(1)
      cap.incrementSession()
      cap.incrementSession()
      expect(cap.getCapacity().session_used).toBe(3)
    })

    it("decrementSession reduces session_used", () => {
      cap.incrementSession()
      cap.incrementSession()
      cap.decrementSession()
      expect(cap.getCapacity().session_used).toBe(1)
    })

    it("decrementSession floors at 0 when already at 0", () => {
      cap.decrementSession()
      cap.decrementSession()
      expect(cap.getCapacity().session_used).toBe(0)
    })

    it("submission counters are unaffected by session mutations", () => {
      cap.incrementSession()
      cap.incrementSession()
      expect(cap.getCapacity().submission_used).toBe(0)
    })
  })

  it("returns the env-configured maxes regardless of usage", () => {
    cap.incrementSubmission()
    cap.incrementSession()
    const snapshot = cap.getCapacity()
    expect(snapshot.submission_max).toBe(4)
    expect(snapshot.session_max).toBe(64)
  })
})
