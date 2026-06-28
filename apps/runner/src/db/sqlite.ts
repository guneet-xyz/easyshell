import Database from "better-sqlite3"

import { createLogger } from "@easyshell/logger"

const log = createLogger("runner:db")

let _db: Database.Database | null = null

export function getDb(dbPath: string): Database.Database {
  if (_db) return _db
  log.info({ db_path: dbPath }, "opening SQLite database")
  _db = new Database(dbPath)
  _db.pragma("journal_mode = WAL")
  _db.pragma("foreign_keys = ON")
  _db.pragma("busy_timeout = 5000")
  return _db
}
