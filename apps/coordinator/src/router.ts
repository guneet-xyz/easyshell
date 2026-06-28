import { initTRPC, TRPCError } from "@trpc/server"

import {
  CreateTerminalSessionInputSchema,
  CreateTerminalSessionOutputSchema,
  DeregisterInputSchema,
  DeregisterOutputSchema,
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
  HeartbeatInputSchema,
  HeartbeatOutputSchema,
  IsAliveInputSchema,
  IsAliveOutputSchema,
  KillTerminalSessionInputSchema,
  KillTerminalSessionOutputSchema,
  RegisterRunnerInputSchema,
  RegisterRunnerOutputSchema,
  ReportProgressInputSchema,
  ReportProgressOutputSchema,
  ReportResultInputSchema,
  ReportResultOutputSchema,
  RetryAllFailedInputSchema,
  RetryAllFailedOutputSchema,
  RetryTestcaseInputSchema,
  RetryTestcaseOutputSchema,
} from "./schemas"

// Stub context — will be replaced with real context in Wave 4 (T7/T11)
export type Context = {
  actor: "runner" | "website" | "unauth"
  runnerId?: string
}

const t = initTRPC.context<Context>().create()
const router = t.router
const publicProcedure = t.procedure

const notImplemented = (): never => {
  throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "not implemented" })
}

export const appRouter = router({
  runners: router({
    register: publicProcedure
      .input(RegisterRunnerInputSchema)
      .output(RegisterRunnerOutputSchema)
      .mutation(() => notImplemented()),
    heartbeat: publicProcedure
      .input(HeartbeatInputSchema)
      .output(HeartbeatOutputSchema)
      .mutation(() => notImplemented()),
    deregister: publicProcedure
      .input(DeregisterInputSchema)
      .output(DeregisterOutputSchema)
      .mutation(() => notImplemented()),
  }),
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
