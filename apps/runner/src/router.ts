import { initTRPC, TRPCError } from "@trpc/server"
import type { z } from "zod"

import { type Context } from "./context"
import { jobsRouter } from "./routers/jobs"
import { terminalSessionsRouter } from "./routers/terminal-sessions"
import {
  HealthCapacityInputSchema,
  HealthCapacityOutputSchema,
  HealthPingInputSchema,
  HealthPingOutputSchema,
} from "./schemas"

const t = initTRPC.context<Context>().create()
const router = t.router
const publicProcedure = t.procedure
const coordinatorProcedure = t.procedure.use(({ ctx, next }) => {
  if (ctx.actor !== "coordinator") {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Coordinator credentials required" })
  }
  return next({ ctx })
})

export const appRouter = router({
  jobs: jobsRouter,
  terminalSessions: terminalSessionsRouter,
  health: router({
    // INTENTIONALLY unauth — this is the compose healthcheck endpoint.
    ping: publicProcedure
      .input(HealthPingInputSchema)
      .query(
        (): z.infer<typeof HealthPingOutputSchema> => ({
          ok: true as const,
          version: "0.1.0",
        }),
      ),
    // Requires auth. T22 will replace these with live in-memory counters.
    // For now, _used is always 0 and _max comes from env defaults (hardcoded here
    // to keep the router free of env coupling; values mirror env.ts defaults).
    capacity: coordinatorProcedure
      .input(HealthCapacityInputSchema)
      .query(
        (): z.infer<typeof HealthCapacityOutputSchema> => ({
          session_used: 0,
          session_max: 64,
          submission_used: 0,
          submission_max: 4,
        }),
      ),
  }),
})

export type AppRouter = typeof appRouter
