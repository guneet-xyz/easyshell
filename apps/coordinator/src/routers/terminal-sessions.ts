import crypto from "node:crypto"
import { initTRPC, TRPCError } from "@trpc/server"
import { eq } from "drizzle-orm"
import type { z } from "zod"

import {
  executionJobs,
  runners,
  terminalSessionRunners,
} from "@easyshell/db/schema"
import { createLogger } from "@easyshell/logger"

import { type Context } from "../context"
import { db } from "../db"
import {
  CreateTerminalSessionInputSchema,
  CreateTerminalSessionOutputSchema,
  ExecTerminalSessionInputSchema,
  ExecTerminalSessionOutputSchema,
  GetRouteInputSchema,
  GetRouteOutputSchema,
  IsAliveInputSchema,
  IsAliveOutputSchema,
  KillTerminalSessionInputSchema,
  KillTerminalSessionOutputSchema,
} from "../schemas"
import { generateContainerName } from "../services/job-name"
import { insertExecutionJob } from "../services/jobs"
import {
  createRunnerClientFromDb,
  type ExecSessionOutput,
} from "../services/runner-client"
import { pickRunner } from "../services/runner-picker"

const log = createLogger("coordinator:terminal-sessions")

const t = initTRPC.context<Context>().create()
const router = t.router

const websiteProcedure = t.procedure.use(({ ctx, next }) => {
  if (ctx.actor !== "website") {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Website token required",
    })
  }
  return next({ ctx })
})

type ExecOutput = z.infer<typeof ExecTerminalSessionOutputSchema>

