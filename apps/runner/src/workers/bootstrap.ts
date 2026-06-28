import { createTRPCClient, httpBatchLink } from "@trpc/client"

import { createLogger } from "@easyshell/logger"

import { env } from "../env"

const log = createLogger("runner:bootstrap")

/**
 * Runs ONCE before the tRPC server starts.
 *
 * If RUNNER_ID + RUNNER_SECRET are both set → skip registration (already bootstrapped).
 * If either is missing → call coordinator.runners.register, log BOOTSTRAP-ME to stderr, then exit 0.
 * The operator reads the BOOTSTRAP-ME line, persists the credentials to env/config, and restarts the runner.
 */
export async function bootstrap(): Promise<void> {
  if (env.RUNNER_ID && env.RUNNER_SECRET) {
    log.info(
      { runner_id: env.RUNNER_ID },
      "runner.bootstrap.skipped — credentials already set",
    )
    return
  }

  log.info("runner.bootstrap.starting — registering with coordinator")

  // Build a registration-only client using the registration token. We don't have
  // type-safe access to the coordinator's AppRouter from here, so the procedure
  // shape is declared inline and cast at the call site.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const registrationClient = createTRPCClient<any>({
    links: [
      httpBatchLink({
        url: env.COORDINATOR_URL,
        headers: {
          Authorization: `Bearer ${env.COORDINATOR_REGISTRATION_TOKEN}`,
        },
      }),
    ],
  })

  let result: { runner_id: string; runner_secret: string }
  try {
    result = await (
      registrationClient as unknown as {
        runners: {
          register: {
            mutate: (input: {
              name: string
              public_url: string
              region: string | undefined
              labels: Record<string, string>
              capabilities: Array<{
                mode: "session" | "submission"
                concurrency: number
              }>
            }) => Promise<{ runner_id: string; runner_secret: string }>
          }
        }
      }
    ).runners.register.mutate({
      name: env.RUNNER_NAME,
      public_url: env.RUNNER_PUBLIC_URL,
      region: env.RUNNER_REGION,
      labels: env.RUNNER_LABELS,
      capabilities: [
        { mode: "submission", concurrency: env.SUBMISSION_MAX_CONCURRENCY },
        { mode: "session", concurrency: env.SESSION_MAX_CONCURRENCY },
      ],
    })
  } catch (err) {
    log.error(
      { error: err instanceof Error ? err.message : String(err) },
      "runner.bootstrap.registration-failed",
    )
    process.stderr.write(
      `BOOTSTRAP-FAILED: Could not register with coordinator at ${env.COORDINATOR_URL}. Check COORDINATOR_REGISTRATION_TOKEN and coordinator availability.\n`,
    )
    process.exit(1)
  }

  // IMPORTANT: Log to STDERR so ops can capture the credentials.
  // NEVER log the secret to the structured logger (stdout).
  process.stderr.write(
    `BOOTSTRAP-ME: runner_id=${result.runner_id} runner_secret=${result.runner_secret}\n` +
      `  → Set RUNNER_ID=${result.runner_id} and RUNNER_SECRET=<above> in env, then restart the runner.\n`,
  )
  log.info(
    { runner_id: result.runner_id },
    "runner.bootstrap.registered — exiting for ops to persist credentials",
  )
  process.exit(0)
}
