import { beforeEach, describe, expect, it, vi } from "vitest"

// ─── Mocks must be registered before importing the SUT ──────────────────────

const authMock = vi.fn().mockResolvedValue({ user: { id: "u-1" } })
const retryAllMutate = vi
  .fn()
  .mockResolvedValue({ status: "queued", requeued_count: 2 })

vi.mock("@easyshell/coordinator/client", () => ({
  createCoordinatorClient: vi.fn().mockReturnValue({
    submissions: {
      retryAllFailedForSubmission: {
        mutate: retryAllMutate,
      },
    },
  }),
}))

vi.mock("@/env", () => ({
  env: {
    COORDINATOR_URL: "http://localhost:4100",
    WEBSITE_TOKEN: "tok",
  },
}))

vi.mock("@/lib/server/auth", () => ({
  auth: authMock,
}))

// ─── SUT import (dynamic, after mocks) ──────────────────────────────────────
const { retryAllFailedTestcases } = await import(
  "@/lib/server/actions/retry-all-failed-testcases"
)

beforeEach(() => {
  vi.clearAllMocks()
  authMock.mockResolvedValue({ user: { id: "u-1" } })
  retryAllMutate.mockResolvedValue({ status: "queued", requeued_count: 2 })
})

describe("retryAllFailedTestcases", () => {
  it("happy path: returns the coordinator result with requeued_count", async () => {
    const result = await retryAllFailedTestcases({ submissionId: 42 })

    expect(authMock).toHaveBeenCalledTimes(1)
    expect(retryAllMutate).toHaveBeenCalledWith({
      acting_user_id: "u-1",
      submission_id: 42,
    })
    expect(result).toEqual({ status: "queued", requeued_count: 2 })
  })

  it("returns null (no throw) when auth() returns null", async () => {
    authMock.mockResolvedValueOnce(null)

    const result = await retryAllFailedTestcases({ submissionId: 42 })

    expect(result).toBeNull()
    expect(retryAllMutate).not.toHaveBeenCalled()
  })

  it("throws Error('forbidden') when coordinator returns status=forbidden", async () => {
    retryAllMutate.mockResolvedValueOnce({ status: "forbidden" })

    await expect(retryAllFailedTestcases({ submissionId: 42 })).rejects.toThrow(
      "forbidden",
    )
  })
})