// The runner schema includes `container_locked` (session busy) which the
// coordinator's public union does not. Collapse it onto `session_error` so
// the website-facing discriminator stays stable.
function mapRunnerExecToCoordinator(
  runnerResult: ExecSessionOutput,
): ExecOutput {
  if (runnerResult.status === "success") {
    return {
      status: "success",
      stdout: runnerResult.stdout,
      stderr: runnerResult.stderr,
    }
  }
  if (runnerResult.type === "container_locked") {
    return {
      status: "error",
      type: "session_error",
      message: runnerResult.message,
    }
  }
  return {
    status: "error",
    type: runnerResult.type,
    message: runnerResult.message,
  }
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

export const terminalSessionsRouter = router({
  create: websiteProcedure
    .input(CreateTerminalSessionInputSchema)
    .output(CreateTerminalSessionOutputSchema)
    .mutation(async ({ input }) => {
      const runner = await pickRunner("session")
      if (!runner) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "no session-capable runner available",
        })
      }

      const jobId = crypto.randomUUID()
      const containerName = generateContainerName()

      await db.transaction(async (tx) => {
        await insertExecutionJob(tx, {
          id: jobId,
          containerName,
          runnerId: runner.id,
          mode: "session",
          image: input.image,
          terminalSessionId: input.terminal_session_id,
          attempt: 1,
        })
      })

      const runnerClient = await createRunnerClientFromDb(runner.id)
      try {
        await runnerClient.terminalSessions.create.mutate({
          container_name: containerName,
          image: input.image,
        })
      } catch (err) {
        const msg = errMessage(err)
        await db
          .update(executionJobs)
          .set({
            status: "failed",
            errorMessage: msg,
            finishedAt: new Date(),
          })
          .where(eq(executionJobs.id, jobId))
        log.error(
          {
            terminal_session_id: input.terminal_session_id,
            runner_id: runner.id,
            container_name: containerName,
            err: msg,
          },
          "terminal-session.create.runner-error",
        )
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `runner create failed: ${msg}`,
        })
      }

      await db.insert(terminalSessionRunners).values({
        terminalSessionId: input.terminal_session_id,
        runnerId: runner.id,
        containerName,
        executionJobId: jobId,
      })

      await db
        .update(executionJobs)
        .set({ status: "running", acceptedAt: new Date() })
        .where(eq(executionJobs.id, jobId))

      log.info(
        {
          terminal_session_id: input.terminal_session_id,
          container_name: containerName,
          runner_id: runner.id,
        },
        "terminal-session.created",
      )

      return { container_name: containerName, runner_id: runner.id }
    }),

  exec: websiteProcedure
    .input(ExecTerminalSessionInputSchema)
    .output(ExecTerminalSessionOutputSchema)
    .mutation(async ({ input }): Promise<ExecOutput> => {
      const routeRows = await db
        .select()
        .from(terminalSessionRunners)
        .where(
          eq(
            terminalSessionRunners.terminalSessionId,
            input.terminal_session_id,
          ),
        )
        .limit(1)
      const route = routeRows[0]

      if (!route) {
        return {
          status: "error",
          type: "session_not_running",
          message: "session not found",
        }
      }

      const runnerRows = await db
        .select({ status: runners.status })
        .from(runners)
        .where(eq(runners.id, route.runnerId))
        .limit(1)
      const runner = runnerRows[0]

      if (
        !runner ||
        runner.status === "stale" ||
        runner.status === "deregistered"
      ) {
        return {
          status: "error",
          type: "runner_unreachable",
          message: `runner ${route.runnerId} is ${runner?.status ?? "not found"}`,
        }
      }

      try {
        const runnerClient = await createRunnerClientFromDb(route.runnerId)
        const runnerResult = await runnerClient.terminalSessions.exec.mutate({
          container_name: route.containerName,
          command: input.command,
        })
        return mapRunnerExecToCoordinator(runnerResult)
      } catch (err) {
        return {
          status: "error",
          type: "critical_server_error",
          message: errMessage(err),
        }
      }
    }),

  isAlive: websiteProcedure
    .input(IsAliveInputSchema)
    .output(IsAliveOutputSchema)
    .query(async ({ input }) => {
      const routeRows = await db
        .select()
        .from(terminalSessionRunners)
        .where(
          eq(
            terminalSessionRunners.terminalSessionId,
            input.terminal_session_id,
          ),
        )
        .limit(1)
      const route = routeRows[0]

      if (!route) return { is_running: false }

      try {
        const runnerClient = await createRunnerClientFromDb(route.runnerId)
        const result = await runnerClient.terminalSessions.isRunning.query({
          container_name: route.containerName,
        })
        return { is_running: result.is_running }
      } catch {
        return { is_running: false }
      }
    }),

  kill: websiteProcedure
    .input(KillTerminalSessionInputSchema)
    .output(KillTerminalSessionOutputSchema)
    .mutation(async ({ input }) => {
      const routeRows = await db
        .select()
        .from(terminalSessionRunners)
        .where(
          eq(
            terminalSessionRunners.terminalSessionId,
            input.terminal_session_id,
          ),
        )
        .limit(1)
      const route = routeRows[0]

      if (!route) {
        log.warn(
          { terminal_session_id: input.terminal_session_id },
          "terminal-session.kill.not-found",
        )
        return { ok: true }
      }

      try {
        const runnerClient = await createRunnerClientFromDb(route.runnerId)
        await runnerClient.terminalSessions.kill.mutate({
          container_name: route.containerName,
        })
      } catch (err) {
        log.warn(
          {
            terminal_session_id: input.terminal_session_id,
            error: errMessage(err),
          },
          "terminal-session.kill.runner-error",
        )
      }

      await db
        .update(executionJobs)
        .set({ status: "cancelled", finishedAt: new Date() })
        .where(eq(executionJobs.id, route.executionJobId))

      log.info(
        { terminal_session_id: input.terminal_session_id },
        "terminal-session.killed",
      )

      return { ok: true }
    }),

  getRoute: websiteProcedure
    .input(GetRouteInputSchema)
    .output(GetRouteOutputSchema)
    .query(async ({ input }) => {
      const routeRows = await db
        .select()
        .from(terminalSessionRunners)
        .where(
          eq(
            terminalSessionRunners.terminalSessionId,
            input.terminal_session_id,
          ),
        )
        .limit(1)
      const route = routeRows[0]

      if (!route) return null
      return {
        runner_id: route.runnerId,
        container_name: route.containerName,
      }
    }),
})
