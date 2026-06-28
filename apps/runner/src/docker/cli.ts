// ==========================================
// Docker CLI adapter.
//
// Typed wrapper around `child_process.execFile` that runs the Docker CLI
// using argv arrays — never `sh -c "..."` interpolation. This eliminates
// shell-injection vectors that exist in the original Go session-manager
// handlers (see apps/session-manager/handlers/{create,kill,is-running,
// run-submission}/*.go), which build a shell string with fmt.Sprintf and
// hand it to `exec.Command("sh", "-c", cmd)`.
//
// Image-name expansion mirrors the Go logic exactly:
//   - if env.DOCKER_REGISTRY is set: `{DOCKER_REGISTRY}/easyshell/{image}`
//     and the docker invocation gets `--pull=always`
//   - otherwise: `{image}` as-is, no pull policy
//
// Every command is logged at debug level on entry. Non-zero exits are
// logged at warn level with stdout / stderr / exit_code attached.
// ==========================================

import { execFile } from "node:child_process"
import { promisify } from "node:util"

import { createLogger } from "@easyshell/logger"

import { env } from "../env"

const execFileAsync = promisify(execFile)
const log = createLogger("runner:docker")

export interface DockerRunResult {
  stdout: string
  stderr: string
  exitCode: number
}

/**
 * Expands a bare image name to the full registry-prefixed name.
 * If DOCKER_REGISTRY is set: `{DOCKER_REGISTRY}/easyshell/{image}`.
 * Otherwise: `{image}` as-is.
 * Matches logic in apps/session-manager/handlers/create/create.go:43-48
 * and apps/session-manager/handlers/run-submission/run-submission.go:201-206.
 */
export function expandImageName(image: string): string {
  if (env.DOCKER_REGISTRY) {
    return `${env.DOCKER_REGISTRY}/easyshell/${image}`
  }
  return image
}

/**
 * Returns `["--pull=always"]` when DOCKER_REGISTRY is set, else `[]`.
 * Matches logic in apps/session-manager/handlers/create/create.go:35-38
 * and apps/session-manager/handlers/run-submission/run-submission.go:197-200.
 */
export function pullArgs(): string[] {
  return env.DOCKER_REGISTRY ? ["--pull=always"] : []
}

export interface DockerRunArgs {
  containerName: string
  image: string
  mode: "session" | "submission"
  memory?: string
  cpus?: string
  extraVolumes?: string[]
  extraEnv?: string[]
  detach?: boolean
}

/**
 * Runs a Docker container and waits for completion.
 * Uses execFile with an argv array — no shell interpolation.
 *
 * Returns a result even on non-zero exit (caller decides what to do).
 * On spawn failure or non-zero exit, logs at warn level.
 */
export async function dockerRun(args: DockerRunArgs): Promise<DockerRunResult> {
  const {
    containerName,
    image,
    mode,
    memory = "10m",
    cpus = "0.1",
    extraVolumes = [],
    extraEnv = [],
    detach = false,
  } = args

  const fullImage = expandImageName(image)
  const argv: string[] = [
    "run",
    "--rm",
    "--name",
    containerName,
    "-m",
    memory,
    "--cpus",
    cpus,
    ...pullArgs(),
    ...(detach ? ["-d"] : []),
    ...extraVolumes.flatMap((v) => ["-v", v]),
    ...extraEnv.flatMap((e) => ["--env", e]),
    fullImage,
    "-mode",
    mode,
  ]

  log.debug({ container_name: containerName, image: fullImage, argv }, "docker.run")

  try {
    const { stdout, stderr } = await execFileAsync("docker", argv)
    return { stdout, stderr, exitCode: 0 }
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; code?: number; message?: string }
    log.warn(
      {
        container_name: containerName,
        stdout: e.stdout,
        stderr: e.stderr,
        exit_code: e.code,
      },
      "docker.run.failed",
    )
    return {
      stdout: e.stdout ?? "",
      stderr: e.stderr ?? e.message ?? "unknown error",
      exitCode: typeof e.code === "number" ? e.code : 1,
    }
  }
}

export interface DockerKillResult {
  ok: boolean
  error?: string
}

/**
 * Kills a running Docker container by name.
 * Matches apps/session-manager/handlers/kill/kill.go:33.
 */
export async function dockerKill(containerName: string): Promise<DockerKillResult> {
  log.debug({ container_name: containerName }, "docker.kill")
  try {
    await execFileAsync("docker", ["container", "kill", containerName])
    return { ok: true }
  } catch (err: unknown) {
    const e = err as { message?: string }
    log.warn({ container_name: containerName, error: e.message }, "docker.kill.failed")
    return { ok: false, error: e.message }
  }
}

export interface DockerInspectResult {
  exists: boolean
  running: boolean
}

/**
 * Inspects a Docker container to check if it exists and is running.
 * Returns `{ exists: true, running: true|false }` when the container is
 * present and `{ exists: false, running: false }` when not found.
 *
 * Uses `--format {{.State.Running}}` so we get a single boolean line back
 * instead of the full inspect JSON. The original Go handler at
 * apps/session-manager/handlers/is-running/is-running.go:39-45 only treats
 * "container missing" vs "container present" — this adapter also surfaces
 * the running flag so the caller can distinguish stopped containers.
 */
export async function dockerInspect(containerName: string): Promise<DockerInspectResult> {
  log.debug({ container_name: containerName }, "docker.inspect")
  try {
    const { stdout } = await execFileAsync("docker", [
      "inspect",
      "--format",
      "{{.State.Running}}",
      containerName,
    ])
    const running = stdout.trim() === "true"
    return { exists: true, running }
  } catch {
    return { exists: false, running: false }
  }
}

/**
 * Removes a Docker container (typically already stopped via --rm).
 * Idempotent: does not throw if the container is already gone.
 */
export async function dockerRm(containerName: string): Promise<void> {
  log.debug({ container_name: containerName }, "docker.rm")
  try {
    await execFileAsync("docker", ["rm", "-f", containerName])
  } catch {
    // Ignore — container may already be gone, which is the desired terminal state.
  }
}
