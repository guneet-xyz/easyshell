import type {
  CreateSessionRequest,
  MustangClient,
} from "@easyshell/mustang/client"
import {
  isLiveEnvironmentProblem,
  type ProblemInfo,
} from "@easyshell/problems/schema"

import { getWarmPoolConfig } from "../problems"

const log = (...args: unknown[]) => console.log("[cron:pool]", ...args)
const logError = (...args: unknown[]) => console.error("[cron:pool]", ...args)

/**
 * Reconcile the warm container pool.
 *
 * For each problem (standard or live-environment) with `warmInstances > 0`:
 * - Count currently running warm containers
 * - If too few: create more via mustang API
 * - If too many: kill excess
 */
export async function runPoolReconciliation({
  client,
}: {
  client: MustangClient
}) {
  log("starting pool reconciliation")

  const poolConfig = await getWarmPoolConfig()
  if (poolConfig.length === 0) {
    log("no problems configured for warm pool")
    return
  }

  let totalCreated = 0
  let totalKilled = 0

  for (const { problemSlug, problemInfo, instances } of poolConfig) {
    for (const { testcaseId, warmInstances: desired } of instances) {
      try {
        const { created, killed } = await reconcileInstance({
          client,
          problemSlug,
          problemInfo,
          testcaseId,
          desired,
        })
        totalCreated += created
        totalKilled += killed
      } catch (error) {
        logError(
          `failed to reconcile pool for ${problemSlug} testcase=${testcaseId}:`,
          error,
        )
      }
    }
  }

  log(
    `pool reconciliation complete: ${totalCreated} created, ${totalKilled} killed`,
  )
}

/**
 * Build the createSession request for a warm container.
 * Standard problems use lightweight containers.
 * Live-environment problems use k3s containers with higher resource limits.
 */
function buildCreateRequest({
  problemSlug,
  problemInfo,
  testcaseId,
}: {
  problemSlug: string
  problemInfo: ProblemInfo
  testcaseId: number
}): CreateSessionRequest {
  const image = `easyshell-${problemSlug}-${testcaseId}`

  if (isLiveEnvironmentProblem(problemInfo)) {
    return {
      image,
      problem: problemSlug,
      testcase: testcaseId,
      mode: "warm",
      type: "k3s",
      memory: "1g",
      cpu: "1.0",
      privileged: true,
      cgroupns: "private",
      tmpfs: ["/run", "/var/run"],
      command: ["-mode", "k3s-session"],
    }
  }

  return {
    image,
    problem: problemSlug,
    testcase: testcaseId,
    mode: "warm",
    type: "standard",
  }
}

async function reconcileInstance({
  client,
  problemSlug,
  problemInfo,
  testcaseId,
  desired,
}: {
  client: MustangClient
  problemSlug: string
  problemInfo: ProblemInfo
  testcaseId: number
  desired: number
}): Promise<{ created: number; killed: number }> {
  // Count current warm containers for this problem+testcase
  const { containers } = await client.listContainers({
    mode: "warm",
    problem: problemSlug,
    testcase: testcaseId,
  })
  const current = containers.length

  if (current === desired) {
    return { created: 0, killed: 0 }
  }

  if (current < desired) {
    // Need to create more warm containers
    const toCreate = desired - current
    log(
      `${problemSlug} testcase=${testcaseId}: have ${current}, want ${desired}, creating ${toCreate}`,
    )

    let created = 0
    for (let i = 0; i < toCreate; i++) {
      try {
        const req = buildCreateRequest({
          problemSlug,
          problemInfo,
          testcaseId,
        })
        const { container_name } = await client.createSession(req)
        log(
          `created warm ${req.type} container ${container_name} for ${problemSlug} testcase=${testcaseId}`,
        )
        created++
      } catch (error) {
        logError(
          `failed to create warm container for ${problemSlug} testcase=${testcaseId}:`,
          error,
        )
      }
    }

    return { created, killed: 0 }
  }

  // current > desired — kill excess
  const toKill = current - desired
  log(
    `${problemSlug} testcase=${testcaseId}: have ${current}, want ${desired}, killing ${toKill}`,
  )

  let killed = 0
  // Kill the excess containers (starting from the end of the list)
  for (let i = 0; i < toKill && i < containers.length; i++) {
    const container = containers[containers.length - 1 - i]
    if (!container) continue
    try {
      await client.killSession(container.name)
      log(`killed excess warm container ${container.name}`)
      killed++
    } catch (error) {
      logError(`failed to kill excess warm container ${container.name}:`, error)
    }
  }

  return { created: 0, killed }
}
