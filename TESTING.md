# Testing

This project uses a layered test strategy across three levels:

```
Unit (Vitest, mocked deps)
  │
  ├─ apps/coordinator/test/  — 13 spec files, 123 tests
  ├─ apps/runner/test/       — 11 spec files, 106 tests
  ├─ apps/website/test/      — 4 spec files, 16 tests
  └─ packages/logger/test/   — 1 spec file, 4 tests

Integration (Vitest, real SQLite :memory:)
  └─ runner tests that use better-sqlite3 :memory: databases

E2E (Vitest + Testcontainers, real Postgres + Docker)
  └─ apps/e2e/test/  — boots a real coordinator + runner + Postgres
```

## Quick start

| Command | What it does |
|---|---|
| `pnpm test` | Run all unit tests across all workspace packages |
| `pnpm test:coverage` | Unit tests + coverage gate (coordinator ≥70%, runner ≥70%) |
| `pnpm test:e2e` | E2E suite, requires Docker |
| `pnpm --filter @easyshell/coordinator test:watch` | Watch mode for coordinator |

## Unit test conventions

### File layout
Test files mirror the `src/` layout under `test/`:
```
apps/coordinator/src/services/dispatcher.ts
→ apps/coordinator/test/services/dispatcher.spec.ts

apps/runner/src/workers/recovery.ts
→ apps/runner/test/workers/recovery.spec.ts
```

All test files use the `.spec.ts` suffix.

### Mock ordering (CRITICAL)
Vitest hoists `vi.mock(...)` calls. Always declare mocks **before** any imports, and import the SUT via dynamic `await import(...)` **after** all mocks are registered:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest"

// 1. Mocks first, before any SUT imports
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

// 2. SUT imported AFTER mocks
const { myFunction } = await import("../../src/services/my-service")

describe("myFunction", () => {
  it("happy path", () => { ... })
  it("error path", () => { ... })
})
```

### Mutable env state with vi.hoisted
When a test needs to change env values between test cases (e.g., testing both "key set" and "key unset" branches), use `vi.hoisted`:

```ts
const { envState } = vi.hoisted(() => ({
  envState: {
    DOCKER_REGISTRY: "" as string | undefined,
    // ... other fields
  },
}))

vi.mock("../../src/env", () => ({ env: envState }))

// In tests:
it("with registry", () => {
  envState.DOCKER_REGISTRY = "ghcr.io/myorg"
  // test...
})
```

### 8-line logger mock (copy-paste)
```ts
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
```

### Drizzle chain mock
For tests that need to assert Drizzle query calls, build chainable spies that mirror the fluent API:

```ts
type AnyFn = (...args: unknown[]) => unknown
const insertSpy = vi.fn<AnyFn>()
const insertValuesSpy = vi.fn<AnyFn>()
const onConflictSpy = vi.fn<AnyFn>().mockResolvedValue([])

vi.mock("../../src/db", () => ({
  db: {
    insert: (table: unknown) => {
      insertSpy(table)
      return {
        values: (vals: unknown) => {
          insertValuesSpy(vals)
          return { onConflictDoNothing: onConflictSpy }
        },
      }
    },
  },
}))
```

See `apps/coordinator/test/workers/queue-poller.spec.ts` for a complete CTE chain mock example.

### Runner SQLite tests
Runner tests that exercise the SQLite layer use real `better-sqlite3` with an `:memory:` database, **never a real file path**:

```ts
import Database from "better-sqlite3"
import { runMigrations } from "../../src/db/migrations"

let testDb: Database.Database

beforeEach(() => {
  testDb = new Database(":memory:")
  runMigrations(testDb)
})

vi.mock("../../src/db/sqlite", () => ({
  getDb: () => testDb,
}))
```

### tRPC router tests
Call router procedures via `createCaller`:
```ts
const { myRouter } = await import("../../src/routers/my-router")

