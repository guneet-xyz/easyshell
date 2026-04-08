import { randomBytes } from "node:crypto"
import { mkdir, stat } from "node:fs/promises"
import { isAbsolute, join } from "node:path"

import { env } from "./env"

// =============================================================================
// Validation regexes (ported from Go utils/utils.go)
// =============================================================================

/** Validates a Docker container name (used by all handlers). */
export const validContainerName = /^[a-zA-Z0-9][a-zA-Z0-9_.-]{1,127}$/

/** Validates a Docker image name/tag. */
export const validImageName = /^[a-zA-Z0-9][a-zA-Z0-9_./:@-]+$/

/** Validates a problem slug. */
export const validProblemSlug = /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/

/** Validates a memory/cpu resource limit value. */
export const validResourceLimit = /^[0-9]+(\.[0-9]+)?[kmgKMG]?$/

/** Validates a tmpfs mount path (safe absolute path). */
export const validTmpfsPath = /^\/[a-zA-Z0-9/_.-]+$/

/** Validates a host file path (for submission I/O). */
export const validFilePath = /^\/[a-zA-Z0-9/_.-]+$/

/**
 * Validates a container command argument.
 * Allows single-hyphen flags (e.g. "-mode") but blocks "--" prefixed Docker flags.
 */
export const validCommandArg = /^[a-zA-Z0-9-][a-zA-Z0-9_./:@=-]*$/

/** Allowed container modes. */
export const allowedModes = new Set(["session", "submission", "warm"])

/** Allowed container types. */
export const allowedTypes = new Set(["standard", "k3s"])

/** Allowed cgroupns values. */
export const allowedCgroupNs = new Set(["private", "host"])

// =============================================================================
// ANSI stripping and score parsing (ported from Go utils/utils.go)
// =============================================================================

const ansiRegex = /\x1b\[[0-9;]*[a-zA-Z]/g
const scoreRegex = /Score:\s*(\d+)\/(\d+)\s*\((\d+)%\)/
const passRegex = /\bPASS\b/g
const failRegex = /\bFAIL\b/g

export function stripAnsi(s: string): string {
  return s.replace(ansiRegex, "")
}

export interface ScoreResult {
  score: number
  total: number
  percentage: number
  passed: boolean
  raw_output: string
}

/**
 * Parse score from check.sh output.
 * First tries "Score: X/Y (Z%)" format, then falls back to counting PASS/FAIL lines.
 */
export function parseScore(rawOutput: string): ScoreResult {
  const cleanOutput = stripAnsi(rawOutput)
  const matches = scoreRegex.exec(cleanOutput)

  const result: ScoreResult = {
    score: 0,
    total: 0,
    percentage: 0,
    passed: false,
    raw_output: cleanOutput,
  }

  if (matches && matches.length === 4) {
    result.score = parseInt(matches[1]!, 10)
    result.total = parseInt(matches[2]!, 10)
    result.percentage = parseInt(matches[3]!, 10)
    result.passed = result.score === result.total && result.total > 0
  } else {
    const passCount = (cleanOutput.match(passRegex) ?? []).length
    const failCount = (cleanOutput.match(failRegex) ?? []).length
    result.score = passCount
    result.total = passCount + failCount
    if (result.total > 0) {
      result.percentage = Math.floor((result.score * 100) / result.total)
    }
    result.passed = failCount === 0 && passCount > 0
  }

  return result
}

// =============================================================================
// Container name generation
// =============================================================================

/** Generate a unique container name: easyshell-<12 hex chars>. */
export function generateContainerName(): string {
  return "easyshell-" + randomBytes(6).toString("hex")
}

// =============================================================================
// Directory helpers
// =============================================================================

/** Ensure a directory exists, creating it (and parents) if needed. */
export async function mkdirp(dirPath: string): Promise<void> {
  try {
    const s = await stat(dirPath)
    if (!s.isDirectory()) {
      throw new Error(`Path is not a directory: ${dirPath}`)
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      await mkdir(dirPath, { recursive: true })
    } else {
      throw err
    }
  }
}

/** Get the sessions directory path. */
export function getSessionsDir(): string {
  return join(env.WORKING_DIR, "sessions")
}

/** Get the container-specific directory path. */
export function getContainerDir(containerName: string): string {
  return join(getSessionsDir(), containerName)
}

/** Ensure working directories exist. */
export async function initWorkingDirs(): Promise<void> {
  if (!isAbsolute(env.WORKING_DIR)) {
    throw new Error("WORKING_DIR must be an absolute path")
  }
  await mkdirp(env.WORKING_DIR)
  await mkdirp(getSessionsDir())
}
