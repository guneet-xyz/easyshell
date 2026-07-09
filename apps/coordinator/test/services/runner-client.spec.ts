import { beforeEach, describe, expect, it, vi } from "vitest"

// ── Mocks MUST be registered before importing the SUT ───────────────────────
vi.mock("../../src/env", () => ({
  env: {
    DATABASE_URL: "postgres://test",
    WEBSITE_TOKEN: "test-website-token",
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

// @trpc/client — capture createTRPCClient/httpBatchLink calls and return a
// stub that satisfies the `RunnerJobsClient` shape used by the SUT.
type AnyFn = (...args: unknown[]) => unknown
const createTRPCClientSpy = vi.fn<AnyFn>()
const httpBatchLinkSpy = vi.fn<AnyFn>()

const trpcClientStub = {
  jobs: {
    accept: { mutate: vi.fn(async () => ({ status: "accepted" as const })) },
    get: { query: vi.fn(async () => ({ status: "unknown" as const })) },
    cancel: {
      mutate: vi.fn(async () => ({ ok: true as const, was_running: false })),
    },
  },
  terminalSessions: {
    create: { mutate: vi.fn(async () => ({ ok: true as const })) },
    exec: {
      mutate: vi.fn(async () => ({
        status: "success" as const,
        stdout: "",
        stderr: "",
      })),
    },
    isRunning: { query: vi.fn(async () => ({ is_running: false })) },
    kill: { mutate: vi.fn(async () => ({ ok: true as const })) },
  },
}

vi.mock("@trpc/client", () => ({
  createTRPCClient: (opts: unknown) => {
    createTRPCClientSpy(opts)
    return trpcClientStub
  },
  httpBatchLink: (opts: unknown) => {
    httpBatchLinkSpy(opts)
    // The real httpBatchLink returns a TRPCLink; the stub just needs to be
    // truthy so it can be placed into `links: [...]`.
    return { __link: true, opts }
  },
}))

// Select chain: db.select(cols).from(t).where(c).limit(n)
const selectColumnsSpy = vi.fn<AnyFn>()
const selectFromSpy = vi.fn<AnyFn>()
const selectWhereSpy = vi.fn<AnyFn>()
const selectLimitSpy = vi.fn<AnyFn>()

vi.mock("../../src/db", () => {
  const chain = {
    from: (t: unknown) => {
      selectFromSpy(t)
      return chain
    },
    where: (c: unknown) => {
      selectWhereSpy(c)
      return chain
    },
    limit: (n: number) => selectLimitSpy(n),
  }
  return {
    db: {
      select: (cols: unknown) => {
        selectColumnsSpy(cols)
        return chain
      },
    },
  }
})

// ── Import the SUT after all mocks are in place ─────────────────────────────
const { createRunnerClientFromCreds, createRunnerClientFromDb } = await import(
  "../../src/services/runner-client"
)

beforeEach(() => {
  createTRPCClientSpy.mockReset()
  httpBatchLinkSpy.mockReset()
  selectColumnsSpy.mockReset()
  selectFromSpy.mockReset()
  selectWhereSpy.mockReset()
  selectLimitSpy.mockReset().mockResolvedValue([])
})

describe("createRunnerClientFromCreds", () => {
  it("returns an object whose jobs.accept is callable", () => {
    const client = createRunnerClientFromCreds(
      "http://10.0.0.1:4200",
      "secret-abc",
      "runner-1",
    )
    expect(client.jobs.accept).toBeDefined()
    expect(typeof client.jobs.accept.mutate).toBe("function")
  })

  it("wires httpBatchLink with the public URL and bearer auth headers", () => {
    createRunnerClientFromCreds(
      "http://10.0.0.5:4200",
      "the-secret",
      "runner-xyz",
    )

    expect(httpBatchLinkSpy).toHaveBeenCalledTimes(1)
    const linkOpts = httpBatchLinkSpy.mock.calls[0]?.[0] as {
      url: string
      headers: Record<string, string>
    }
    expect(linkOpts.url).toBe("http://10.0.0.5:4200")
    expect(linkOpts.headers.Authorization).toBe("Bearer the-secret")
    expect(linkOpts.headers["x-coordinator-runner-id"]).toBe("runner-xyz")
  })

  it("passes the link into createTRPCClient via the `links` array", () => {
    createRunnerClientFromCreds("http://x", "s", "r")
    expect(createTRPCClientSpy).toHaveBeenCalledTimes(1)
    const clientOpts = createTRPCClientSpy.mock.calls[0]?.[0] as {
      links: unknown[]
    }
    expect(Array.isArray(clientOpts.links)).toBe(true)
    expect(clientOpts.links).toHaveLength(1)
  })
})

describe("createRunnerClientFromDb", () => {
  it("looks the runner up by id and returns a wired client", async () => {
    selectLimitSpy.mockResolvedValueOnce([
      {
        publicUrl: "http://10.0.0.9:4200",
        // Plaintext envelope: decryptSecret will base64-decode and return
        // the raw bytes since COORDINATOR_SECRET_KEY is unset in the mocked
        // env (nonce === "plaintext" branch).
        secretCiphertext: Buffer.from("decoded-secret").toString("base64"),
        secretNonce: "plaintext",
      },
    ])

    const client = await createRunnerClientFromDb("runner-42")

    expect(selectColumnsSpy).toHaveBeenCalledTimes(1)
    expect(selectFromSpy).toHaveBeenCalledTimes(1)
    expect(selectWhereSpy).toHaveBeenCalledTimes(1)
    expect(selectLimitSpy).toHaveBeenCalledWith(1)

    // The decrypted secret must reach httpBatchLink as the bearer token.
    expect(httpBatchLinkSpy).toHaveBeenCalledTimes(1)
    const linkOpts = httpBatchLinkSpy.mock.calls[0]?.[0] as {
      url: string
      headers: Record<string, string>
    }
    expect(linkOpts.url).toBe("http://10.0.0.9:4200")
    expect(linkOpts.headers.Authorization).toBe("Bearer decoded-secret")
    expect(linkOpts.headers["x-coordinator-runner-id"]).toBe("runner-42")

    expect(typeof client.jobs.accept.mutate).toBe("function")
  })

  it("throws when no runner row is found", async () => {
    selectLimitSpy.mockResolvedValueOnce([])
    await expect(createRunnerClientFromDb("missing-id")).rejects.toThrow(
      /Runner missing-id not found/,
    )
    // No client should have been built.
    expect(createTRPCClientSpy).not.toHaveBeenCalled()
    expect(httpBatchLinkSpy).not.toHaveBeenCalled()
  })

  it("propagates a decryption failure (non-plaintext nonce without a key)", async () => {
    selectLimitSpy.mockResolvedValueOnce([
      {
        publicUrl: "http://10.0.0.10:4200",
        secretCiphertext: "Zm9v", // arbitrary base64
        secretNonce: "ab".repeat(12), // 24-char hex → triggers GCM branch
      },
    ])
    await expect(createRunnerClientFromDb("runner-77")).rejects.toThrow(
      /COORDINATOR_SECRET_KEY is required/,
    )
    expect(createTRPCClientSpy).not.toHaveBeenCalled()
  })
})
