import type Database from "better-sqlite3"

import { createLogger } from "@easyshell/logger"

const log = createLogger("runner:migrations")

const CURRENT_VERSION = 1

const V1_DDL = `
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY,
  applied_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS accepted_job (
  job_id           TEXT PRIMARY KEY,
  container_name   TEXT NOT NULL UNIQUE,
  image            TEXT NOT NULL,
  mode             TEXT NOT NULL CHECK (mode IN ('session','submission')),
  input            TEXT,
  status           TEXT NOT NULL CHECK (status IN ('accepted','starting','running','succeeded','failed','cancelled','lost')) DEFAULT 'accepted',
  accepted_at      INTEGER NOT NULL,
  started_at       INTEGER,
  finished_at      INTEGER,
  exit_code        INTEGER,
  stdout           TEXT,
  stderr           TEXT,
  fs               TEXT,
  error_message    TEXT,
  push_attempts    INTEGER NOT NULL DEFAULT 0,
  last_push_at     INTEGER,
  push_acked       INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_accepted_job_status ON accepted_job (status);
CREATE INDEX IF NOT EXISTS idx_accepted_job_push ON accepted_job (status, push_acked, last_push_at);

CREATE TABLE IF NOT EXISTS container (
  container_name    TEXT PRIMARY KEY,
  job_id            TEXT NOT NULL,
  docker_state      TEXT NOT NULL CHECK (docker_state IN ('starting','running','exited','removed','unknown')),
  pid               INTEGER,
  working_dir       TEXT NOT NULL,
  created_at        INTEGER NOT NULL,
  last_inspected_at INTEGER,
  FOREIGN KEY (job_id) REFERENCES accepted_job(job_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS terminal_session (
  container_name TEXT PRIMARY KEY,
  job_id         TEXT NOT NULL,
  socket_path    TEXT NOT NULL,
  created_at     INTEGER NOT NULL,
  last_exec_at   INTEGER,
  FOREIGN KEY (job_id) REFERENCES accepted_job(job_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS command_log (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  container_name TEXT NOT NULL,
  correlation_id TEXT,
  command        TEXT NOT NULL,
  stdout         TEXT,
  stderr         TEXT,
  started_at     INTEGER NOT NULL,
  finished_at    INTEGER,
  exit_status    TEXT NOT NULL CHECK (exit_status IN ('ok','timeout','locked','container_down','error'))
);
CREATE INDEX IF NOT EXISTS idx_command_log_container ON command_log (container_name, started_at);

CREATE TABLE IF NOT EXISTS cleanup_pending (
  container_name TEXT PRIMARY KEY,
  reason         TEXT NOT NULL CHECK (reason IN ('finished','cancelled','orphaned','startup_recovery')),
  queued_at      INTEGER NOT NULL,
  last_attempt_at INTEGER,
  attempts       INTEGER NOT NULL DEFAULT 0
);
`

export function migrate(db: Database.Database): void {
  // On a fresh DB the `schema_version` table does not exist yet, so the SELECT
  // throws `no such table`. Treat that as version 0.
  let currentVersion = 0
  try {
    const row = db
      .prepare(
        "SELECT version FROM schema_version ORDER BY version DESC LIMIT 1",
      )
      .get() as { version: number } | undefined
    currentVersion = row?.version ?? 0
  } catch {
    currentVersion = 0
  }

  if (currentVersion >= CURRENT_VERSION) {
    log.debug({ version: currentVersion }, "SQLite schema already up to date")
    return
  }

  log.info(
    { from: currentVersion, to: CURRENT_VERSION },
    "applying SQLite migrations",
  )
  db.exec(V1_DDL)
  db.prepare(
    "INSERT OR REPLACE INTO schema_version (version, applied_at) VALUES (?, ?)",
  ).run(CURRENT_VERSION, Date.now())
  log.info({ version: CURRENT_VERSION }, "SQLite migrations complete")
}
