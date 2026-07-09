import { sql } from "drizzle-orm"

import { createLogger } from "@easyshell/logger"

import { db } from "../db"

const log = createLogger("coordinator:schema-check")

export async function assertMigrationsApplied(): Promise<void> {
  let tableOid: unknown
  try {
    const tableResult = await db.execute(
      sql`SELECT to_regclass('easyshell_runner') AS oid`,
    )
    // postgres-js returns array directly; first row's oid field
    tableOid =
      (tableResult as unknown as Array<Record<string, unknown>>)[0]?.oid ?? null
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    log.fatal(
      { error: msg },
      "coordinator.boot.schema-probe-failed — could not query Postgres object catalog; check DATABASE_URL, DB reachability, and DB user permissions before starting the coordinator",
    )
    process.exit(1)
  }
  if (tableOid === null || tableOid === undefined) {
    log.fatal(
      "coordinator.boot.table-missing — easyshell_runner table not resolvable via search_path; check DATABASE_URL points at the correct database and that migrations have been applied (run pnpm db:migrate or docker:migrate)",
    )
    process.exit(1)
  }

  let columnRows: unknown[]
  try {
    const result = await db.execute(sql`
      SELECT 1 FROM pg_attribute
      WHERE attrelid = ${tableOid}::regclass
        AND attname = 'revoked_at'
        AND atttypid = 'pg_catalog.timestamptz'::regtype
        AND NOT attisdropped
    `)
    columnRows = result as unknown as unknown[]
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    log.fatal(
      { error: msg },
      "coordinator.boot.schema-probe-failed — could not query pg_attribute; check DB user permissions",
    )
    process.exit(1)
  }
  if (columnRows.length === 0) {
    log.fatal(
      "coordinator.boot.migration-missing — easyshell_runner.revoked_at column not found OR has unexpected type (expected timestamptz); run pnpm db:migrate (or docker:migrate) before starting the coordinator",
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
