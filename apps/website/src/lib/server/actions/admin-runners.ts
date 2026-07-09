"use server"

import crypto from "node:crypto"

import { createCoordinatorClient } from "@easyshell/coordinator/client"

import { env } from "@/env"
import { requireAdmin } from "@/lib/server/admin"

function client() {
  return createCoordinatorClient({
    url: env.COORDINATOR_URL,
    token: env.WEBSITE_TOKEN,
    correlationId: crypto.randomUUID(),
  })
}

export async function listRunners() {
  await requireAdmin("/admin/runners")
  return client().admin.runners.list.query()
}

export async function createRunner(input: {
  name: string
  public_url: string
  region?: string
  labels?: Record<string, string>
  version?: string
  capabilities: Array<{ mode: "session" | "submission"; concurrency: number }>
}) {
  await requireAdmin("/admin/runners")
  return client().admin.runners.create.mutate(input)
}

export async function revokeRunner(runner_id: string) {
  await requireAdmin("/admin/runners")
  return client().admin.runners.revoke.mutate({ runner_id })
}

export async function rotateRunnerToken(runner_id: string) {
  await requireAdmin("/admin/runners")
  return client().admin.runners.rotateToken.mutate({ runner_id })
}