const caller = myRouter.createCaller({ actor: "coordinator" })
const result = await caller.myProcedure({ ... })
expect(result).toMatchObject({ ... })
```

### Adding a test for a new file
When you add a new source file:
1. Create a matching spec file in `test/` mirroring the `src/` path
2. Add at minimum: one happy-path test and one failure/error-path test
3. Run `pnpm --filter @easyshell/<package> test` to verify before committing

---

## E2E conventions

The e2e suite lives in `apps/e2e/` and uses Vitest's `globalSetup` to boot a real stack:

1. **Postgres Testcontainer**, a real PostgreSQL instance (no mocks)
2. **Drizzle migrations**, run via `drizzle-kit migrate` child process
3. **Coordinator process**, `apps/coordinator/coordinator.cjs` on port 4199
4. **Runner process**, `apps/runner/runner.cjs` on port 4299

### Running e2e locally
```bash
pnpm test:e2e
```
Requires Docker to be running. The suite boots the full stack, runs tests, then tears everything down.

### Adding an e2e scenario
Add a new `it(...)` block in `apps/e2e/test/scenarios.spec.ts`. Use the shared state written by setup:

```ts
import { readFileSync } from "node:fs"

const state = JSON.parse(readFileSync("/tmp/easyshell-e2e-state.json", "utf-8"))
const client = createCoordinatorClient({ url: state.coordinatorUrl, token: state.coordinatorToken })
```

Use a 120s per-test timeout (already configured in `apps/e2e/vitest.config.ts`).

---

## Coverage

Coverage is enforced on `apps/coordinator` and `apps/runner` only.

| Package | Lines | Functions | Branches | Statements |
|---|---|---|---|---|
| apps/coordinator | ≥70% | ≥70% | ≥60% | ≥70% |
| apps/runner | ≥70% | ≥70% | ≥60% | ≥70% |

Run with HTML report:
```bash
pnpm test:coverage
open apps/coordinator/coverage/index.html
open apps/runner/coverage/index.html
```

Excluded from gate: `apps/website`, `packages/logger`, `packages/db`, `packages/utils`.

---

## For AI Agents

Rules for any AI agent (Claude, Sisyphus, Codex, or any future agent) working in this codebase:

1. **Run `pnpm test` before every commit.** Zero test failures is the gate. If you broke something, fix it before moving on.

2. **Mirror `src/` layout in `test/`.** If you add `apps/coordinator/src/services/foo.ts`, you must also add `apps/coordinator/test/services/foo.spec.ts`. No exceptions.

3. **Minimum per new file: happy path + failure path.** A spec file with only `expect(true).toBe(true)` or that only asserts mocks were called (without asserting observable behavior) does NOT count. Every new file needs at least one test of what it produces and one test of what happens when something goes wrong.

4. **Use vi.mock + vi.hoisted for env, never import env directly in tests.** Real env vars will break tests in CI.

5. **Never edit a `.spec.ts` file to make a test pass.** Fix the SUT, or update both the spec and the SUT deliberately and add a comment explaining the behavior change.

6. **For runner tests involving SQLite, always use `:memory:`.** Never use a real file path. Real files pollute the repo and create flaky tests.

7. **Do NOT add production dependencies to `apps/e2e`.** It is a test-only package. Any dep you add there must go in `devDependencies`.

8. **Do NOT include `packages/problems` in `pnpm test`.** Its `test` script runs Docker builds and is not part of the unit test suite.

### Copy-paste spec skeleton

```ts
import { beforeEach, describe, expect, it, vi } from "vitest"

// ── Mocks MUST be registered before importing the SUT ─────────────────────
vi.mock("../../src/env", () => ({
  env: {
    // Fill in all env fields used by the SUT
    LOG_LEVEL: "silent",
    NODE_ENV: "test",
  },
}))

vi.mock("@easyshell/logger", () => ({
  createLogger: () => ({
    info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn(),
    trace: vi.fn(), fatal: vi.fn(), child: vi.fn(() => ({})),
  }),
}))

// Add db/client mocks here if needed
// vi.mock("../../src/db", () => ({ db: { ... } }))

// ── Import the SUT after mocks are registered ─────────────────────────────
const { myExport } = await import("../../src/path/to/sut")

// ── Test setup ───────────────────────────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks()
})

// ── Tests ────────────────────────────────────────────────────────────────
describe("myExport", () => {
  it("happy path: returns expected value", async () => {
    const result = await myExport({ /* valid input */ })
    expect(result).toMatchObject({ /* expected shape */ })
  })

  it("failure path: throws / returns error on invalid input", async () => {
    await expect(myExport({ /* invalid input */ })).rejects.toThrow(/expected error/)
    // OR: expect(result.status).toBe("error")
  })
})
```
