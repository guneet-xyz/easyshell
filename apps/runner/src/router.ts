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
import { getCapacity } from "./services/capacity"

const t = initTRPC.context<Context>().create()
const router = t.router
const publicProcedure = t.procedure
const coordinatorProcedure = t.procedure.use(({ ctx, next }) => {
  if (ctx.actor !== "coordinator") {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Coordinator credentials required",
    })
  }
  return next({ ctx })
})

export const appRouter = router({
  jobs: jobsRouter,
  terminalSessions: terminalSessionsRouter,
  health: router({
    // INTENTIONALLY unauth — this is the compose healthcheck endpoint.
    ping: publicProcedure.input(HealthPingInputSchema).query(
      (): z.infer<typeof HealthPingOutputSchema> => ({
        ok: true as const,
        version: "0.1.0",
      }),
    ),
    capacity: coordinatorProcedure
      .input(HealthCapacityInputSchema)
      .query((): z.infer<typeof HealthCapacityOutputSchema> => getCapacity()),
  }),
})

export type AppRouter = typeof appRouter
