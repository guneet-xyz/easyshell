import { beforeEach, describe, expect, it, vi } from "vitest"

// ─── Mocks must be registered before importing the SUT ──────────────────────

const authMock = vi.fn().mockResolvedValue({ user: { id: "u-1" } })
const killMutate = vi.fn().mockResolvedValue({})

vi.mock("@easyshell/coordinator/client", () => ({
  createCoordinatorClient: vi.fn().mockReturnValue({
    terminalSessions: { kill: { mutate: killMutate } },
  }),
}))

vi.mock("@/env", () => ({
  env: {
    COORDINATOR_URL: "http://localhost:4100",
    COORDINATOR_TOKEN: "tok",
  },
}))

vi.mock("@/lib/server/auth", () => ({
  auth: authMock,
}))

vi.mock("@easyshell/db/schema", () => ({
  terminalSessions: {},
}))

// Drizzle chain mock — `.update(t).set(v).where(c).returning(s)` resolves to
// the configured rows, swapped per-test via `mockResolvedValueOnce`.
const updateReturningSpy = vi.fn().mockResolvedValue([{ id: 11 }, { id: 12 }])

vi.mock("@/db", () => ({
  db: {
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: updateReturningSpy,
        }),
      }),
    }),
  },
}))

// ─── SUT import (dynamic, after mocks) ──────────────────────────────────────
const { killTerminalSessions } = await import(
  "@/lib/server/actions/kill-terminal-sessions"
)

beforeEach(() => {
  vi.clearAllMocks()
  authMock.mockResolvedValue({ user: { id: "u-1" } })
  updateReturningSpy.mockResolvedValue([{ id: 11 }, { id: 12 }])
  killMutate.mockResolvedValue({})
})

describe("killTerminalSessions", () => {
  it("happy path: kills each returned session and reports the count", async () => {
    const result = await killTerminalSessions({ problemId: 1, testcaseId: 2 })

    expect(result).toEqual({ deletedSessions: 2 })
    expect(killMutate).toHaveBeenCalledTimes(2)
    expect(killMutate).toHaveBeenNthCalledWith(1, { terminal_session_id: 11 })
    expect(killMutate).toHaveBeenNthCalledWith(2, { terminal_session_id: 12 })
  })

  it("returns null when auth() returns null", async () => {
    authMock.mockResolvedValueOnce(null)

    const result = await killTerminalSessions({ problemId: 1, testcaseId: 2 })

    expect(result).toBeNull()
    expect(updateReturningSpy).not.toHaveBeenCalled()
    expect(killMutate).not.toHaveBeenCalled()
  })

  it("does NOT call the coordinator when 0 sessions were deleted", async () => {
    updateReturningSpy.mockResolvedValueOnce([])

    const result = await killTerminalSessions({ problemId: 1, testcaseId: 2 })

    expect(result).toEqual({ deletedSessions: 0 })
    expect(killMutate).not.toHaveBeenCalled()
  })
})
