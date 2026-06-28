import { and, eq, sql } from "drizzle-orm"

import {
  runnerCapabilities,
  runnerHeartbeats,
  runners,
} from "@easyshell/db/schema"
import { createLogger } from "@easyshell/logger"

import { db } from "../db"

const log = createLogger("coordinator:runner-picker")

export type PickedRunner = {
  id: string
  publicUrl: string
  secretCiphertext: string
  secretNonce: string
}

export async function pickRunner(
  mode: "session" | "submission",
): Promise<PickedRunner | null> {
  // Per-mode spare capacity from the latest heartbeat. COALESCE handles
  // runners that registered the capability but have not yet posted a
  // heartbeat — they are treated as zero-capacity until they do.
  const usedCol =
    mode === "submission"
      ? runnerHeartbeats.submissionConcurrencyUsed
      : runnerHeartbeats.sessionConcurrencyUsed
  const maxCol =
    mode === "submission"
      ? runnerHeartbeats.submissionConcurrencyMax
      : runnerHeartbeats.sessionConcurrencyMax

  const results = await db
    .select({
      id: runners.id,
      publicUrl: runners.publicUrl,
      secretCiphertext: runners.secretCiphertext,
      secretNonce: runners.secretNonce,
      spareCapacity:
        sql<number>`COALESCE(${maxCol} - ${usedCol}, 0)`.as("spare_capacity"),
    })
    .from(runners)
    .innerJoin(
      runnerCapabilities,
      and(
        eq(runnerCapabilities.runnerId, runners.id),
        eq(runnerCapabilities.mode, mode),
      ),
    )
    .leftJoin(runnerHeartbeats, eq(runnerHeartbeats.runnerId, runners.id))
    .where(eq(runners.status, "active"))
    .orderBy(sql`spare_capacity DESC`)
    .limit(1)

  const best = results[0]
  if (!best || best.spareCapacity <= 0) {
    log.warn({ mode }, "runner-picker.no-capacity")
    return null
  }

  return {
    id: best.id,
    publicUrl: best.publicUrl,
    secretCiphertext: best.secretCiphertext,
    secretNonce: best.secretNonce,
  }
}
