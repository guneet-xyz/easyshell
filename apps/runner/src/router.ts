import { initTRPC, TRPCError } from "@trpc/server"
import type { z } from "zod"
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

export type Context = {
  actor: "coordinator" | "unauth"
}

const t = initTRPC.context<Context>().create()
const router = t.router
const publicProcedure = t.procedure

const notImplemented = (): never => {
  throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "not implemented" })
}

export const appRouter = router({
  jobs: router({
    accept: publicProcedure
      .input(AcceptJobInputSchema)
      .mutation((): z.infer<typeof AcceptJobOutputSchema> => notImplemented()),
    get: publicProcedure
      .input(GetJobInputSchema)
      .query((): z.infer<typeof GetJobOutputSchema> => notImplemented()),
    cancel: publicProcedure
      .input(CancelJobInputSchema)
      .mutation((): z.infer<typeof CancelJobOutputSchema> => notImplemented()),
  }),
  terminalSessions: router({
    create: publicProcedure
      .input(CreateSessionInputSchema)
      .mutation((): z.infer<typeof CreateSessionOutputSchema> => notImplemented()),
    exec: publicProcedure
      .input(ExecSessionInputSchema)
      .mutation((): z.infer<typeof ExecSessionOutputSchema> => notImplemented()),
    isRunning: publicProcedure
      .input(IsRunningInputSchema)
      .query((): z.infer<typeof IsRunningOutputSchema> => notImplemented()),
    kill: publicProcedure
      .input(KillSessionInputSchema)
      .mutation((): z.infer<typeof KillSessionOutputSchema> => notImplemented()),
  }),
  health: router({
    ping: publicProcedure
      .input(HealthPingInputSchema)
      .query((): z.infer<typeof HealthPingOutputSchema> => ({
        ok: true as const,
        version: "0.1.0",
      })),
    capacity: publicProcedure
      .input(HealthCapacityInputSchema)
      .query((): z.infer<typeof HealthCapacityOutputSchema> => ({
        session_used: 0,
        session_max: 64,
        submission_used: 0,
        submission_max: 4,
      })),
  }),
})

export type AppRouter = typeof appRouter
