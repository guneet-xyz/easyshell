import { beforeEach, describe, expect, it, vi } from "vitest"

import { executionJobs, submissionTestcaseQueue } from "@easyshell/db/schema"

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

// ── runner-picker / runner-client / secret service mocks ────────────────────
type AnyFn = (...args: unknown[]) => unknown

type PickedRunner = {
  id: string
  publicUrl: string
  secretCiphertext: string
  secretNonce: string
} | null
const pickRunnerSpy = vi.fn<(mode: string) => Promise<PickedRunner>>()
vi.mock("../../src/services/runner-picker", () => ({
  pickRunner: (mode: string) => pickRunnerSpy(mode),
}))

const acceptMutateSpy = vi.fn<AnyFn>()
const createRunnerClientFromCredsSpy = vi.fn(
  (_url: string, _secret: string, _runnerId: string) => ({
    jobs: { accept: { mutate: acceptMutateSpy } },
  }),
)
vi.mock("../../src/services/runner-client", () => ({
  createRunnerClientFromCreds: (
    url: string,
    secret: string,
    runnerId: string,
  ) => createRunnerClientFromCredsSpy(url, secret, runnerId),
}))

const decryptSecretSpy = vi.fn<(ct: string, nonce: string) => string>()
vi.mock("../../src/services/secret", () => ({
  decryptSecret: (ct: string, nonce: string) => decryptSecretSpy(ct, nonce),
}))

// ── Drizzle db mock ─────────────────────────────────────────────────────────
// Two chains:
//   - select: db.select().from().where().limit(1)  → resolves to job rows
//   - update: db.update(table).set(vals).where(cond) → resolves to []
// updateCalls captures (table, set, where) tuples so each test can assert
// which table was updated with what.

const selectLimitSpy = vi.fn<AnyFn>()
const updateCalls: Array<{
  table: unknown
  set?: Record<string, unknown>
  where?: unknown
}> = []

vi.mock("../../src/db", () => {
  const selectChain = {
    from: () => selectChain,
    where: () => selectChain,
    limit: (n: number) => selectLimitSpy(n),
  }
  return {
    db: {
      select: () => selectChain,
      update: (table: unknown) => {
        const call: (typeof updateCalls)[number] = { table }
        updateCalls.push(call)
        return {
          set: (vals: Record<string, unknown>) => {
            call.set = vals
            return {
              where: (cond: unknown) => {
                call.where = cond
                return Promise.resolve([])
              },
            }
          },
        }
      },
    },
  }
})

// ── Import the SUT after all mocks are in place ─────────────────────────────
const { dispatch } = await import("../../src/services/dispatcher")

// ── Helpers ─────────────────────────────────────────────────────────────────
const baseJob = {
  id: "job-1",
  mode: "submission" as const,
  containerName: "easyshell-1",
  image: "easyshell-list-files-1",
  submissionId: 10,
  testcaseId: 2,
  result: { input: "ls -la" },
}

const baseRunner = {
  id: "runner-a",
  publicUrl: "http://10.0.0.1:4200",
  secretCiphertext: "cipher",
  secretNonce: "plaintext",
}

function updatesForTable(table: unknown): Array<(typeof updateCalls)[number]> {
  return updateCalls.filter((c) => c.table === table)
}

beforeEach(() => {
  selectLimitSpy.mockReset()
  updateCalls.length = 0
  pickRunnerSpy.mockReset()
  acceptMutateSpy.mockReset()
  createRunnerClientFromCredsSpy.mockClear()
  decryptSecretSpy.mockReset().mockImplementation((ct) => `decrypted:${ct}`)
})

// ── Tests ───────────────────────────────────────────────────────────────────

describe("dispatch — happy path (runner accepts)", () => {
  it("updates execution_job with runnerId+accepted and never reverts the queue row", async () => {
    selectLimitSpy.mockResolvedValueOnce([baseJob])
    pickRunnerSpy.mockResolvedValueOnce(baseRunner)
    acceptMutateSpy.mockResolvedValueOnce({ status: "accepted" })

    await dispatch("job-1")

    const jobUpdates = updatesForTable(executionJobs)
    expect(jobUpdates).toHaveLength(1)
    expect(jobUpdates[0]?.set).toMatchObject({
      runnerId: "runner-a",
      status: "accepted",
    })
    expect(jobUpdates[0]?.set?.acceptedAt).toBeInstanceOf(Date)
    // Queue row must NOT be touched on the happy path.
    expect(updatesForTable(submissionTestcaseQueue)).toHaveLength(0)
  })

  it("decrypts the runner secret and builds the client with the decrypted value", async () => {
    selectLimitSpy.mockResolvedValueOnce([baseJob])
    pickRunnerSpy.mockResolvedValueOnce({
      ...baseRunner,
      secretCiphertext: "blob",
      secretNonce: "plaintext",
    })
    acceptMutateSpy.mockResolvedValueOnce({ status: "accepted" })

    await dispatch("job-1")

    expect(decryptSecretSpy).toHaveBeenCalledWith("blob", "plaintext")
    expect(createRunnerClientFromCredsSpy).toHaveBeenCalledWith(
      "http://10.0.0.1:4200",
      "decrypted:blob",
      "runner-a",
    )
  })

  it("forwards the submission script as `input` to runner.jobs.accept", async () => {
    selectLimitSpy.mockResolvedValueOnce([baseJob])
    pickRunnerSpy.mockResolvedValueOnce(baseRunner)
    acceptMutateSpy.mockResolvedValueOnce({ status: "accepted" })

    await dispatch("job-1")

    expect(acceptMutateSpy).toHaveBeenCalledTimes(1)
    const arg = acceptMutateSpy.mock.calls[0]?.[0] as Record<string, unknown>
    expect(arg).toMatchObject({
      job_id: "job-1",
      container_name: "easyshell-1",
      mode: "submission",
      image: "easyshell-list-files-1",
      input: "ls -la",
      resource_limits: { memory: "10m", cpus: "0.1" },
    })
  })

  it("treats `duplicate` as an idempotent ACK (updates job, no revert)", async () => {
    selectLimitSpy.mockResolvedValueOnce([baseJob])
    pickRunnerSpy.mockResolvedValueOnce(baseRunner)
    acceptMutateSpy.mockResolvedValueOnce({ status: "duplicate" })

    await dispatch("job-1")

    const jobUpdates = updatesForTable(executionJobs)
    expect(jobUpdates).toHaveLength(1)
    expect(jobUpdates[0]?.set).toMatchObject({
      runnerId: "runner-a",
      status: "accepted",
    })
    expect(updatesForTable(submissionTestcaseQueue)).toHaveLength(0)
  })
})

