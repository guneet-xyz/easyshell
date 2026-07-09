import crypto from "node:crypto"
import { type CreateHTTPContextOptions } from "@trpc/server/adapters/standalone"

import { env } from "./env"

export type Context = {
  actor: "coordinator" | "unauth"
}

function timingSafeEqual(a: string, b: string): boolean {
  try {
    if (a.length !== b.length) return false
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))
  } catch {
    return false
  }
}

export function createContext(opts: CreateHTTPContextOptions): Context {
  const auth = opts.req.headers.authorization
  if (!auth) return { actor: "unauth" }
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : null
  if (!bearer) return { actor: "unauth" }

  if (timingSafeEqual(bearer, env.RUNNER_TOKEN)) {
    return { actor: "coordinator" }
  }

  return { actor: "unauth" }
}
