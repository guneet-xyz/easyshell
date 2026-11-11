// Lists the problems whose images must be rebuilt and tested for a change, and
// splits them into batches for a CI matrix. Prints JSON to stdout:
//
//   { "base": "<commit>" | null, "all": boolean, "problems": [...], "batches": [{ "id", "problems" }] }
//
// A problem is selected when its own directory changed since the base, or when
// a shared image input changed (then every problem is). Without a base, such
// as before the first release, every problem is selected.
//
// Usage: pnpm run changed (--base <ref> | --since-release) [--head <ref>] [--max-batches <n>]
//
// --since-release uses the newest vX.Y.Z tag reachable from the head's parent,
// the previous release when the head is a release commit or a release PR.
import { $ } from "execa"

import { getProblems } from "@easyshell/problems"
import { PROJECT_ROOT } from "@easyshell/utils/build"

const PROBLEMS_PREFIX = "packages/problems/data/problems/"

/** Changes under these paths can change every problem image. */
const SHARED_IMAGE_INPUTS = [
  // The entrypoint compiled into every image.
  "apps/entrypoint/",
  // Build-time utilities that problem configs use.
  "packages/utils/",
  // The build script with the base image, the config schema and the tests.
  "packages/problems/",
  // How problem images are built and published.
  ".github/workflows/publish-problem-images.yml",
]

/** Paths under a shared input that don't affect problem images. */
const NOT_IMAGE_INPUTS = [
  "packages/problems/data/",
  "packages/problems/README.md",
]

function selectProblems(
  changedFiles: Array<string>,
  problems: Array<string>,
): { all: boolean; problems: Array<string> } {
  const changed = new Set<string>()
  for (const file of changedFiles) {
    if (file.startsWith(PROBLEMS_PREFIX)) {
      const problem = file.slice(PROBLEMS_PREFIX.length).split("/")[0]
      if (problem) changed.add(problem)
      continue
    }
    if (NOT_IMAGE_INPUTS.some((path) => file.startsWith(path))) continue
    if (SHARED_IMAGE_INPUTS.some((path) => file.startsWith(path)))
      return { all: true, problems: [...problems] }
  }
  // Deleted problems have nothing to build.
  return { all: false, problems: problems.filter((p) => changed.has(p)) }
}

function toBatches(
  problems: Array<string>,
  maxBatches: number,
): Array<{ id: string; problems: string }> {
  if (problems.length === 0) return []
  const size = Math.ceil(problems.length / maxBatches)
  const batches: Array<{ id: string; problems: string }> = []
  for (let i = 0; i < problems.length; i += size) {
    batches.push({
      id: String(batches.length + 1).padStart(2, "0"),
      problems: problems.slice(i, i + size).join(" "),
    })
  }
  return batches
}

function parseArgs(args: Array<string>) {
  const options: {
    base?: string
    sinceRelease: boolean
    head: string
    maxBatches: number
  } = { sinceRelease: false, head: "HEAD", maxBatches: 12 }
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    const value = () => {
      const v = args[++i]
      if (!v) throw new Error(`${arg} needs a value`)
      return v
    }
    if (arg === "--base") options.base = value()
    else if (arg === "--head") options.head = value()
    else if (arg === "--since-release") options.sinceRelease = true
    else if (arg === "--max-batches") options.maxBatches = parseInt(value(), 10)
    else throw new Error(`Unknown argument: ${arg}`)
  }
  if (!options.base === !options.sinceRelease)
    throw new Error("Pass exactly one of --base <ref> and --since-release")
  if (!(options.maxBatches > 0))
    throw new Error("--max-batches must be positive")
  return options
}

async function git(...args: Array<string>) {
  return (await $({ cwd: PROJECT_ROOT })`git ${args}`).stdout.trim()
}

async function previousRelease(head: string): Promise<string | null> {
  const { stdout, exitCode } = await $({
    cwd: PROJECT_ROOT,
    reject: false,
  })`git describe --tags --abbrev=0 --match v[0-9]*.[0-9]*.[0-9]* ${head}^`
  return exitCode === 0 ? stdout.trim() : null
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const head = await git("rev-parse", "--verify", `${options.head}^{commit}`)
  const baseRef = options.sinceRelease
    ? await previousRelease(head)
    : options.base!
  const problems = (await getProblems()).sort()

  let base: string | null = null
  let selection: { all: boolean; problems: Array<string> }
  if (baseRef === null) {
    console.error("No previous release: selecting every problem.")
    selection = { all: true, problems }
  } else {
    base = await git("merge-base", baseRef, head)
    const changedFiles = (
      await git("diff", "--name-only", "--no-renames", base, head)
    )
      .split("\n")
      .filter(Boolean)
    selection = selectProblems(changedFiles, problems)
    console.error(
      `Changes since ${baseRef} (${base.slice(0, 12)}): ${
        selection.all
          ? "a shared image input changed, selecting every problem"
          : `${selection.problems.length} problem(s) changed`
      }.`,
    )
  }

  console.log(
    JSON.stringify({
      base,
      all: selection.all,
      problems: selection.problems,
      batches: toBatches(selection.problems, options.maxBatches),
    }),
  )
}

await main()
