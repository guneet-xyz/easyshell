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

/** Container names: also used as a single path element under WORKING_DIR. */
const SAFE_CONTAINER_NAME = /^[a-z0-9][a-z0-9_.-]{0,127}$/
/** Image references, optionally with registry host/port, tag or digest. */
const SAFE_IMAGE = /^[a-z0-9][a-z0-9._/:@-]{0,254}$/

export function isSafeContainerName(name: string): boolean {
  return SAFE_CONTAINER_NAME.test(name)
}

export function isSafeImage(image: string): boolean {
  return SAFE_IMAGE.test(image) && !image.includes("..")
}

/** Largest file a user container may write. */
const MAX_FILE_SIZE_BYTES = 16 * 1024 * 1024
/** Largest output read back from the docker CLI (what the container prints). */
const MAX_CLI_OUTPUT_BYTES = 1024 * 1024

/** Label on every session container: unix seconds after which it is reaped. */
export const SESSION_EXPIRES_LABEL = "easyshell.session-expires"

export interface DockerRunResult {
  stdout: string
  stderr: string
  exitCode: number
  /** The run exceeded `timeoutMs` and its container was removed. */
  timedOut?: boolean
  /** The container printed more than the output limit and was removed. */
  outputTooLarge?: boolean
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
  /** Extra `--label key=value` pairs. */
  labels?: Record<string, string>
  /** Kill and remove the container if `docker run` takes longer than this. */
  timeoutMs?: number
  /**
   * Pull the image as part of the run when a registry is configured
   * (default). Callers that pulled beforehand pass false.
   */
  pull?: boolean
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
    labels = {},
    timeoutMs,
    pull = true,
  } = args

  const fullImage = expandImageName(image)
  if (!isSafeContainerName(containerName) || !isSafeImage(fullImage)) {
    log.warn({ container_name: containerName, image }, "docker.run.refused")
    return {
      stdout: "",
      stderr: "invalid container or image name",
      exitCode: 1,
    }
  }
  const argv: string[] = [
    "run",
    "--rm",
    "--name",
    containerName,
    // User code is untrusted: no network (problem daemons use loopback) and a
    // bounded process count on top of the memory/CPU limits.
    "--network",
    "none",
    "--pids-limit",
    "256",
    // Bounds each file user code writes, including bind-mounted ones in the
    // shared work directory (bytes), and disables core dumps there.
    "--ulimit",
    `fsize=${MAX_FILE_SIZE_BYTES}`,
    "--ulimit",
    "core=0",
    "-m",
    memory,
    "--cpus",
    cpus,
    "--label",
    `easyshell.mode=${mode}`,
    ...Object.entries(labels).flatMap(([k, v]) => ["--label", `${k}=${v}`]),
    ...(pull ? pullArgs() : ["--pull=never"]),
    ...(detach ? ["-d"] : []),
    ...extraVolumes.flatMap((v) => ["-v", v]),
    ...extraEnv.flatMap((e) => ["--env", e]),
    fullImage,
    "-mode",
    mode,
  ]

  log.debug(
    { container_name: containerName, image: fullImage, argv },
    "docker.run",
  )

  try {
    const { stdout, stderr } = await execFileAsync("docker", argv, {
      timeout: timeoutMs ?? 0,
      maxBuffer: MAX_CLI_OUTPUT_BYTES,
      // The CLI forwards SIGTERM to the container instead of exiting; the
      // container itself is removed below either way.
      killSignal: "SIGKILL",
    })
    return { stdout, stderr, exitCode: 0 }
  } catch (err: unknown) {
    const e = err as {
      stdout?: string
      stderr?: string
      code?: number | string
      message?: string
      killed?: boolean
      signal?: string
    }
    if (e.code === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER") {
      await dockerRm(containerName)
      log.warn({ container_name: containerName }, "docker.run.output-too-large")
      return {
        stdout: "",
        stderr: "output too large",
        exitCode: 1,
        outputTooLarge: true,
      }
    }
    if (e.killed || e.signal) {
      // Timeout: the CLI was killed, but the container may still be running.
      await dockerRm(containerName)
      log.warn(
        { container_name: containerName, timeout_ms: timeoutMs },
        "docker.run.timeout",
      )
      return {
        stdout: e.stdout ?? "",
        stderr: "timed out",
        exitCode: 124,
        timedOut: true,
      }
    }
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

/**
 * Pulls an image (registry-prefixed as for `docker run`) when a registry is
 * configured; a no-op otherwise.
 */
export async function dockerPull(
  image: string,
  timeoutMs: number,
): Promise<{ ok: boolean; error?: string }> {
  if (!env.DOCKER_REGISTRY) return { ok: true }
  const fullImage = expandImageName(image)
  if (!isSafeImage(fullImage)) return { ok: false, error: "invalid image name" }
  try {
    await execFileAsync("docker", ["pull", "--quiet", fullImage], {
      timeout: timeoutMs,
    })
    return { ok: true }
  } catch (err: unknown) {
    const e = err as { stderr?: string; message?: string; killed?: boolean }
    const error = e.killed
      ? "image pull timed out"
      : (e.stderr || e.message || "image pull failed").slice(0, 500)
    log.warn({ image: fullImage, error }, "docker.pull.failed")
    return { ok: false, error }
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
export async function dockerKill(
  containerName: string,
): Promise<DockerKillResult> {
  log.debug({ container_name: containerName }, "docker.kill")
  if (!isSafeContainerName(containerName)) {
    return { ok: false, error: "invalid container name" }
  }
  try {
    await execFileAsync("docker", ["container", "kill", containerName])
    return { ok: true }
  } catch (err: unknown) {
    const e = err as { message?: string }
    log.warn(
      { container_name: containerName, error: e.message },
      "docker.kill.failed",
    )
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
export async function dockerInspect(
  containerName: string,
): Promise<DockerInspectResult> {
  log.debug({ container_name: containerName }, "docker.inspect")
  if (!isSafeContainerName(containerName))
    return { exists: false, running: false }
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
  if (!isSafeContainerName(containerName)) return
  try {
    await execFileAsync("docker", ["rm", "-f", containerName])
  } catch {
    // Ignore — container may already be gone, which is the desired terminal state.
  }
}

/**
 * Names of running session containers whose expiry label is in the past.
 * Containers without a parseable label are left alone.
 */
export async function listExpiredSessions(
  nowMs = Date.now(),
): Promise<string[]> {
  const { stdout } = await execFileAsync("docker", [
    "ps",
    "--filter",
    "label=easyshell.mode=session",
    "--format",
    `{{.Names}} {{.Label "${SESSION_EXPIRES_LABEL}"}}`,
  ])
  const expired: string[] = []
  for (const line of stdout.split("\n")) {
    const [name, expires] = line.trim().split(/\s+/)
    if (!name || !isSafeContainerName(name) || !expires) continue
    const at = Number(expires)
    if (Number.isFinite(at) && at * 1000 <= nowMs) expired.push(name)
  }
  return expired
}
