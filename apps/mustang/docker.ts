import { execa, type ExecaError } from "execa"

import { env } from "./env"

const log = (...args: unknown[]) => console.log("[docker]", ...args)

// =============================================================================
// Docker CLI wrapper using execa
// =============================================================================

/** Run `docker run` with the given args. Returns the container ID (stdout). */
export async function dockerRun(
  args: string[],
): Promise<{ stdout: string; stderr: string }> {
  log("run", args.join(" "))
  const result = await execa("docker", ["run", ...args])
  return { stdout: result.stdout.trim(), stderr: result.stderr.trim() }
}

/** Run `docker rm -f <containerName>`. */
export async function dockerRm(containerName: string): Promise<void> {
  log("rm -f", containerName)
  await execa("docker", ["rm", "-f", containerName])
}

/**
 * Run `docker inspect` on a container.
 * Returns null if the container doesn't exist.
 */
export async function dockerInspect(
  containerName: string,
  format?: string,
): Promise<string | null> {
  try {
    const args = ["inspect"]
    if (format) {
      args.push("--format", format)
    }
    args.push(containerName)
    const result = await execa("docker", args)
    return result.stdout.trim()
  } catch {
    return null
  }
}

/**
 * Run `docker exec` in a container.
 * Returns { stdout, stderr, exitCode }.
 */
export async function dockerExec(
  containerName: string,
  command: string[],
  envVars?: Record<string, string>,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const args = ["exec"]
  if (envVars) {
    for (const [key, value] of Object.entries(envVars)) {
      args.push("-e", `${key}=${value}`)
    }
  }
  args.push(containerName, ...command)

  try {
    const result = await execa("docker", args)
    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode ?? 0,
    }
  } catch (err) {
    const execaErr = err as ExecaError
    return {
      stdout: String(execaErr.stdout ?? ""),
      stderr: String(execaErr.stderr ?? ""),
      exitCode: execaErr.exitCode ?? 1,
    }
  }
}

/**
 * Run `docker ps` with the given filters.
 * Returns raw lines of JSON output.
 */
export async function dockerPs(filters: string[]): Promise<string[]> {
  const args = ["ps", "--format", "{{json .}}", "--no-trunc"]
  for (const filter of filters) {
    args.push("--filter", filter)
  }

  const result = await execa("docker", args)
  const output = result.stdout.trim()
  if (!output) return []
  return output.split("\n").filter((line) => line.length > 0)
}

/**
 * Resolve an image name, prefixing with the Docker registry if configured.
 */
export function resolveImageTag(image: string): string {
  if (env.DOCKER_REGISTRY) {
    return `${env.DOCKER_REGISTRY}/easyshell/${image}`
  }
  return image
}
