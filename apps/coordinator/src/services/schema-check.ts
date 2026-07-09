import { sql } from "drizzle-orm"

import { createLogger } from "@easyshell/logger"

import { db } from "../db"

const log = createLogger("coordinator:schema-check")

export async function assertMigrationsApplied(): Promise<void> {
  let tableRows: readonly { present: number }[]
  try {
    tableRows = await db.execute<{ present: number }>(sql`
      SELECT 1 AS present
      FROM information_schema.tables
      WHERE table_name = 'easyshell_runner'
      LIMIT 1
    `)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    log.fatal(
      { error: msg },
      "coordinator.boot.schema-probe-failed — could not query Postgres object catalog; check DATABASE_URL, DB reachability, and DB user permissions before starting the coordinator",
    )
    process.exit(1)
  }
  if (tableRows.length === 0) {
    log.fatal(
      "coordinator.boot.table-missing — easyshell_runner table not resolvable via search_path; check DATABASE_URL points at the correct database and that migrations have been applied (run pnpm db:migrate or docker:migrate)",
    )
    process.exit(1)
  }

  let columnRows: readonly { present: number }[]
  try {
    columnRows = await db.execute<{ present: number }>(sql`
      SELECT 1 AS present
      FROM information_schema.columns
      WHERE table_name = 'easyshell_runner'
        AND column_name = 'revoked_at'
        AND data_type = 'timestamp with time zone'
      LIMIT 1
    `)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    log.fatal(
      { error: msg },
      "coordinator.boot.schema-probe-failed — could not query information_schema.columns; check DB user permissions",
    )
    process.exit(1)
  }
  if (columnRows.length === 0) {
    log.fatal(
      "coordinator.boot.migration-missing — easyshell_runner.revoked_at column not found OR has unexpected type (expected timestamp with time zone); run pnpm db:migrate (or docker:migrate) before starting the coordinator",
    )
    process.exit(1)
  }

  try {
    await db.execute(sql`SELECT * FROM easyshell_runner LIMIT 0`)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    log.fatal(
      { error: msg },
      "coordinator.boot.schema-probe-failed — coordinator DB user cannot SELECT from easyshell_runner; check GRANT policy before starting the coordinator",
    )
    process.exit(1)
  }

  log.debug("coordinator.boot.schema-ok")
}
