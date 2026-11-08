import { beforeEach, describe, expect, it, vi } from "vitest"

// ─── Mocks must be registered before importing the SUT ──────────────────────
// vi.mock is hoisted to the top of the file, but the factory is invoked
// lazily when the mocked module is first imported. We dynamically import
// the SUT below so these top-level consts are defined by the time the
// factories run.

const terminalsCreateMutate = vi.fn().mockResolvedValue({})
const terminalsExecMutate = vi
  .fn()
  .mockResolvedValue({ status: "success", stdout: "hi\n", stderr: "" })
const terminalsIsAliveMutate = vi.fn().mockResolvedValue({ is_running: true })
const terminalsKillMutate = vi.fn().mockResolvedValue({})

vi.mock("@easyshell/coordinator/client", () => ({
  createCoordinatorClient: vi.fn().mockReturnValue({
    terminalSessions: {
      create: { mutate: terminalsCreateMutate },
      exec: { mutate: terminalsExecMutate },
      isAlive: { query: terminalsIsAliveMutate },
      kill: { mutate: terminalsKillMutate },
    },
  }),
}))

vi.mock("@/env", () => ({
  env: {
    COORDINATOR_URL: "http://localhost:4100",
    WEBSITE_TOKEN: "tok",
  },
}))

// Schema columns are passed to drizzle-orm helpers like `eq(col, value)`.
// Those helpers tolerate `undefined` because they're pure SQL builders; the
// SQL is never sent — the `db` mock short-circuits the chain below.
vi.mock("@easyshell/db/schema", () => ({
  terminalSessions: {},
  terminalSessionLogs: {},
}))

// Drizzle chain mock — captured via spies so we can assert update payloads.
const selectLimitSpy = vi.fn().mockResolvedValue([
  {
    id: 1,
    userId: "u-1",
    problemId: 1,
    testcaseId: 1,
    createdAt: new Date(),
    expiresAt: new Date(),
    deletedAt: null,
  },
])
const updateSetSpy = vi.fn()
const updateWhereSpy = vi.fn().mockResolvedValue([])
const insertReturningSpy = vi.fn().mockResolvedValue([{ id: 99 }])

vi.mock("@/db", () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: selectLimitSpy,
        }),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: (v: unknown) => {
        updateSetSpy(v)
        return { where: updateWhereSpy }
      },
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: insertReturningSpy,
      }),
    }),
  },
}))

vi.mock("@/lib/server/problems", () => ({
  getProblemSlugFromId: vi.fn().mockResolvedValue("list-files"),
}))

// ─── SUT import (dynamic, after mocks) ──────────────────────────────────────
const {
  coordinatorCreate,
  coordinatorExec,
  coordinatorIsRunning,
  coordinatorKill,
  getActiveTerminalSession,
  startTerminalSession,
} = await import("@/lib/server/coordinator")

beforeEach(() => {
  vi.clearAllMocks()
  // Restore default resolved values after clearAllMocks (which wipes call
  // history but preserves implementations; per-test `mockResolvedValueOnce`
  // queues are also preserved, so explicit resets keep tests isolated).
  selectLimitSpy.mockResolvedValue([
    {
      id: 1,
      userId: "u-1",
      problemId: 1,
      testcaseId: 1,
      createdAt: new Date(),
      expiresAt: new Date(),
      deletedAt: null,
    },
  ])
  terminalsIsAliveMutate.mockResolvedValue({ is_running: true })
  terminalsExecMutate.mockResolvedValue({
    status: "success",
    stdout: "hi\n",
    stderr: "",
  })
  updateWhereSpy.mockResolvedValue([])
})

describe("coordinatorCreate", () => {
  it("forwards args to terminalSessions.create.mutate", async () => {
    await coordinatorCreate({ terminal_session_id: 1, image: "img" })
    expect(terminalsCreateMutate).toHaveBeenCalledWith({
      terminal_session_id: 1,
      image: "img",
    })
  })
})

