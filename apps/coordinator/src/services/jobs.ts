import { type ExtractTablesWithRelations } from "drizzle-orm"
import { type PgTransaction } from "drizzle-orm/pg-core"
import { type PostgresJsQueryResultHKT } from "drizzle-orm/postgres-js"

import * as schema from "@easyshell/db/schema"
import { executionJobs } from "@easyshell/db/schema"

type Tx = PgTransaction<
  PostgresJsQueryResultHKT,
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>

export interface InsertExecutionJobParams {
  id: string
  containerName: string
  runnerId: string
  mode: "session" | "submission"
  image: string
  submissionId?: number
  testcaseId?: number
  terminalSessionId?: number
  attempt?: number
  // queue-poller parks the submission script here; dispatcher reads it
  // back. Avoids adding a dedicated `input` column.
  result?: Record<string, unknown>
}

/**
 * Inserts a row into `execution_job` inside the supplied transaction.
 * Always sets `status = "dispatched"`. `attempt` defaults to `1`.
 */
export async function insertExecutionJob(
  tx: Tx,
  params: InsertExecutionJobParams,
): Promise<void> {
  await tx.insert(executionJobs).values({
    id: params.id,
    containerName: params.containerName,
    runnerId: params.runnerId,
    mode: params.mode,
    image: params.image,
    submissionId: params.submissionId,
    testcaseId: params.testcaseId,
    terminalSessionId: params.terminalSessionId,
    attempt: params.attempt ?? 1,
    status: "dispatched",
    result: params.result,
  })
}
