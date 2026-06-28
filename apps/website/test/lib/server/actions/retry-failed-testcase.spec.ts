import { beforeEach, describe, expect, it, vi } from "vitest"

// ─── Mocks must be registered before importing the SUT ──────────────────────

const authMock = vi.fn().mockResolvedValue({ user: { id: "u-1" } })
const retryTestcaseMutate = vi.fn().mockResolvedValue({ status: "queued" })

vi.mock("@easyshell/coordinator/client", () => ({
  createCoordinatorClient: vi.fn().mockReturnValue({
    submissions: {
      retryTestcase: {
        mutate: retryTestcaseMutate,
      },
    },
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

// ─── SUT import (dynamic, after mocks) ──────────────────────────────────────
const { retryFailedTestcase } = await import(
  "@/lib/server/actions/retry-failed-testcase"
)

beforeEach(() => {
  vi.clearAllMocks()
  // Restore defaults after clearAllMocks (which wipes history but preserves
  // implementations; any per-test `mockResolvedValueOnce` queue also persists,
  // so explicit resets via `.mockResolvedValue(...)` keep tests isolated).
  authMock.mockResolvedValue({ user: { id: "u-1" } })
  retryTestcaseMutate.mockResolvedValue({ status: "queued" })
})

describe("retryFailedTestcase", () => {
  it("happy path: returns the coordinator result when status=queued", async () => {
    const result = await retryFailedTestcase({
      submissionId: 10,
      testcaseId: 20,
    })

    expect(authMock).toHaveBeenCalledTimes(1)
    expect(retryTestcaseMutate).toHaveBeenCalledWith({
      acting_user_id: "u-1",
      submission_id: 10,
      testcase_id: 20,
    })
    expect(result).toEqual({ status: "queued" })
  })

  it("returns null (no throw) when auth() returns null", async () => {
    authMock.mockResolvedValueOnce(null)

    const result = await retryFailedTestcase({
      submissionId: 10,
      testcaseId: 20,
    })

    expect(result).toBeNull()
    expect(retryTestcaseMutate).not.toHaveBeenCalled()
  })

  it("throws Error('forbidden') when coordinator returns status=forbidden", async () => {
    retryTestcaseMutate.mockResolvedValueOnce({ status: "forbidden" })

    await expect(
      retryFailedTestcase({ submissionId: 10, testcaseId: 20 }),
    ).rejects.toThrow("forbidden")
  })

  it("throws when coordinator returns status=not_found", async () => {
    retryTestcaseMutate.mockResolvedValueOnce({ status: "not_found" })

    await expect(
      retryFailedTestcase({ submissionId: 10, testcaseId: 20 }),
    ).rejects.toThrow("submission not found")
  })

  it("throws when coordinator returns status=not_failed", async () => {
    retryTestcaseMutate.mockResolvedValueOnce({ status: "not_failed" })

    await expect(
      retryFailedTestcase({ submissionId: 10, testcaseId: 20 }),
    ).rejects.toThrow("cannot retry: testcase is not in failed state")
  })
})