describe("coordinatorExec", () => {
  it("returns the mapped result and forwards mapped args", async () => {
    const result = await coordinatorExec({ sessionId: 1, command: "echo hi" })
    expect(terminalsExecMutate).toHaveBeenCalledWith({
      terminal_session_id: 1,
      command: "echo hi",
    })
    expect(result).toEqual({ status: "success", stdout: "hi\n", stderr: "" })
  })
})

describe("coordinatorIsRunning", () => {
  it("returns true when the coordinator reports is_running=true", async () => {
    const result = await coordinatorIsRunning(1)
    expect(terminalsIsAliveMutate).toHaveBeenCalledWith({
      terminal_session_id: 1,
    })
    expect(result).toBe(true)
  })
})

describe("coordinatorKill", () => {
  it("forwards the session id to terminalSessions.kill.mutate", async () => {
    await coordinatorKill(1)
    expect(terminalsKillMutate).toHaveBeenCalledWith({
      terminal_session_id: 1,
    })
  })
})

describe("getActiveTerminalSession", () => {
  it("when isAlive=false: marks the row as deleted, kills it and returns null", async () => {
    terminalsIsAliveMutate.mockResolvedValueOnce({ is_running: false })
    selectLimitSpy.mockResolvedValueOnce([
      {
        id: 1,
        userId: "u-1",
        problemId: 1,
        testcaseId: 1,
        createdAt: new Date(Date.now() - 10 * 60 * 1000),
        expiresAt: new Date(Date.now() + 50 * 60 * 1000),
        deletedAt: null,
      },
    ])

    const result = await getActiveTerminalSession({
      userId: "u-1",
      problemId: 1,
      testcaseId: 1,
    })

    expect(result).toBeNull()
    expect(updateSetSpy).toHaveBeenCalledTimes(1)
    const setArg = updateSetSpy.mock.calls[0]?.[0] as Record<string, unknown>
    expect(setArg.deletedAt).toBeInstanceOf(Date)
    expect(updateWhereSpy).toHaveBeenCalledTimes(1)
    expect(terminalsKillMutate).toHaveBeenCalledWith({ terminal_session_id: 1 })
  })

  it("returns a session that is still starting instead of discarding it", async () => {
    // Created moments ago by another request whose container is still
    // being pulled: not running yet, but not dead either.
    terminalsIsAliveMutate.mockResolvedValueOnce({ is_running: false })

    const result = await getActiveTerminalSession({
      userId: "u-1",
      problemId: 1,
      testcaseId: 1,
    })

    expect(result?.id).toBe(1)
    expect(updateSetSpy).not.toHaveBeenCalled()
    expect(terminalsKillMutate).not.toHaveBeenCalled()
  })
})

describe("startTerminalSession", () => {
  it("kills the container if the session was deleted while it started", async () => {
    selectLimitSpy.mockResolvedValueOnce([{ deletedAt: new Date() }])
    await startTerminalSession({ problemId: 1, testcaseId: 1, sessionId: 7 })
    expect(terminalsCreateMutate).toHaveBeenCalledTimes(1)
    expect(terminalsKillMutate).toHaveBeenCalledWith({ terminal_session_id: 7 })
  })

  it("leaves a session that is still wanted running", async () => {
    selectLimitSpy.mockResolvedValueOnce([{ deletedAt: null }])
    await startTerminalSession({ problemId: 1, testcaseId: 1, sessionId: 8 })
    expect(terminalsKillMutate).not.toHaveBeenCalled()
  })

  it("releases the row when the container cannot be started", async () => {
    terminalsCreateMutate.mockRejectedValueOnce(new Error("no runner"))
    await expect(
      startTerminalSession({ problemId: 1, testcaseId: 1, sessionId: 9 }),
    ).rejects.toThrow("no runner")
    const setArg = updateSetSpy.mock.calls[0]?.[0] as Record<string, unknown>
    expect(setArg.deletedAt).toBeInstanceOf(Date)
  })
})