describe("dispatch — at_capacity", () => {
  it("reverts the queue row to pending AND marks the job failed", async () => {
    selectLimitSpy.mockResolvedValueOnce([baseJob])
    pickRunnerSpy.mockResolvedValueOnce(baseRunner)
    acceptMutateSpy.mockResolvedValueOnce({ status: "at_capacity" })

    await dispatch("job-1")

    const queueUpdates = updatesForTable(submissionTestcaseQueue)
    expect(queueUpdates).toHaveLength(1)
    expect(queueUpdates[0]?.set).toMatchObject({
      status: "pending",
      claimedAt: null,
      claimedBy: null,
      lastError: "runner at capacity",
    })

    const jobUpdates = updatesForTable(executionJobs)
    expect(jobUpdates).toHaveLength(1)
    expect(jobUpdates[0]?.set).toMatchObject({
      status: "failed",
      errorMessage: "runner at capacity",
    })
  })
})

describe("dispatch — no runner available", () => {
  it("reverts the queue row and marks the job failed", async () => {
    selectLimitSpy.mockResolvedValueOnce([baseJob])
    pickRunnerSpy.mockResolvedValueOnce(null)

    await dispatch("job-1")

    const queueUpdates = updatesForTable(submissionTestcaseQueue)
    expect(queueUpdates).toHaveLength(1)
    expect(queueUpdates[0]?.set).toMatchObject({
      status: "pending",
      lastError: "no runner available",
    })

    const jobUpdates = updatesForTable(executionJobs)
    expect(jobUpdates).toHaveLength(1)
    expect(jobUpdates[0]?.set).toMatchObject({
      status: "failed",
      errorMessage: "no runner available",
    })

    // No runner ⇒ no decrypt, no client build, no accept call.
    expect(decryptSecretSpy).not.toHaveBeenCalled()
    expect(createRunnerClientFromCredsSpy).not.toHaveBeenCalled()
    expect(acceptMutateSpy).not.toHaveBeenCalled()
  })
})

describe("dispatch — runner client throws", () => {
  it("reverts the queue row with the thrown error message and marks the job failed", async () => {
    selectLimitSpy.mockResolvedValueOnce([baseJob])
    pickRunnerSpy.mockResolvedValueOnce(baseRunner)
    acceptMutateSpy.mockRejectedValueOnce(new Error("ECONNREFUSED"))

    // dispatch is documented to NEVER throw.
    await expect(dispatch("job-1")).resolves.toBeUndefined()

    const queueUpdates = updatesForTable(submissionTestcaseQueue)
    expect(queueUpdates).toHaveLength(1)
    expect(queueUpdates[0]?.set).toMatchObject({
      status: "pending",
      lastError: "ECONNREFUSED",
    })

    const jobUpdates = updatesForTable(executionJobs)
    expect(jobUpdates).toHaveLength(1)
    expect(jobUpdates[0]?.set).toMatchObject({
      status: "failed",
      errorMessage: "ECONNREFUSED",
    })
  })

  it("stringifies non-Error throwables when reverting", async () => {
    selectLimitSpy.mockResolvedValueOnce([baseJob])
    pickRunnerSpy.mockResolvedValueOnce(baseRunner)
    acceptMutateSpy.mockRejectedValueOnce("boom-string")

    await dispatch("job-1")

    const queueSet = updatesForTable(submissionTestcaseQueue)[0]?.set
    expect(queueSet?.lastError).toBe("boom-string")
  })
})

describe("dispatch — decryption failure", () => {
  it("reverts queue with decrypt error AND marks job failed (no runner client built)", async () => {
    selectLimitSpy.mockResolvedValueOnce([baseJob])
    pickRunnerSpy.mockResolvedValueOnce({
      ...baseRunner,
      secretNonce: "ab".repeat(12),
    })
    decryptSecretSpy.mockImplementationOnce(() => {
      throw new Error("bad tag")
    })

    await dispatch("job-1")

    const queueSet = updatesForTable(submissionTestcaseQueue)[0]?.set
    expect(queueSet?.lastError).toBe("decrypt: bad tag")
    const jobSet = updatesForTable(executionJobs)[0]?.set
    expect(jobSet?.errorMessage).toBe("decrypt runner secret: bad tag")
    expect(createRunnerClientFromCredsSpy).not.toHaveBeenCalled()
    expect(acceptMutateSpy).not.toHaveBeenCalled()
  })
})

describe("dispatch — job row not found", () => {
  it("silently returns without writing anything", async () => {
    selectLimitSpy.mockResolvedValueOnce([])
    await dispatch("missing-job")
    expect(updateCalls).toHaveLength(0)
    expect(pickRunnerSpy).not.toHaveBeenCalled()
  })
})
