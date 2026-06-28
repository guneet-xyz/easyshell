import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// Capture what pino outputs by mocking pino itself.
// vi.mock is hoisted, but the factory is only invoked when the mocked module
// is imported. We dynamically import the SUT below so these top-level consts
// are defined by the time pino is resolved.
const pinoChildSpy = vi.fn()
const pinoMock = vi.fn(() => ({
  child: pinoChildSpy.mockReturnValue({ info: vi.fn(), debug: vi.fn() }),
  level: "info",
}))
vi.mock("pino", () => ({ default: pinoMock }))

const { createLogger } = await import("../index")

beforeEach(() => {
  vi.clearAllMocks()
  // clearAllMocks wipes call history but preserves implementations, so the
  // pinoMock factory continues to return a fresh inner child mock each call.
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("createLogger", () => {
  it("returns a child logger with the service field", () => {
    createLogger("test-service")
    expect(pinoChildSpy).toHaveBeenCalledWith(
      expect.objectContaining({ service: "test-service" }),
    )
  })

  it("merges baseContext into child args", () => {
    createLogger("svc", { correlation_id: "abc-123" })
    expect(pinoChildSpy).toHaveBeenCalledWith(
      expect.objectContaining({ service: "svc", correlation_id: "abc-123" }),
    )
  })

  it("uses LOG_LEVEL env var for the pino level", () => {
    vi.stubEnv("LOG_LEVEL", "debug")
    createLogger("svc")
    expect(pinoMock).toHaveBeenCalledWith(
      expect.objectContaining({ level: "debug" }),
    )
  })

  it("defaults to level=info when LOG_LEVEL is not set", () => {
    // `vi.stubEnv(name, undefined)` deletes the env var so the SUT's
    // `process.env.LOG_LEVEL ?? "info"` falls through to the default.
    vi.stubEnv("LOG_LEVEL", undefined)
    createLogger("svc")
    expect(pinoMock).toHaveBeenCalledWith(
      expect.objectContaining({ level: "info" }),
    )
  })
})
