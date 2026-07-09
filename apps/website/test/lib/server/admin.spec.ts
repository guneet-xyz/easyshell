import { beforeEach, describe, expect, it, vi } from "vitest"

// ─── Mocks must be registered before importing the SUT ──────────────────────
// admin.ts computes `ADMIN_EMAIL_SET` at module-load time
// (`const ADMIN_EMAIL_SET = parseAdminEmails(env.ADMIN_EMAILS)`), so the env
// mock MUST be in place before the dynamic SUT import below — otherwise the
// module snapshots the wrong value and every test in this file misfires.

const authMock = vi.fn().mockResolvedValue({ user: { id: "u-1" } })

// `redirect()` from next/navigation throws a `NEXT_REDIRECT` sentinel in
// production to unwind the server component. We mirror the "throw with the
// destination attached" shape so tests can assert the callback URL that the
// user would end up seeing without importing NextJS's internals.
const redirectMock = vi.fn((url: string): never => {
  throw new Error(`REDIRECT:${url}`)
})

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}))

// ADMIN_EMAILS deliberately mixes casings on BOTH sides of the comma —
// exercises the parser's trim + lowercase pipeline (admin.ts:8-9) and pins
// the assumption that the set is casing-independent by construction, not by
// accident of formatting in the env file.
vi.mock("@/env", () => ({
  env: {
    ADMIN_EMAILS: "Admin@Example.com, ops@example.com",
  },
}))

vi.mock("@/lib/server/auth", () => ({
  auth: authMock,
}))

// Schema columns get passed to drizzle-orm helpers (`eq(users.id, ...)`),
// which tolerate `undefined` because they're pure SQL builders — the SQL is
// never dispatched thanks to the `db` mock below.
vi.mock("@easyshell/db/schema", () => ({
  users: {
    id: {},
    email: {},
    name: {},
    username: {},
  },
}))

// Drizzle chain mock — `db.select({...}).from(t).where(c).limit(n)` resolves
// to whatever `selectLimitSpy` is configured with, swapped per-test via
// `mockResolvedValueOnce`.
const selectLimitSpy = vi.fn().mockResolvedValue([])

vi.mock("@/db", () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: selectLimitSpy,
        }),
      }),
    }),
  },
}))

// ─── SUT import (dynamic, after mocks) ──────────────────────────────────────
const { requireAdmin } = await import("@/lib/server/admin")

beforeEach(() => {
  vi.clearAllMocks()
  // Restore defaults after `clearAllMocks` (which wipes call history but
  // preserves implementations; per-test `mockResolvedValueOnce` queues are
  // preserved, so an explicit `.mockResolvedValue(...)` reset keeps tests
  // isolated).
  authMock.mockResolvedValue({ user: { id: "u-1" } })
  selectLimitSpy.mockResolvedValue([])
})

describe("requireAdmin", () => {
  it("happy path: returns AdminUser when the email is in ADMIN_EMAILS (case-insensitive on the INPUT side)", async () => {
    // ADMIN_EMAILS contains "Admin@Example.com". The user's DB row here has
    // "ADMIN@example.COM" — different casing on every letter position but
    // the same email semantically. The parser lowercases the env entries and
    // the guard lowercases the input, so this must match.
    selectLimitSpy.mockResolvedValueOnce([
      {
        id: "u-1",
        email: "ADMIN@example.COM",
        name: "Admin One",
        username: "admin1",
      },
    ])

    const result = await requireAdmin("/admin/runners")

    expect(result).toEqual({
      id: "u-1",
      email: "ADMIN@example.COM",
      name: "Admin One",
      username: "admin1",
    })
    expect(redirectMock).not.toHaveBeenCalled()
    expect(authMock).toHaveBeenCalledTimes(1)
  })

  it("happy path: matches when the ENV-side casing differs from the input casing", async () => {
    // ADMIN_EMAILS contains "ops@example.com" (already lowercase). The DB
    // row has "Ops@Example.com" — exercising the other direction of the
    // lowercase pipeline (input mixed → env lowercase). Pins that both
    // sides of the comparison are normalized, not just one.
    selectLimitSpy.mockResolvedValueOnce([
      {
        id: "u-2",
        email: "Ops@Example.com",
        name: "Ops",
        username: "ops",
      },
    ])

    const result = await requireAdmin("/admin/runners")
    expect(result.id).toBe("u-2")
    expect(result.email).toBe("Ops@Example.com")
    expect(redirectMock).not.toHaveBeenCalled()
  })

  it("failure: throws Response(403) when the user's email is NOT in ADMIN_EMAILS", async () => {
    selectLimitSpy.mockResolvedValueOnce([
      {
        id: "u-1",
        email: "outsider@example.com",
        name: "Not Admin",
        username: "notadmin",
      },
    ])

    // Catch-then-inspect rather than `.rejects.toBeInstanceOf` so we can
    // narrow the thrown value and assert on `.status` without an unsafe cast.
    const err = await requireAdmin("/admin/runners").catch((e: unknown) => e)
    expect(err).toBeInstanceOf(Response)
    if (err instanceof Response) {
      expect(err.status).toBe(403)
    }
    // Non-admin authenticated user is a 403, NOT a redirect — the two
    // failure modes must stay distinct.
    expect(redirectMock).not.toHaveBeenCalled()
  })

  it("failure: unauthenticated (auth() returns null) triggers redirect to /login?callback=<pathname>", async () => {
    authMock.mockResolvedValueOnce(null)

    // Our redirect mock throws `REDIRECT:<url>` so we can assert the URL
    // without relying on Next's private NEXT_REDIRECT sentinel.
    await expect(requireAdmin("/admin/runners")).rejects.toThrow(
      "REDIRECT:/login?callback=%2Fadmin%2Frunners",
    )
    expect(redirectMock).toHaveBeenCalledTimes(1)
    expect(redirectMock).toHaveBeenCalledWith(
      "/login?callback=%2Fadmin%2Frunners",
    )
    // Redirect fires BEFORE the DB is touched — session gate is first.
    expect(selectLimitSpy).not.toHaveBeenCalled()
  })

  it("failure: session present but DB row has no email → redirects (post-DB branch)", async () => {
    // Rare but real: NextAuth session cookie is valid, but the underlying
    // users row has `email = NULL` (e.g. a mid-migration state or a
    // deleted-then-restored row). admin.ts:34 treats this identically to
    // unauthenticated — redirect to login.
    selectLimitSpy.mockResolvedValueOnce([
      {
        id: "u-1",
        email: null,
        name: "No Email",
        username: "noemail",
      },
    ])

    await expect(requireAdmin("/admin/runners")).rejects.toThrow(
      "REDIRECT:/login?callback=%2Fadmin%2Frunners",
    )
    expect(redirectMock).toHaveBeenCalledWith(
      "/login?callback=%2Fadmin%2Frunners",
    )
  })

  it("preserves the callback pathname through URL encoding (query strings, unicode)", async () => {
    // Any non-trivial pathname must survive encodeURIComponent so the
    // login page's callback= param round-trips cleanly.
    authMock.mockResolvedValueOnce(null)

    await expect(
      requireAdmin("/admin/runners?filter=active&sort=name"),
    ).rejects.toThrow(
      "REDIRECT:/login?callback=%2Fadmin%2Frunners%3Ffilter%3Dactive%26sort%3Dname",
    )
  })
})
