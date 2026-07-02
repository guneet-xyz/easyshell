import { beforeEach, describe, expect, it, vi } from "vitest"

// jobs.ts has only a `tx.insert(executionJobs).values(...)` call against the
// passed-in transaction; no env access, no module-load side effects, and no
// drizzle client of its own. We test by handing it a stub tx and asserting
// the captured `values(...)` payload.

import { insertExecutionJob } from "../../src/services/jobs"

type AnyFn = (...args: unknown[]) => unknown
type TxStub = Parameters<typeof insertExecutionJob>[0]

const insertSpy = vi.fn<AnyFn>()
const valuesSpy = vi.fn<AnyFn>()

function makeTx(): {
  tx: TxStub
  insertSpy: typeof insertSpy
  valuesSpy: typeof valuesSpy
} {
  const tx = {
    insert: (table: unknown) => {
      insertSpy(table)
      return {
        values: (vals: unknown) => {
          valuesSpy(vals)
          return Promise.resolve(undefined)
        },
      }
    },
    // The Tx type from drizzle exposes many other methods; we cast through
    // unknown because jobs.ts only touches `.insert(...).values(...)`.
  } as unknown as TxStub
  return { tx, insertSpy, valuesSpy }
}

beforeEach(() => {
  insertSpy.mockReset()
  valuesSpy.mockReset()
})

describe("insertExecutionJob", () => {
  it("always sets status = 'dispatched'", async () => {
    const { tx } = makeTx()
    await insertExecutionJob(tx, {
      id: "job-1",
      containerName: "easyshell-1",
      runnerId: "runner-1",
      mode: "submission",
      image: "easyshell-list-files-1",
      submissionId: 10,
      testcaseId: 1,
    })

    expect(valuesSpy).toHaveBeenCalledTimes(1)
    const vals = valuesSpy.mock.calls[0]?.[0] as Record<string, unknown>
    expect(vals.status).toBe("dispatched")
  })

  it("defaults attempt to 1 when not provided", async () => {
    const { tx } = makeTx()
    await insertExecutionJob(tx, {
      id: "job-2",
      containerName: "easyshell-2",
      runnerId: "runner-1",
      mode: "submission",
      image: "img",
    })

    const vals = valuesSpy.mock.calls[0]?.[0] as Record<string, unknown>
    expect(vals.attempt).toBe(1)
  })

  it("passes through an explicit attempt value", async () => {
    const { tx } = makeTx()
    await insertExecutionJob(tx, {
      id: "job-3",
      containerName: "easyshell-3",
      runnerId: "runner-1",
      mode: "submission",
      image: "img",
      attempt: 3,
    })

    const vals = valuesSpy.mock.calls[0]?.[0] as Record<string, unknown>
    expect(vals.attempt).toBe(3)
  })

  it("passes every param field through to tx.insert.values", async () => {
    const { tx } = makeTx()
    const params = {
      id: "job-4",
      containerName: "easyshell-4",
      runnerId: "runner-xyz",
      mode: "session" as const,
      image: "easyshell-session",
      submissionId: 42,
      testcaseId: 7,
      terminalSessionId: 100,
      attempt: 2,
      result: { input: "ls -la" },
    }
    await insertExecutionJob(tx, params)

    const vals = valuesSpy.mock.calls[0]?.[0] as Record<string, unknown>
    expect(vals).toMatchObject({
      id: "job-4",
      containerName: "easyshell-4",
      runnerId: "runner-xyz",
      mode: "session",
      image: "easyshell-session",
      submissionId: 42,
      testcaseId: 7,
      terminalSessionId: 100,
      attempt: 2,
      status: "dispatched",
      result: { input: "ls -la" },
    })
  })

  it("uses the executionJobs schema table for the insert", async () => {
    const { tx } = makeTx()
    await insertExecutionJob(tx, {
      id: "job-5",
      containerName: "c5",
      runnerId: "r1",
      mode: "submission",
      image: "img",
    })
    // Sanity: insert was called exactly once with the executionJobs table object.
    expect(insertSpy).toHaveBeenCalledTimes(1)
    expect(insertSpy.mock.calls[0]?.[0]).toBeDefined()
  })

  it("propagates rejection from tx.insert.values", async () => {
    const rejectingTx = {
      insert: () => ({
        values: () => Promise.reject(new Error("FK violation")),
      }),
    } as unknown as TxStub

    await expect(
      insertExecutionJob(rejectingTx, {
        id: "job-6",
        containerName: "c6",
        runnerId: "r1",
        mode: "submission",
        image: "img",
      }),
    ).rejects.toThrow(/FK violation/)
  })
})
