import crypto from "node:crypto"
import { initTRPC, TRPCError } from "@trpc/server"
import { and, desc, eq, isNull } from "drizzle-orm"
import { z } from "zod"

import { runnerCapabilities, runners } from "@easyshell/db/schema"

import type { Context } from "../context"
import { db } from "../db"
import { ExecutionModeSchema } from "../schemas"
import { encryptSecret } from "../services/secret"

const t = initTRPC.context<Context>().create()
const router = t.router
const procedure = t.procedure

const websiteProcedure = procedure.use(({ ctx, next }) => {
  if (ctx.actor !== "website")
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Website token required",
    })
  return next({ ctx })
})

const AdminCreateRunnerInputSchema = z.object({
  name: z.string().min(1).max(255),
  public_url: z.string().url(),
  region: z.string().max(64).optional(),
  labels: z.record(z.string()).default({}),
  version: z.string().max(64).optional(),
  capabilities: z
    .array(
      z.object({
        mode: ExecutionModeSchema,
        concurrency: z.number().int().positive(),
      }),
    )
    .min(1),
})
const AdminCreateRunnerOutputSchema = z.object({
  runner_id: z.string(),
  runner_token: z.string(),
})

const AdminListRunnersOutputSchema = z.object({
  runners: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      public_url: z.string(),
      region: z.string().nullable(),
      labels: z.record(z.string()),
      version: z.string().nullable(),
      status: z.enum([
        "active",
        "draining",
        "stale",
        "deregistered",
        "revoked",
      ]),
      last_seen_at: z.date(),
      revoked_at: z.date().nullable(),
      registered_at: z.date(),
      capabilities: z.array(
        z.object({
          mode: ExecutionModeSchema,
          concurrency: z.number().int().positive(),
        }),
      ),
    }),
  ),
})

const AdminRevokeRunnerInputSchema = z.object({ runner_id: z.string() })
const AdminRevokeRunnerOutputSchema = z.object({
  revoked: z.literal(true),
  runner_id: z.string(),
})

const AdminRotateRunnerTokenInputSchema = z.object({ runner_id: z.string() })
const AdminRotateRunnerTokenOutputSchema = z.object({
  runner_id: z.string(),
  runner_token: z.string(),
})

function issueRunnerToken(): {
  plaintext: string
  hash: string
  ciphertext: string
  nonce: string
} {
  const plaintext = crypto.randomBytes(32).toString("hex")
  const hash = crypto.createHash("sha256").update(plaintext).digest("hex")
  const { ciphertext, nonce } = encryptSecret(plaintext)
  return { plaintext, hash, ciphertext, nonce }
}

export const adminRouter = router({
  runners: router({
    create: websiteProcedure
      .input(AdminCreateRunnerInputSchema)
      .output(AdminCreateRunnerOutputSchema)
      .mutation(async ({ input }) => {
        const runnerId = crypto.randomUUID()
        const { plaintext, hash, ciphertext, nonce } = issueRunnerToken()
        await db.transaction(async (tx) => {
          await tx.insert(runners).values({
            id: runnerId,
            name: input.name,
            publicUrl: input.public_url,
            secretHash: hash,
            secretCiphertext: ciphertext,
            secretNonce: nonce,
            region: input.region,
            labels: input.labels,
            version: input.version,
          })
          for (const cap of input.capabilities) {
            await tx.insert(runnerCapabilities).values({
              runnerId,
              mode: cap.mode,
              concurrency: cap.concurrency,
            })
          }
        })
        return { runner_id: runnerId, runner_token: plaintext }
      }),
    list: websiteProcedure
      .output(AdminListRunnersOutputSchema)
      .query(async () => {
        const rows = await db
          .select()
          .from(runners)
          .orderBy(desc(runners.registeredAt))
        const caps = await db.select().from(runnerCapabilities)
        const capsByRunner = new Map<
          string,
          Array<{ mode: "session" | "submission"; concurrency: number }>
        >()
        for (const c of caps) {
          const arr = capsByRunner.get(c.runnerId) ?? []
          arr.push({ mode: c.mode, concurrency: c.concurrency })
          capsByRunner.set(c.runnerId, arr)
        }
        return {
          runners: rows.map((r) => ({
            id: r.id,
            name: r.name,
            public_url: r.publicUrl,
            region: r.region,
            labels: r.labels as Record<string, string>,
            version: r.version,
            status: r.revokedAt ? ("revoked" as const) : r.status,
            last_seen_at: r.lastSeenAt,
            revoked_at: r.revokedAt,
            registered_at: r.registeredAt,
            capabilities: capsByRunner.get(r.id) ?? [],
          })),
        }
      }),
    revoke: websiteProcedure
      .input(AdminRevokeRunnerInputSchema)
      .output(AdminRevokeRunnerOutputSchema)
      .mutation(async ({ input }) => {
        await db
          .update(runners)
          .set({ revokedAt: new Date() })
          .where(
            and(eq(runners.id, input.runner_id), isNull(runners.revokedAt)),
          )
        return { revoked: true as const, runner_id: input.runner_id }
      }),
    rotateToken: websiteProcedure
      .input(AdminRotateRunnerTokenInputSchema)
      .output(AdminRotateRunnerTokenOutputSchema)
      .mutation(async ({ input }) => {
        const rows = await db
          .select({
            id: runners.id,
            status: runners.status,
            revokedAt: runners.revokedAt,
            secretHash: runners.secretHash,
          })
          .from(runners)
          .where(eq(runners.id, input.runner_id))
          .limit(1)
        const row = rows[0]
        if (!row)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "runner not found",
          })
        if (row.revokedAt)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "cannot rotate a revoked runner",
          })
        if (row.status === "deregistered")
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "cannot rotate a deregistered runner",
          })
        const { plaintext, hash, ciphertext, nonce } = issueRunnerToken()
        const updated = await db
          .update(runners)
          .set({
            secretHash: hash,
            secretCiphertext: ciphertext,
            secretNonce: nonce,
          })
          .where(
            and(
              eq(runners.id, input.runner_id),
              isNull(runners.revokedAt),
              eq(runners.secretHash, row.secretHash),
            ),
          )
          .returning({ id: runners.id })
        if (updated.length === 0) {
          const recheck = await db
            .select({
              revokedAt: runners.revokedAt,
              secretHash: runners.secretHash,
            })
            .from(runners)
            .where(eq(runners.id, input.runner_id))
            .limit(1)
          const now = recheck[0]
          if (now?.revokedAt)
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "cannot rotate a revoked runner",
            })
          if (now && now.secretHash !== row.secretHash)
            throw new TRPCError({
              code: "CONFLICT",
              message:
                "token was rotated concurrently by another admin; refresh and try again",
            })
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "runner not found",
          })
        }
        return { runner_id: input.runner_id, runner_token: plaintext }
      }),
  }),
})
