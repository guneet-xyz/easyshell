import { initTRPC, TRPCError } from "@trpc/server"

import { type Context } from "./context"
import { jobsRouter } from "./routers/jobs"
import { runnersRouter } from "./routers/runners"
import { submissionsRouter } from "./routers/submissions"
import {
  CreateTerminalSessionInputSchema,
  CreateTerminalSessionOutputSchema,
  ExecTerminalSessionInputSchema,
  ExecTerminalSessionOutputSchema,
  GetRouteInputSchema,
  GetRouteOutputSchema,
  HealthPingInputSchema,
  HealthPingOutputSchema,
  IsAliveInputSchema,
  IsAliveOutputSchema,
  KillTerminalSessionInputSchema,
  KillTerminalSessionOutputSchema,
} from "./schemas"

export type { Context }

const t = initTRPC.context<Context>().create()
const router = t.router
const publicProcedure = t.procedure

const notImplemented = (): never => {
  throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "not implemented" })
}

export const appRouter = router({
  runners: runnersRouter,
  jobs: jobsRouter,
  terminalSessions: router({
    create: publicProcedure
      .input(CreateTerminalSessionInputSchema)
      .output(CreateTerminalSessionOutputSchema)
      .mutation(() => notImplemented()),
    exec: publicProcedure
      .input(ExecTerminalSessionInputSchema)
      .output(ExecTerminalSessionOutputSchema)
      .mutation(() => notImplemented()),
    isAlive: publicProcedure
      .input(IsAliveInputSchema)
      .output(IsAliveOutputSchema)
      .query(() => notImplemented()),
    kill: publicProcedure
      .input(KillTerminalSessionInputSchema)
      .output(KillTerminalSessionOutputSchema)
      .mutation(() => notImplemented()),
    getRoute: publicProcedure
      .input(GetRouteInputSchema)
      .output(GetRouteOutputSchema)
      .query(() => notImplemented()),
  }),
  submissions: submissionsRouter,
  health: router({
    ping: publicProcedure
      .input(HealthPingInputSchema)
      .output(HealthPingOutputSchema)
      .query(() => ({ ok: true as const, version: "0.1.0" })),
  }),
})

export type AppRouter = typeof appRouter
