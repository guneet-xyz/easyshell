// ==========================================
// Pino-based structured logger factory.
//
// Usage:
//   const log = createLogger("coordinator", { runner_id: "r-1" })
//   log.info({ job_id: "j-9" }, "started job")
//
// Every log line emitted by the returned child logger automatically carries
// the `service` field. Callers can attach additional context via the
// `baseContext` argument or by creating further child loggers with
// `log.child({ correlation_id, job_id, ... })`.
// ==========================================

import pino from "pino"

export function createLogger(
  service: string,
  baseContext?: Record<string, unknown>,
): pino.Logger {
  const level = process.env.LOG_LEVEL ?? "info"

  // `pino-pretty` is a devDependency and may not be installed in production
  // containers. Wiring it through pino's `transport` option keeps the import
  // lazy so production never tries to resolve it.
  const transport =
    process.env.NODE_ENV !== "production"
      ? { target: "pino-pretty", options: { colorize: true } }
      : undefined

  const logger = pino({ level, transport })

  return logger.child({ service, ...baseContext })
}
