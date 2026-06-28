import { beforeEach, describe, expect, it, vi } from "vitest"

// ── Mocks MUST be registered before importing the SUT ───────────────────────
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

// ── Runner client mock — shared shape returned by both factory variants ────
const runnerClientCreateMutate = vi
  .fn()
  .mockResolvedValue({ status: "accepted" })
const runnerClientExecMutate = vi
  .fn()
  .mockResolvedValue({ status: "success", stdout: "hello\n", stderr: "" })
const runnerClientIsRunningQuery = vi
  .fn()
  .mockResolvedValue({ is_running: true })
const runnerClientKillMutate = vi.fn().mockResolvedValue({ ok: true })
const runnerClientJobsAcceptMutate = vi
  .fn()
  .mockResolvedValue({ status: "accepted" })
const runnerClientJobsCancelMutate = vi
  .fn()
  .mockResolvedValue({ cancelled: true })

const mockRunnerClient = {
  jobs: {
    accept: { mutate: runnerClientJobsAcceptMutate },
    cancel: { mutate: runnerClientJobsCancelMutate },
  },
  terminalSessions: {
    create: { mutate: runnerClientCreateMutate },
    exec: { mutate: runnerClientExecMutate },
    isRunning: { query: runnerClientIsRunningQuery },
    kill: { mutate: runnerClientKillMutate },
  },
}

const pickRunnerSpy = vi.fn().mockResolvedValue({
  id: "r-1",
  publicUrl: "http://localhost:4200",
  secretCiphertext: "abc",
  secretNonce: "plaintext",
})
const createRunnerClientFromDbSpy = vi
  .fn()
  .mockResolvedValue(mockRunnerClient)
const createRunnerClientFromCredsSpy = vi
  .fn()
  .mockReturnValue(mockRunnerClient)
const decryptSecretSpy = vi.fn().mockReturnValue("plaintext-secret")
const generateContainerNameSpy = vi.fn().mockReturnValue("easyshell-test-uuid")
const insertExecutionJobSpy = vi.fn().mockResolvedValue(undefined)

vi.mock("../../src/services/runner-picker", () => ({
  pickRunner: pickRunnerSpy,
}))
vi.mock("../../src/services/runner-client", () => ({
  createRunnerClientFromCreds: createRunnerClientFromCredsSpy,
  createRunnerClientFromDb: createRunnerClientFromDbSpy,
}))
vi.mock("../../src/services/secret", () => ({
  decryptSecret: decryptSecretSpy,
}))
vi.mock("../../src/services/job-name", () => ({
  generateContainerName: generateContainerNameSpy,
}))
vi.mock("../../src/services/jobs", () => ({
  insertExecutionJob: insertExecutionJobSpy,
}))

// ── Drizzle chain mock ──────────────────────────────────────────────────────
type AnyFn = (...args: unknown[]) => unknown

const selectColumnsSpy = vi.fn<AnyFn>()
const selectFromSpy = vi.fn<AnyFn>()
const selectWhereSpy = vi.fn<AnyFn>()
const selectLimitSpy = vi.fn<AnyFn>().mockResolvedValue([])

const insertTableSpy = vi.fn<AnyFn>()
const insertValuesSpy = vi.fn<AnyFn>()
const insertValuesThenSpy = vi.fn<AnyFn>().mockResolvedValue([])

const updateTableSpy = vi.fn<AnyFn>()
const updateSetSpy = vi.fn<AnyFn>()
const updateWhereSpy = vi.fn<AnyFn>()
const updateWhereThenSpy = vi.fn<AnyFn>().mockResolvedValue([])

const transactionSpy = vi.fn<AnyFn>()

vi.mock("../../src/db", () => {
  type Then = (
    onResolve: (v: unknown) => unknown,
    onReject?: (e: unknown) => unknown,
  ) => Promise<unknown>

  const selectChain = {
    from: (table: unknown) => {
      selectFromSpy(table)
      return selectChain
    },
    where: (cond: unknown) => {
      selectWhereSpy(cond)
      return selectChain
    },
    limit: (n: number) => selectLimitSpy(n),
  }

  const makeInsertChain = () => ({
    values: (vals: unknown) => {
      insertValuesSpy(vals)
      const thenable: { then: Then } = {
        then: (onResolve, onReject) =>
          (insertValuesThenSpy() as Promise<unknown>).then(onResolve, onReject),
      }
      return thenable
    },
  })

  const makeUpdateChain = () => ({
    set: (vals: unknown) => {
      updateSetSpy(vals)
      return {
        where: (cond: unknown) => {
          updateWhereSpy(cond)
          const thenable: { then: Then } = {
            then: (onResolve, onReject) =>
              (updateWhereThenSpy() as Promise<unknown>).then(
                onResolve,
                onReject,
              ),
          }
          return thenable
        },
      }
    },
  })

  return {
    db: {
      select: (cols?: unknown) => {
        selectColumnsSpy(cols)
        return selectChain
      },
      insert: (table: unknown) => {
        insertTableSpy(table)
        return makeInsertChain()
      },
      update: (table: unknown) => {
        updateTableSpy(table)
        return makeUpdateChain()
      },
      transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
        transactionSpy(fn)
        const tx = { __mock: "tx" }
        return fn(tx)
      },
    },
  }
})

