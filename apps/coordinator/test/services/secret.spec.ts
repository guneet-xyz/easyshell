import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// secret.ts depends on @easyshell/logger; mock it so test output stays quiet
// and so we don't pull pino + pino-pretty into the test runtime.
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

// secret.ts imports ../env which calls createEnv() at module-load time.
// We DELIBERATELY do NOT mock ../env here — the requirement is to let the
// real env module run against a stubbed process.env so the test exercises
// the real branch logic in secret.ts that reads `env.COORDINATOR_SECRET_KEY`.
const REQUIRED_ENV: Record<string, string> = {
  DATABASE_URL: "postgres://test/test",
  COORDINATOR_TOKEN: "test-coord-token",
  COORDINATOR_REGISTRATION_TOKEN: "test-reg-token",
}

beforeEach(() => {
  // Each test re-imports secret.ts (and transitively env.ts). resetModules
  // clears the module cache so createEnv re-parses process.env with whatever
  // we just stubbed.
  vi.resetModules()
  for (const [k, v] of Object.entries(REQUIRED_ENV)) {
    vi.stubEnv(k, v)
  }
})

afterEach(() => {
  vi.unstubAllEnvs()
})

type SecretModule = typeof import("../../src/services/secret")

describe("secret — no COORDINATOR_SECRET_KEY (dev/test fallback)", () => {
  it("encryptSecret returns a base64 plaintext envelope with nonce=plaintext", async () => {
    const { encryptSecret }: SecretModule = await import(
      "../../src/services/secret"
    )
    const { ciphertext, nonce } = encryptSecret("my-runner-secret")
    expect(nonce).toBe("plaintext")
    expect(Buffer.from(ciphertext, "base64").toString("utf8")).toBe(
      "my-runner-secret",
    )
  })

  it("decryptSecret reverses the plaintext envelope round-trip", async () => {
    const { encryptSecret, decryptSecret }: SecretModule = await import(
      "../../src/services/secret"
    )
    const envelope = encryptSecret("hello")
    expect(decryptSecret(envelope.ciphertext, envelope.nonce)).toBe("hello")
  })

  it("decryptSecret throws when nonce is non-plaintext but no key is configured", async () => {
    const { decryptSecret }: SecretModule = await import(
      "../../src/services/secret"
    )
    // 12-byte hex nonce that isn't the literal "plaintext" marker.
    expect(() =>
      decryptSecret("ZmFrZWNpcGhlcnRleHQ=", "ab".repeat(12)),
    ).toThrow(/COORDINATOR_SECRET_KEY is required/)
  })
})

describe("secret — with COORDINATOR_SECRET_KEY (real AES-256-GCM)", () => {
  // 64 hex chars = 32 bytes = AES-256 key length.
  const KEY = "a".repeat(64)

  it("encryptSecret / decryptSecret roundtrip returns the original plaintext", async () => {
    vi.stubEnv("COORDINATOR_SECRET_KEY", KEY)
    const { encryptSecret, decryptSecret }: SecretModule = await import(
      "../../src/services/secret"
    )

    const plain = "abcdefghijklmnopqrstuvwxyz012345"
    const envelope = encryptSecret(plain)

    expect(envelope.nonce).not.toBe("plaintext")
    // 12-byte GCM nonce hex-encoded → 24 chars.
    expect(envelope.nonce).toHaveLength(24)
    expect(envelope.nonce).toMatch(/^[0-9a-f]{24}$/)
    expect(decryptSecret(envelope.ciphertext, envelope.nonce)).toBe(plain)
  })

  it("produces a fresh random nonce on every encryption", async () => {
    vi.stubEnv("COORDINATOR_SECRET_KEY", KEY)
    const { encryptSecret }: SecretModule = await import(
      "../../src/services/secret"
    )
    const a = encryptSecret("same-plaintext")
    const b = encryptSecret("same-plaintext")
    expect(a.nonce).not.toBe(b.nonce)
    expect(a.ciphertext).not.toBe(b.ciphertext)
  })

  it("decryptSecret throws when ciphertext is shorter than the GCM tag", async () => {
    vi.stubEnv("COORDINATOR_SECRET_KEY", KEY)
    const { decryptSecret }: SecretModule = await import(
      "../../src/services/secret"
    )
    // "YWFh" is 3 bytes of base64 → too short for the 16-byte GCM tag.
    expect(() => decryptSecret("YWFh", "ab".repeat(12))).toThrow(
      /too short to contain GCM tag/,
    )
  })

  it("decryptSecret throws when the GCM tag does not verify under a different key", async () => {
    vi.stubEnv("COORDINATOR_SECRET_KEY", KEY)
    const { encryptSecret }: SecretModule = await import(
      "../../src/services/secret"
    )
    const envelope = encryptSecret("hello")

    // Re-load the module under a DIFFERENT key. resetModules invalidates
    // both secret.ts and env.ts so createEnv re-parses process.env.
    vi.resetModules()
    for (const [k, v] of Object.entries(REQUIRED_ENV)) vi.stubEnv(k, v)
    vi.stubEnv("COORDINATOR_SECRET_KEY", "b".repeat(64))
    const { decryptSecret }: SecretModule = await import(
      "../../src/services/secret"
    )

    expect(() => decryptSecret(envelope.ciphertext, envelope.nonce)).toThrow()
  })
})
