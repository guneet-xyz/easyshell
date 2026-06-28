import crypto from "node:crypto"

import { initTRPC, TRPCError } from "@trpc/server"
import { eq } from "drizzle-orm"

import {
  runnerCapabilities,
  runnerHeartbeats,
  runners,
} from "@easyshell/db/schema"
import { createLogger } from "@easyshell/logger"

import { type Context } from "../context"
import { db } from "../db"
import {
  DeregisterInputSchema,
  DeregisterOutputSchema,
  HeartbeatInputSchema,
  HeartbeatOutputSchema,
  RegisterRunnerInputSchema,
  RegisterRunnerOutputSchema,
} from "../schemas"
import { encryptSecret } from "../services/secret"

const log = createLogger("coordinator:runners")

const t = initTRPC.context<Context>().create()
const router = t.router
const procedure = t.procedure

// Auth guards — registration token (no runnerId yet)
const registrationProcedure = procedure.use(({ ctx, next }) => {
  if (ctx.actor !== "runner" || ctx.runnerId) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Registration token required",
    })
  }
  return next({ ctx })
})

// Auth guard — per-runner secret (runnerId required)
const runnerProcedure = procedure.use(({ ctx, next }) => {
  if (ctx.actor !== "runner" || !ctx.runnerId) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Runner credentials required",
    })
  }
  return next({ ctx: { ...ctx, runnerId: ctx.runnerId } })
})

export const runnersRouter = router({
  register: registrationProcedure
    .input(RegisterRunnerInputSchema)
    .output(RegisterRunnerOutputSchema)
    .mutation(async ({ input }) => {
      const runnerId = crypto.randomUUID()
      const runnerSecret = crypto.randomBytes(32).toString("hex")
      const secretHash = crypto
        .createHash("sha256")
        .update(runnerSecret)
        .digest("hex")

      // SECURITY: store an encrypted copy so the coordinator can replay
      // the secret to the runner at dispatch / watchdog time without
      // keeping plaintext in memory between calls.
      const { ciphertext: secretCiphertext, nonce: secretNonce } =
        encryptSecret(runnerSecret)

      await db.transaction(async (tx) => {
        await tx.insert(runners).values({
          id: runnerId,
          name: input.name,
          publicUrl: input.public_url,
          secretHash,
          secretCiphertext,
          secretNonce,
          region: input.region,
          labels: input.labels,
          version: input.version,
        })

        for (const cap of input.capabilities) {
          await tx.insert(runnerCapabilities).values({
            runnerId,
            mode: cap.mode,
            concurrency: cap.concurrency,
          })
        }
      })

      log.info({ runner_id: runnerId, name: input.name }, "runner.registered")
      // SECURITY: do NOT log runnerSecret — only returned to the runner once.
      return { runner_id: runnerId, runner_secret: runnerSecret }
    }),

  heartbeat: runnerProcedure
    .input(HeartbeatInputSchema)
    .output(HeartbeatOutputSchema)
    .mutation(async ({ ctx, input }) => {
      const now = new Date()
      await db
        .update(runners)
        .set({ lastSeenAt: now })
        .where(eq(runners.id, ctx.runnerId))

      await db
        .insert(runnerHeartbeats)
        .values({
          runnerId: ctx.runnerId,
          reportedAt: now,
          sessionConcurrencyUsed: input.capacity.session_used,
          sessionConcurrencyMax: input.capacity.session_max,
          submissionConcurrencyUsed: input.capacity.submission_used,
          submissionConcurrencyMax: input.capacity.submission_max,
        })
        .onConflictDoUpdate({
          target: runnerHeartbeats.runnerId,
          set: {
            reportedAt: now,
            sessionConcurrencyUsed: input.capacity.session_used,
            sessionConcurrencyMax: input.capacity.session_max,
            submissionConcurrencyUsed: input.capacity.submission_used,
            submissionConcurrencyMax: input.capacity.submission_max,
          },
        })

      log.debug({ runner_id: ctx.runnerId }, "runner.heartbeat")
      return { status: "ack" as const }
    }),

  deregister: runnerProcedure
    .input(DeregisterInputSchema)
    .output(DeregisterOutputSchema)
    .mutation(async ({ ctx }) => {
      await db
        .update(runners)
        .set({ status: "deregistered", deregisteredAt: new Date() })
        .where(eq(runners.id, ctx.runnerId))
      log.info({ runner_id: ctx.runnerId }, "runner.deregistered")
      return { ok: true as const }
    }),
})