// ── Import the SUT after mocks are registered ──────────────────────────────
const { terminalSessionsRouter } = await import(
  "../../src/routers/terminal-sessions"
)

beforeEach(() => {
  selectColumnsSpy.mockReset()
  selectFromSpy.mockReset()
  selectWhereSpy.mockReset()
  selectLimitSpy.mockReset().mockResolvedValue([])
  insertTableSpy.mockReset()
  insertValuesSpy.mockReset()
  insertValuesThenSpy.mockReset().mockResolvedValue([])
  updateTableSpy.mockReset()
  updateSetSpy.mockReset()
  updateWhereSpy.mockReset()
  updateWhereThenSpy.mockReset().mockResolvedValue([])
  transactionSpy.mockReset()

  pickRunnerSpy.mockReset().mockResolvedValue({
    id: "r-1",
    publicUrl: "http://localhost:4200",
    secretCiphertext: "abc",
    secretNonce: "plaintext",
  })
  createRunnerClientFromDbSpy.mockReset().mockResolvedValue(mockRunnerClient)
  insertExecutionJobSpy.mockReset().mockResolvedValue(undefined)

  runnerClientCreateMutate
    .mockReset()
    .mockResolvedValue({ status: "accepted" })
  runnerClientExecMutate
    .mockReset()
    .mockResolvedValue({ status: "success", stdout: "hello\n", stderr: "" })
  runnerClientIsRunningQuery
    .mockReset()
    .mockResolvedValue({ is_running: true })
  runnerClientKillMutate.mockReset().mockResolvedValue({ ok: true })
})

const websiteCtx = { actor: "website" as const }

describe("terminalSessions.create", () => {
  it("dispatches the session to a picked runner and records the route", async () => {
    const caller = terminalSessionsRouter.createCaller(websiteCtx)
    const result = await caller.create({
      terminal_session_id: 100,
      image: "easyshell-list-files-1",
    })

    expect(result).toEqual({
      container_name: "easyshell-test-uuid",
      runner_id: "r-1",
    })

    // The runner client was asked to spin up the session container.
    expect(runnerClientCreateMutate).toHaveBeenCalledTimes(1)
    expect(runnerClientCreateMutate).toHaveBeenCalledWith({
      container_name: "easyshell-test-uuid",
      image: "easyshell-list-files-1",
    })

    // insertExecutionJob ran inside a transaction with mode=session.
    expect(transactionSpy).toHaveBeenCalledTimes(1)
    expect(insertExecutionJobSpy).toHaveBeenCalledTimes(1)
    const [, params] = insertExecutionJobSpy.mock.calls[0] ?? []
    expect(params).toMatchObject({
      runnerId: "r-1",
      mode: "session",
      image: "easyshell-list-files-1",
      terminalSessionId: 100,
      containerName: "easyshell-test-uuid",
    })

    // Route row inserted, executionJob flipped to running.
    expect(insertTableSpy).toHaveBeenCalledTimes(1)
    const routeRow = insertValuesSpy.mock.calls[0]?.[0] as Record<
      string,
      unknown
    >
    expect(routeRow.terminalSessionId).toBe(100)
    expect(routeRow.runnerId).toBe("r-1")
    expect(routeRow.containerName).toBe("easyshell-test-uuid")

    expect(updateTableSpy).toHaveBeenCalledTimes(1)
    const setArg = updateSetSpy.mock.calls[0]?.[0] as Record<string, unknown>
    expect(setArg.status).toBe("running")
    expect(setArg.acceptedAt).toBeInstanceOf(Date)
  })

  it("throws INTERNAL_SERVER_ERROR when no runner is available", async () => {
    pickRunnerSpy.mockResolvedValueOnce(null)

    const caller = terminalSessionsRouter.createCaller(websiteCtx)
    await expect(
      caller.create({
        terminal_session_id: 100,
        image: "easyshell-list-files-1",
      }),
    ).rejects.toThrow(/no session-capable runner available/)

    // No DB writes when the picker fails.
    expect(transactionSpy).not.toHaveBeenCalled()
    expect(insertTableSpy).not.toHaveBeenCalled()
    expect(updateTableSpy).not.toHaveBeenCalled()
  })

  it("marks the job failed and rethrows when runner.create rejects", async () => {
    runnerClientCreateMutate.mockRejectedValueOnce(new Error("container exists"))

    const caller = terminalSessionsRouter.createCaller(websiteCtx)
    await expect(
      caller.create({
        terminal_session_id: 100,
        image: "easyshell-list-files-1",
      }),
    ).rejects.toThrow(/runner create failed: container exists/)

    expect(updateTableSpy).toHaveBeenCalledTimes(1)
    const setArg = updateSetSpy.mock.calls[0]?.[0] as Record<string, unknown>
    expect(setArg.status).toBe("failed")
    expect(setArg.errorMessage).toBe("container exists")
  })
})

