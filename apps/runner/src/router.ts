import { initTRPC, TRPCError } from "@trpc/server"
import type { z } from "zod"

import { type Context } from "./context"
import {
  AcceptJobInputSchema,
  AcceptJobOutputSchema,
  CancelJobInputSchema,
  CancelJobOutputSchema,
  CreateSessionInputSchema,
  CreateSessionOutputSchema,
  ExecSessionInputSchema,
  ExecSessionOutputSchema,
  GetJobInputSchema,
  GetJobOutputSchema,
  HealthCapacityInputSchema,
  HealthCapacityOutputSchema,
  HealthPingInputSchema,
  HealthPingOutputSchema,
  IsRunningInputSchema,
  IsRunningOutputSchema,
  KillSessionInputSchema,
  KillSessionOutputSchema,
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

const notImplemented = (): never => {
  throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "not implemented" })
}

export const appRouter = router({
  jobs: router({
    accept: coordinatorProcedure
      .input(AcceptJobInputSchema)
      .mutation((): z.infer<typeof AcceptJobOutputSchema> => notImplemented()),
    get: coordinatorProcedure
      .input(GetJobInputSchema)
      .query((): z.infer<typeof GetJobOutputSchema> => notImplemented()),
    cancel: coordinatorProcedure
      .input(CancelJobInputSchema)
      .mutation((): z.infer<typeof CancelJobOutputSchema> => notImplemented()),
  }),
  terminalSessions: router({
    create: coordinatorProcedure
      .input(CreateSessionInputSchema)
      .mutation((): z.infer<typeof CreateSessionOutputSchema> => notImplemented()),
    exec: coordinatorProcedure
      .input(ExecSessionInputSchema)
      .mutation((): z.infer<typeof ExecSessionOutputSchema> => notImplemented()),
    isRunning: coordinatorProcedure
      .input(IsRunningInputSchema)
      .query((): z.infer<typeof IsRunningOutputSchema> => notImplemented()),
    kill: coordinatorProcedure
      .input(KillSessionInputSchema)
      .mutation((): z.infer<typeof KillSessionOutputSchema> => notImplemented()),
  }),
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
