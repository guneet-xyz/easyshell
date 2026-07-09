import { beforeEach, describe, expect, it, vi } from "vitest"

// ─── Mocks must be registered before importing the SUT ──────────────────────
// The admin-runners actions call `createCoordinatorClient(...)` fresh on
// every invocation (via the internal `client()` helper in admin-runners.ts),
// so the factory here is invoked once per action call and each invocation
// gets the same set of spy fns wired underneath — that's what lets us assert
// call counts across "requireAdmin gated the request" and "coordinator was
// contacted" paths without spinning up one mock per action.

const listQueryMock = vi.fn().mockResolvedValue({ runners: [] })
const createMutateMock = vi
  .fn()
  .mockResolvedValue({ runner_id: "r-1", runner_token: "t-new" })
const revokeMutateMock = vi
  .fn()
  .mockResolvedValue({ revoked: true, runner_id: "r-1" })
const rotateMutateMock = vi
  .fn()
  .mockResolvedValue({ runner_id: "r-1", runner_token: "t-rotated" })

function makeCoordinatorClient() {
  return {
    admin: {
      runners: {
        list: { query: listQueryMock },
        create: { mutate: createMutateMock },
        revoke: { mutate: revokeMutateMock },
        rotateToken: { mutate: rotateMutateMock },
      },
    },
  }
}

const createCoordinatorClientMock = vi
  .fn()
  .mockImplementation(makeCoordinatorClient)

vi.mock("@easyshell/coordinator/client", () => ({
  createCoordinatorClient: createCoordinatorClientMock,
}))

// COORDINATOR_URL + WEBSITE_TOKEN are the only env fields admin-runners.ts
// reads (via env.COORDINATOR_URL / env.WEBSITE_TOKEN inside `client()`).
// ADMIN_EMAILS is included so the mocked env satisfies any future imports
// that transitively touch admin.ts — even though admin.ts itself is mocked
// out below, this shields against a future refactor that inlines the guard.
vi.mock("@/env", () => ({
  env: {
    COORDINATOR_URL: "http://localhost:4100",
    WEBSITE_TOKEN: "tok",
    ADMIN_EMAILS: "admin@example.com",
  },
}))

// requireAdmin — the sole seam we drive per-test. Default = admin allowed
// (returns a fake admin user); each "non-admin" test flips it to reject
// with Response(403), mirroring the real behavior of admin.ts:36.
const requireAdminMock = vi.fn().mockResolvedValue({
  id: "u-1",
  email: "admin@example.com",
  name: "Admin",
  username: "admin",
})

vi.mock("@/lib/server/admin", () => ({
  requireAdmin: requireAdminMock,
}))

// ─── SUT import (dynamic, after mocks) ──────────────────────────────────────
const { listRunners, createRunner, revokeRunner, rotateRunnerToken } =
  await import("@/lib/server/actions/admin-runners")

beforeEach(() => {
  vi.clearAllMocks()
  // Restore default implementations after clearAllMocks (which wipes call
  // history but preserves implementations; per-test `mockResolvedValueOnce`
  // / `mockRejectedValueOnce` queues also persist, so explicit resets keep
  // tests isolated).
  requireAdminMock.mockResolvedValue({
    id: "u-1",
    email: "admin@example.com",
    name: "Admin",
    username: "admin",
  })
  listQueryMock.mockResolvedValue({ runners: [] })
  createMutateMock.mockResolvedValue({
    runner_id: "r-1",
    runner_token: "t-new",
  })
  revokeMutateMock.mockResolvedValue({ revoked: true, runner_id: "r-1" })
  rotateMutateMock.mockResolvedValue({
    runner_id: "r-1",
    runner_token: "t-rotated",
  })
  // `createCoordinatorClientMock`'s implementation survives clearAllMocks,
  // but re-setting is cheap insurance against a future switch to
  // `resetAllMocks()` in this beforeEach.
  createCoordinatorClientMock.mockImplementation(makeCoordinatorClient)
})

// requireAdmin's real production throw is `throw new Response("Forbidden",
// { status: 403 })` inside an async function — which becomes a rejected
// Promise. `mockRejectedValueOnce` matches that shape exactly.
function rejectAsForbidden(): void {
  requireAdminMock.mockRejectedValueOnce(
    new Response("Forbidden", { status: 403 }),
  )
}

// Assert the shared invariant across all 4 actions: when requireAdmin
// rejects with a 403, the action re-throws that same Response AND does not
// touch the coordinator (neither the factory nor the RPC-verb spies).
async function expectForbiddenBeforeCoordinator(
  invoke: () => Promise<unknown>,
): Promise<void> {
  const err = await invoke().catch((e: unknown) => e)
  expect(err).toBeInstanceOf(Response)
  if (err instanceof Response) {
    expect(err.status).toBe(403)
  }
  expect(createCoordinatorClientMock).not.toHaveBeenCalled()
  expect(listQueryMock).not.toHaveBeenCalled()
  expect(createMutateMock).not.toHaveBeenCalled()
  expect(revokeMutateMock).not.toHaveBeenCalled()
  expect(rotateMutateMock).not.toHaveBeenCalled()
}