describe("terminalSessions.exec", () => {
  it("returns the runner's success result on the happy path", async () => {
    // 1st select: terminalSessionRunners route; 2nd select: runners.status.
    selectLimitSpy
      .mockResolvedValueOnce([
        {
          terminalSessionId: 100,
          runnerId: "r-1",
          containerName: "easyshell-test-uuid",
          executionJobId: "job-1",
        },
      ])
      .mockResolvedValueOnce([{ status: "active" }])

    const caller = terminalSessionsRouter.createCaller(websiteCtx)
    const result = await caller.exec({
      terminal_session_id: 100,
      command: "ls",
    })

    expect(result).toEqual({
      status: "success",
      stdout: "hello\n",
      stderr: "",
    })
    expect(runnerClientExecMutate).toHaveBeenCalledWith({
      container_name: "easyshell-test-uuid",
      command: "ls",
    })
  })

  it("returns session_not_running when there is no route row", async () => {
    selectLimitSpy.mockResolvedValueOnce([])

    const caller = terminalSessionsRouter.createCaller(websiteCtx)
    const result = await caller.exec({
      terminal_session_id: 100,
      command: "ls",
    })

    expect(result).toEqual({
      status: "error",
      type: "session_not_running",
      message: "session not found",
    })
    expect(runnerClientExecMutate).not.toHaveBeenCalled()
  })

  it("returns runner_unreachable when the runner is stale", async () => {
    selectLimitSpy
      .mockResolvedValueOnce([
        {
          terminalSessionId: 100,
          runnerId: "r-1",
          containerName: "easyshell-test-uuid",
          executionJobId: "job-1",
        },
      ])
      .mockResolvedValueOnce([{ status: "stale" }])

    const caller = terminalSessionsRouter.createCaller(websiteCtx)
    const result = await caller.exec({
      terminal_session_id: 100,
      command: "ls",
    })

    expect(result.status).toBe("error")
    if (result.status === "error") {
      expect(result.type).toBe("runner_unreachable")
    }
    expect(runnerClientExecMutate).not.toHaveBeenCalled()
  })
})

describe("terminalSessions.isAlive", () => {
  it("returns the runner's is_running flag on the happy path", async () => {
    selectLimitSpy.mockResolvedValueOnce([
      {
        terminalSessionId: 100,
        runnerId: "r-1",
        containerName: "easyshell-test-uuid",
        executionJobId: "job-1",
      },
    ])

    const caller = terminalSessionsRouter.createCaller(websiteCtx)
    const result = await caller.isAlive({ terminal_session_id: 100 })

    expect(result).toEqual({ is_running: true })
    expect(runnerClientIsRunningQuery).toHaveBeenCalledWith({
      container_name: "easyshell-test-uuid",
    })
  })

  it("returns is_running=false when there is no route row", async () => {
    selectLimitSpy.mockResolvedValueOnce([])

    const caller = terminalSessionsRouter.createCaller(websiteCtx)
    const result = await caller.isAlive({ terminal_session_id: 100 })

    expect(result).toEqual({ is_running: false })
    expect(runnerClientIsRunningQuery).not.toHaveBeenCalled()
  })
})

describe("terminalSessions.kill", () => {
  it("kills the runner-side container and cancels the execution_job", async () => {
    selectLimitSpy.mockResolvedValueOnce([
      {
        terminalSessionId: 100,
        runnerId: "r-1",
        containerName: "easyshell-test-uuid",
        executionJobId: "job-1",
      },
    ])

    const caller = terminalSessionsRouter.createCaller(websiteCtx)
    const result = await caller.kill({ terminal_session_id: 100 })

    expect(result).toEqual({ ok: true })
    expect(runnerClientKillMutate).toHaveBeenCalledWith({
      container_name: "easyshell-test-uuid",
    })
    expect(updateTableSpy).toHaveBeenCalledTimes(1)
    const setArg = updateSetSpy.mock.calls[0]?.[0] as Record<string, unknown>
    expect(setArg.status).toBe("cancelled")
    expect(setArg.finishedAt).toBeInstanceOf(Date)
  })

  it("returns ok=true without DB writes when the route is missing", async () => {
    selectLimitSpy.mockResolvedValueOnce([])

    const caller = terminalSessionsRouter.createCaller(websiteCtx)
    const result = await caller.kill({ terminal_session_id: 100 })

    expect(result).toEqual({ ok: true })
    expect(runnerClientKillMutate).not.toHaveBeenCalled()
    expect(updateTableSpy).not.toHaveBeenCalled()
  })
})

describe("terminalSessions auth", () => {
  it("rejects a non-website caller (UNAUTHORIZED)", async () => {
    const caller = terminalSessionsRouter.createCaller({
      actor: "runner",
      runnerId: "r-1",
    })
    await expect(
      caller.create({ terminal_session_id: 100, image: "img" }),
    ).rejects.toThrow(/Website token required|UNAUTHORIZED/)
  })

  it("rejects an unauthenticated caller (UNAUTHORIZED)", async () => {
    const caller = terminalSessionsRouter.createCaller({ actor: "unauth" })
    await expect(
      caller.exec({ terminal_session_id: 100, command: "ls" }),
    ).rejects.toThrow()
  })
})
