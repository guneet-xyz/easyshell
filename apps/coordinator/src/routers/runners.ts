import { initTRPC, TRPCError } from "@trpc/server"
import { and, eq } from "drizzle-orm"

import { runnerHeartbeats, runners } from "@easyshell/db/schema"
import { createLogger } from "@easyshell/logger"

import { type Context } from "../context"
import { db } from "../db"
import {
  DeregisterInputSchema,
  DeregisterOutputSchema,
  HeartbeatInputSchema,
  HeartbeatOutputSchema,
} from "../schemas"

const log = createLogger("coordinator:runners")

const t = initTRPC.context<Context>().create()
const router = t.router
const procedure = t.procedure

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
  heartbeat: runnerProcedure
    .input(HeartbeatInputSchema)
    .output(HeartbeatOutputSchema)
    .mutation(async ({ ctx, input }) => {
      const now = new Date()
      await db
        .update(runners)
        .set({ lastSeenAt: now })
        .where(eq(runners.id, ctx.runnerId))

      // The watchdog marks a silent runner stale; a heartbeat brings it back.
      // Without this a runner down for over 30s (or not started within 30s of
      // being created) never received work again. Draining and deregistered
      // runners stay as they are.
      await db
        .update(runners)
        .set({ status: "active" })
        .where(and(eq(runners.id, ctx.runnerId), eq(runners.status, "stale")))

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
