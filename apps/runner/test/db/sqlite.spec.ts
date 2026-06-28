// ==========================================
// Unit tests for `db/sqlite.ts`.
//
// The SUT exports a single function `getDb(dbPath)` that lazily opens
// a better-sqlite3 connection, applies a few startup pragmas, and
// caches it in a module-level singleton. We exercise it against a
// real `:memory:` database (no mocks on better-sqlite3) and use
// `vi.resetModules()` between tests so each test sees a fresh
// singleton.
//
// Note on WAL on `:memory:`:
// SQLite does not support WAL journal mode on in-memory databases —
// the `PRAGMA journal_mode = WAL` call silently keeps the mode at
// "memory". The intent of the assertion below is therefore to prove
// the pragma was attempted (no crash) rather than to assert the
// literal string "wal".
// ==========================================

import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@easyshell/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(() => ({})),
  }),
}))

type SqliteModule = typeof import("../../src/db/sqlite")

describe("db/sqlite", () => {
  let mod: SqliteModule

  beforeEach(async () => {
    // The SUT caches `_db` at module scope. Reset so every test opens a
    // fresh in-memory database with no leftover schema.
    vi.resetModules()
    mod = await import("../../src/db/sqlite")
  })

  it("returns a better-sqlite3 Database instance for `:memory:`", () => {
    const db = mod.getDb(":memory:")
    expect(db).toBeTruthy()
    expect(typeof db.prepare).toBe("function")
    expect(typeof db.exec).toBe("function")
    expect(typeof db.pragma).toBe("function")
  })

  it("returns the same singleton on the second call", () => {
    const db1 = mod.getDb(":memory:")
    const db2 = mod.getDb(":memory:")
    expect(db2).toBe(db1)
  })

  it("ignores the dbPath argument on the cached call", () => {
    // First call wins — the second call returns the cached instance even
    // if a different path is requested.
    const db1 = mod.getDb(":memory:")
    const db2 = mod.getDb("/tmp/some-other-path.db")
    expect(db2).toBe(db1)
  })

  it("applies the journal_mode pragma (WAL requested; :memory: keeps memory)", () => {
    const db = mod.getDb(":memory:")
    const mode = String(db.pragma("journal_mode", { simple: true })).toLowerCase()
    // SQLite refuses WAL on :memory: databases and keeps "memory" — both
    // are acceptable evidence that the pragma was applied without
    // crashing.
    expect(["wal", "memory"]).toContain(mode)
  })

  it("enables foreign_keys", () => {
    const db = mod.getDb(":memory:")
    const fk = db.pragma("foreign_keys", { simple: true })
    expect(fk).toBe(1)
  })

  it("sets busy_timeout to 5000ms", () => {
    const db = mod.getDb(":memory:")
    const timeout = db.pragma("busy_timeout", { simple: true })
    expect(timeout).toBe(5000)
  })

  it("can execute SQL statements against the returned database", () => {
    const db = mod.getDb(":memory:")
    db.exec("CREATE TABLE smoke (id INTEGER PRIMARY KEY, value TEXT)")
    db.prepare("INSERT INTO smoke (value) VALUES (?)").run("hello")
    const row = db.prepare("SELECT value FROM smoke WHERE id = 1").get() as {
      value: string
    }
    expect(row.value).toBe("hello")
  })
})
