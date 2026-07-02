import crypto from "node:crypto"
import { type CreateHTTPContextOptions } from "@trpc/server/adapters/standalone"
import { eq } from "drizzle-orm"

import { runners } from "@easyshell/db/schema"

import { db } from "./db"
import { env } from "./env"

export type Context = {
  actor: "runner" | "website" | "unauth"
  runnerId?: string
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  const aBuf = Buffer.from(a)
  const bBuf = Buffer.from(b)
  return crypto.timingSafeEqual(aBuf, bBuf)
}

function sha256Hex(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex")
}

export async function createContext(
  opts: CreateHTTPContextOptions,
): Promise<Context> {
  const auth = opts.req.headers.authorization
  const runnerIdHeader = opts.req.headers["x-runner-id"]

  if (!auth) return { actor: "unauth" }
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : null
  if (!bearer) return { actor: "unauth" }

  // Website token check (constant-time)
  if (timingSafeEqual(bearer, env.COORDINATOR_TOKEN)) {
    return { actor: "website" }
  }

  // Registration token check (for runners.register only)
  if (timingSafeEqual(bearer, env.COORDINATOR_REGISTRATION_TOKEN)) {
    return { actor: "runner" } // runnerId is undefined — register doesn't have one yet
  }

  // Per-runner secret check
  if (typeof runnerIdHeader === "string" && runnerIdHeader.length > 0) {
    const row = await db
      .select({ id: runners.id, secretHash: runners.secretHash })
      .from(runners)
      .where(eq(runners.id, runnerIdHeader))
      .limit(1)
    const runner = row[0]

    if (runner) {
      const presentedHash = sha256Hex(bearer)
      if (timingSafeEqual(presentedHash, runner.secretHash)) {
        return { actor: "runner", runnerId: runner.id }
      }
    }
  }

  return { actor: "unauth" }
}
