// ====================================================
// Utility exports that are available during build time
// (can also be used in problem configs)
// ====================================================
import { readdir, readFile, stat } from "fs/promises"
import { join } from "path"
import { $ } from "execa"

import type { FsType } from "@easyshell/problems/schema"

import { strToDate } from "."

let _PROJECT_ROOT = process.env.PROJECT_ROOT

if (!_PROJECT_ROOT) {
  try {
    _PROJECT_ROOT = $.sync`git rev-parse --show-toplevel`.stdout
  } catch (e) {
    throw Error("Not a git repository")
  }
}

export const PROJECT_ROOT = _PROJECT_ROOT
export const PROBLEMS_DIR = `${PROJECT_ROOT}/packages/problems/data/problems`
export const WIKI_DIR = `${PROJECT_ROOT}/packages/problems/data/wiki`

export async function getFs(path: string): Promise<FsType> {
  const files = await readdir(path, { recursive: true })
  const fs: FsType = {}
  for (const file of files) {
    const isFile = (await stat(join(path, file))).isFile()
    if (isFile) fs[file] = (await readFile(join(path, file))).toString()
  }
  return fs
}

export function testcaseDir(problemSlug: string, testcaseId: number) {
  return `${PROBLEMS_DIR}/${problemSlug}/testcases/${testcaseId}`
}

/**
 * Get the last modified date of a file.
 * Tries to use git. Uses stat as fallback.
 * Git will fail if file is not tracked or git is not installed.
 * Stat will fail if file does not exist.
 */
export async function lastModified(
  path: string,
  fallback = true,
): Promise<Date> {
  try {
    const result = await $`git log -1 --format="%aI" -- ${path}`
    const date = strToDate(result.stdout)
    if (!date) {
      throw new Error("Invalid date")
    }
    return date
  } catch {
    if (fallback) {
      const statResult = await stat(path)
      return statResult.mtime
    }
    throw new Error("Git failed. Fallback is disabled.")
  }
}
