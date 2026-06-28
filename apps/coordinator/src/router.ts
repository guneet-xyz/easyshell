import { initTRPC, TRPCError } from "@trpc/server"

import { type Context } from "./context"
import { runnersRouter } from "./routers/runners"
import {
  CreateTerminalSessionInputSchema,
  CreateTerminalSessionOutputSchema,
  EnqueueSubmissionInputSchema,
  EnqueueSubmissionOutputSchema,
  ExecTerminalSessionInputSchema,
  ExecTerminalSessionOutputSchema,
  GetRouteInputSchema,
  GetRouteOutputSchema,
  GetStatusInputSchema,
  GetStatusOutputSchema,
  HealthPingInputSchema,
  HealthPingOutputSchema,
  IsAliveInputSchema,
  IsAliveOutputSchema,
  KillTerminalSessionInputSchema,
  KillTerminalSessionOutputSchema,
  ReportProgressInputSchema,
  ReportProgressOutputSchema,
  ReportResultInputSchema,
  ReportResultOutputSchema,
  RetryAllFailedInputSchema,
  RetryAllFailedOutputSchema,
  RetryTestcaseInputSchema,
  RetryTestcaseOutputSchema,
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
  jobs: router({
    reportResult: publicProcedure
      .input(ReportResultInputSchema)
      .output(ReportResultOutputSchema)
      .mutation(() => notImplemented()),
    reportProgress: publicProcedure
      .input(ReportProgressInputSchema)
      .output(ReportProgressOutputSchema)
      .mutation(() => notImplemented()),
  }),
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
  submissions: router({
    enqueue: publicProcedure
      .input(EnqueueSubmissionInputSchema)
      .output(EnqueueSubmissionOutputSchema)
      .mutation(() => notImplemented()),
    retryTestcase: publicProcedure
      .input(RetryTestcaseInputSchema)
      .output(RetryTestcaseOutputSchema)
      .mutation(() => notImplemented()),
    retryAllFailedForSubmission: publicProcedure
      .input(RetryAllFailedInputSchema)
      .output(RetryAllFailedOutputSchema)
      .mutation(() => notImplemented()),
    getStatus: publicProcedure
      .input(GetStatusInputSchema)
      .output(GetStatusOutputSchema)
      .query(() => notImplemented()),
  }),
  health: router({
    ping: publicProcedure
      .input(HealthPingInputSchema)
      .output(HealthPingOutputSchema)
      .query(() => ({ ok: true as const, version: "0.1.0" })),
  }),
})

export type AppRouter = typeof appRouter
