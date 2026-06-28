import { initTRPC, TRPCError } from "@trpc/server"

import { type Context } from "../context"

const t = initTRPC.context<Context>().create()

/**
 * Middleware that requires the caller to be the Coordinator (authenticated via per-runner bearer token).
 * health.ping is intentionally UNAUTH — it does not use this middleware.
 */
export const coordinatorProcedure = t.procedure.use(({ ctx, next }) => {
  if (ctx.actor !== "coordinator") {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Coordinator credentials required" })
  }
  return next({ ctx })
})

export const publicProcedure = t.procedure