// ─── listRunners ───────────────────────────────────────────────────────────
describe("listRunners", () => {
  it("happy path: calls requireAdmin('/admin/runners') and returns the coordinator response", async () => {
    listQueryMock.mockResolvedValueOnce({
      runners: [
        { id: "r-1", name: "runner-1", status: "active" },
        { id: "r-2", name: "runner-2", status: "revoked" },
      ],
    })

    const result = await listRunners()

    expect(requireAdminMock).toHaveBeenCalledTimes(1)
    expect(requireAdminMock).toHaveBeenCalledWith("/admin/runners")
    expect(listQueryMock).toHaveBeenCalledTimes(1)
    expect(result).toEqual({
      runners: [
        { id: "r-1", name: "runner-1", status: "active" },
        { id: "r-2", name: "runner-2", status: "revoked" },
      ],
    })
  })

  it("failure: throws Response(403) BEFORE the coordinator is called when requireAdmin rejects", async () => {
    rejectAsForbidden()
    await expectForbiddenBeforeCoordinator(() => listRunners())
  })
})

// ─── createRunner ──────────────────────────────────────────────────────────
describe("createRunner", () => {
  const input = {
    name: "runner-1",
    public_url: "http://10.0.0.1:4200",
    region: "us-east-1",
    labels: { role: "grader" },
    version: "1.2.3",
    capabilities: [{ mode: "submission" as const, concurrency: 4 }],
  }

  it("happy path: forwards input to admin.runners.create.mutate and returns its response", async () => {
    createMutateMock.mockResolvedValueOnce({
      runner_id: "r-abc",
      runner_token: "0".repeat(64),
    })

    const result = await createRunner(input)

    expect(requireAdminMock).toHaveBeenCalledWith("/admin/runners")
    expect(createMutateMock).toHaveBeenCalledTimes(1)
    expect(createMutateMock).toHaveBeenCalledWith(input)
    expect(result).toEqual({
      runner_id: "r-abc",
      runner_token: "0".repeat(64),
    })
  })

  it("failure: throws Response(403) BEFORE the coordinator is called when requireAdmin rejects", async () => {
    rejectAsForbidden()
    await expectForbiddenBeforeCoordinator(() => createRunner(input))
  })
})

// ─── revokeRunner ──────────────────────────────────────────────────────────
describe("revokeRunner", () => {
  it("happy path: forwards runner_id to admin.runners.revoke.mutate and returns its response", async () => {
    revokeMutateMock.mockResolvedValueOnce({
      revoked: true,
      runner_id: "r-99",
    })

    const result = await revokeRunner("r-99")

    expect(requireAdminMock).toHaveBeenCalledWith("/admin/runners")
    expect(revokeMutateMock).toHaveBeenCalledTimes(1)
    expect(revokeMutateMock).toHaveBeenCalledWith({ runner_id: "r-99" })
    expect(result).toEqual({ revoked: true, runner_id: "r-99" })
  })

  it("failure: throws Response(403) BEFORE the coordinator is called when requireAdmin rejects", async () => {
    rejectAsForbidden()
    await expectForbiddenBeforeCoordinator(() => revokeRunner("r-99"))
  })
})

// ─── rotateRunnerToken ─────────────────────────────────────────────────────
describe("rotateRunnerToken", () => {
  it("happy path: returns { runner_id, runner_token } from the coordinator", async () => {
    rotateMutateMock.mockResolvedValueOnce({
      runner_id: "r-1",
      runner_token: "f".repeat(64),
    })

    const result = await rotateRunnerToken("r-1")

    expect(requireAdminMock).toHaveBeenCalledWith("/admin/runners")
    expect(rotateMutateMock).toHaveBeenCalledTimes(1)
    expect(rotateMutateMock).toHaveBeenCalledWith({ runner_id: "r-1" })
    expect(result).toEqual({ runner_id: "r-1", runner_token: "f".repeat(64) })
  })

  it("instantiates the coordinator client with env.WEBSITE_TOKEN (not the pre-rename env name)", async () => {
    // Load-bearing rename-verification assertion for Todo 16: if a future
    // edit reintroduces the pre-rename env field, the mocked env schema
    // doesn't carry that key → `opts.token` becomes `undefined` and this
    // pin fires. It also indirectly validates that rotate goes through the
    // same `client()` helper as the other actions.
    await rotateRunnerToken("r-1")

    expect(createCoordinatorClientMock).toHaveBeenCalledTimes(1)
    const call = createCoordinatorClientMock.mock.calls[0]
    expect(call).toBeDefined()
    const opts = call?.[0] as {
      url: string
      token: string
      correlationId?: string
    }
    expect(opts.url).toBe("http://localhost:4100")
    expect(opts.token).toBe("tok")
    // correlationId is a random UUID per invocation — assert only its shape,
    // not its value, so the test doesn't couple to `crypto.randomUUID()`.
    expect(opts.correlationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    )
  })

  it("failure: throws Response(403) BEFORE the coordinator is called when requireAdmin rejects", async () => {
    // Wired specifically for the rotate path — mutation-testing Todo 16's
    // failure QA: dropping `await requireAdmin(...)` from rotateRunnerToken
    // makes this test go green with a real token rotation, which is exactly
    // the regression this pin catches.
    rejectAsForbidden()
    await expectForbiddenBeforeCoordinator(() => rotateRunnerToken("r-1"))
  })
})
