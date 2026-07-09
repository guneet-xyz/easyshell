import { initTRPC } from "@trpc/server"

import { type Context } from "./context"
import { adminRouter } from "./routers/admin"
import { jobsRouter } from "./routers/jobs"
import { runnersRouter } from "./routers/runners"
import { submissionsRouter } from "./routers/submissions"
import { terminalSessionsRouter } from "./routers/terminal-sessions"
import { HealthPingInputSchema, HealthPingOutputSchema } from "./schemas"

export type { Context }

const t = initTRPC.context<Context>().create()
const router = t.router
const publicProcedure = t.procedure

export const appRouter = router({
  admin: adminRouter,
  runners: runnersRouter,
  jobs: jobsRouter,
  terminalSessions: terminalSessionsRouter,
  submissions: submissionsRouter,
  health: router({
    ping: publicProcedure
      .input(HealthPingInputSchema)
      .output(HealthPingOutputSchema)
      .query(() => ({ ok: true as const, version: "0.1.0" })),
  }),
})

export type AppRouter = typeof appRouter
