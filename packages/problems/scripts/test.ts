import { randomBytes } from "crypto"
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "fs/promises"
import { $ } from "execa"

import { getProblemInfo, getProblems } from "@easyshell/problems"
import { problemImageName } from "@easyshell/problems/image"
import { neverThrow } from "@easyshell/utils"
import { PROBLEMS_DIR, WIKI_DIR } from "@easyshell/utils/build"

// The grading rule the coordinator applies to every submission.
import {
  computePassed,
  type ContainerOutput,
} from "../../../apps/coordinator/src/grading/passed-check"
import { SeriesList } from "../data/series"
import { wiki_pages } from "../data/wiki"
import { env } from "../env"
import {
  assertDirExists,
  assertFileExists,
  RunParallelStuff,
  Task,
} from "./_utils"

type Test = {
  name: string
  dependsOn?: string[]
  callable: () => Promise<string | undefined>
}

type TestTree = {
  tests: Test[]
  children?: Array<TestTree | Test>
}

async function main() {
  const args = process.argv.slice(2)
  if (args.length === 0) {
    console.error(
      "Provide one or more problem slugs to test. Type 'all' to test all problems. Type 'base' to run base tests.",
    )
    process.exit(1)
  }

  if (process.env.SKIP_SUBMISSION_TESTS) {
    console.info(
      "Skipping submission tests because SKIP_SUBMISSION_TESTS is set.",
    )
  }

  const tests: Array<Test> = await base_tests()

  if (args.length === 1 && args[0] === "base") {
    // do nothing
  } else if (args.length === 1 && args[0] === "all") {
    for (const problem of await getProblems()) {
      tests.push(...(await construct_tests(problem)))
    }
  } else {
    for (const problem of new Set(args)) {
      tests.push(...(await construct_tests(problem)))
    }
  }

  let total = tests.length
  let failed = 0
  let passed = 0

  function test_to_task(test: (typeof tests)[number]): Task {
    return {
      name: test.name,
      callable: async () => {
        const response = await test.callable()
        if (response === undefined) {
          passed++
        } else {
          failed++
          return `${response}`
        }
      },
    }
  }

  const tasks = tests.map(test_to_task)

  const startedAt = new Date()

  await RunParallelStuff({
    tasks,
    parallel_limit: env.PARALLEL_LIMIT,
  })

  const endedAt = new Date()

  console.log(`Total: ${total}, Passed: ${passed}, Failed: ${failed}`)
  console.log(
    `Took ${(endedAt.getTime() - startedAt.getTime()) / 1000} seconds`,
  )

  if (failed > 0) {
    process.exit(1)
  }
}

function TestTreeToTests(tree: TestTree): Array<Test> {
  const final_tests = Array<Test>()

  function traverse(tree: TestTree, dependsOn: string[] = []) {
    const { tests, children } = tree
    for (const test of tests) {
      final_tests.push({
        name: test.name,
        dependsOn,
        callable: test.callable,
      })
    }
    for (const child of children || []) {
      if ("tests" in child)
        traverse(
          child,
          tests.map((test) => test.name),
        )
      else
        final_tests.push({
          name: child.name,
          dependsOn: tests.map((test) => test.name),
          callable: child.callable,
        })
    }
  }

  traverse(tree)
  return final_tests
}

async function base_tests(): Promise<Array<Test>> {
  const tree: TestTree = {
    tests: [],
    children: [
      {
        name: "assert problems dir exists",
        callable: async () => {
          const { error } = await neverThrow(assertDirExists(PROBLEMS_DIR))
          if (error) return error.message
        },
      },
      {
        name: "series",
        callable: async () => {
          if (
            new Set(SeriesList.map((s) => s.slug)).size !== SeriesList.length
          ) {
            return "duplicate series slugs"
          }

          const problems = await getProblems()
          for (const series of SeriesList) {
            const problems = series.sections.map((s) => s.problems).flat()
            if (new Set(problems).size !== problems.length) {
              return `(series: ${series.slug}) duplicate problem slugs`
            }

            for (const problemSlug of problems) {
              if (!problems.includes(problemSlug))
                return `(series: ${series.slug}) problem slug ${problemSlug} not found`
            }
          }
        },
      },
      {
        name: "(unique problem slugs)",
        callable: async () => {
          const problems = await getProblems()
          const problem_slugs = new Set<string>()
          const duplicates = new Set<string>()
          for (const problem of problems) {
            if (problem_slugs.has(problem)) {
              duplicates.add(problem)
            }
            problem_slugs.add(problem)
          }
          if (duplicates.size > 0)
            return `duplicate problem slugs: ${Array.from(duplicates).join(
              ", ",
            )}`
        },
      },
      {
        name: "(unique problem ids)",
        callable: async () => {
          const problems = await getProblems()
          const id_map = new Map<number, Set<string>>()
          for (const problem of problems) {
            const { error, data } = await neverThrow(getProblemInfo(problem))
            if (error) return error.message
            if (!data) return `no data found for problem ${problem}`
            if (id_map.has(data.id)) {
              id_map.get(data.id)!.add(problem)
            } else {
              id_map.set(data.id, new Set([problem]))
            }
          }
          const duplicates = Array.from(id_map.entries()).filter(
            ([_, problems]) => problems.size > 1,
          )
          if (duplicates.length > 0) {
            return `duplicates found: ${duplicates
              .map(
                ([id, problems]) => `${id}: ${Array.from(problems).join(", ")}`,
              )
              .join("; ")}`
          }
        },
      },
      {
        tests: [
          {
            name: "assert wiki index.ts exists",
            callable: async () => {
              const { error } = await neverThrow(
                assertFileExists(`${WIKI_DIR}/index.ts`),
              )
              if (error) return error.message
            },
          },
          {
            name: "assert wiki pages exists",
            callable: async () => {
              const { error } = await neverThrow(
                assertDirExists(`${WIKI_DIR}/pages`),
              )
              if (error) return error.message
            },
          },
        ],
        children: wiki_pages.map((page) => ({
          tests: [
            {
              name: `(wiki ${page.slug}) assert valid body`,
              callable: async () => {
                const body_path = `${WIKI_DIR}/pages/${page.slug}.mdx`
                const { error } = await neverThrow(assertFileExists(body_path))
                if (error) return error.message

                const text = await readFile(body_path, { encoding: "utf-8" })
                if (text.trim().length === 0) return "body is empty"
              },
            },
            {
              name: `(wiki ${page.slug}) assert valid title`,
              callable: async () => {
                if (page.title.length === 0) return "title is empty"
              },
            },
            {
              name: `(wiki ${page.slug}) assert valid type`,
              callable: async () => {
                if (page.type === "editorial") {
                  if (!(await getProblems()).includes(page.slug))
                    return "corresponding problem does not exist for editorial"
                }
              },
            },
          ],
        })),
      },
    ],
  }

  return TestTreeToTests(tree)
}

async function construct_tests(slug: string): Promise<Array<Test>> {
  const PROBLEM_DIR = `${PROBLEMS_DIR}/${slug}`

  const tree: TestTree = {
    tests: [
      {
        name: `(${slug}) assert problem dir exists`,
        callable: async () => {
          const { error } = await neverThrow(assertDirExists(PROBLEM_DIR))
          if (error) return error.message
        },
      },
    ],
    children: [
      {
        tests: [
          {
            name: `(${slug}) assert config.ts exists`,
            callable: async () => {
              const { error } = await neverThrow(
                assertFileExists(`${PROBLEM_DIR}/config.ts`),
              )
              if (error) return error.message
            },
          },
          {
            name: `(${slug}) assert page.md exists`,
            callable: async () => {
              const { error } = await neverThrow(
                assertFileExists(`${PROBLEM_DIR}/page.md`),
              )
              if (error) return error.message
            },
          },
        ],
        children: await (async (): Promise<Array<Test>> => {
          const tests: Array<Test> = []

          tests.push({
            name: `(${slug}) import`,
            callable: async () => {
              const { error, data } = await neverThrow(getProblemInfo(slug))
              if (error) return error.message
              if (!data) return "no data found"
            },
          })

          if (!process.env.SKIP_SUBMISSION_TESTS) {
            const problemInfo = await getProblemInfo(slug)

            // Every problem must also reject an empty submission.
            const submissionTests = [
              ...(problemInfo.tests ?? []),
              { testcase: "all" as const, pass: false, input: "" },
            ]

            for (const [
              index,
              { testcase, input, pass },
            ] of submissionTests.entries()) {
              const testcaseIds =
                testcase === "all"
                  ? problemInfo.testcases.map((t) => t.id)
                  : testcase instanceof Array
                    ? testcase
                    : [testcase]
              for (const testcaseId of testcaseIds) {
                tests.push({
                  name: `(${slug}) test-${index}-testcase-${testcaseId}`,
                  callable: () =>
                    _runSubmissionTest(slug, testcaseId, input, pass),
                })
              }
            }
          }

          return tests
        })(),
      },
    ],
  }

  return TestTreeToTests(tree)
}

/** Resource limits the coordinator gives every submission container. */
const SUBMISSION_MEMORY = "64m"
const SUBMISSION_CPUS = "0.1"
/** Twice the runner's limit, so that slow CI machines don't fail tests. */
const SUBMISSION_TIMEOUT_MS = 60_000

/**
 * Runs a submission against the locally available testcase image the way the
 * runner does (see apps/runner/src/routers/jobs.ts), and checks that the
 * coordinator's grading gives the expected result.
 */
async function _runSubmissionTest(
  slug: string,
  testcaseId: number,
  input: string,
  pass: boolean,
): Promise<string | undefined> {
  const testcase = (await getProblemInfo(slug)).testcases.find(
    (t) => t.id === testcaseId,
  )
  if (!testcase) return `testcase ${testcaseId} not found`

  const { error, data: output } = await neverThrow(
    _runSubmission(problemImageName(slug, testcaseId), input),
  )
  if (error) return error.message
  if (!output) return "no output"

  if (computePassed(output, testcase) !== pass) {
    if (process.env.DEBUG_STDOUT)
      console.debug(`output (${slug}-${testcaseId} stdout): ${output.stdout}`)
    if (process.env.DEBUG_FS)
      console.debug(
        `output (${slug}-${testcaseId} fs): ${JSON.stringify(output.fs)}`,
      )
    return `expected to ${pass ? "pass" : "fail"} with input: ${input}`
  }
}

async function _runSubmission(
  image: string,
  input: string,
): Promise<ContainerOutput> {
  await mkdir(env.WORKING_DIR, { recursive: true })
  const dir = await mkdtemp(`${env.WORKING_DIR}/test-`)
  const inputPath = `${dir}/input.sh`
  const outputPath = `${dir}/output.json`
  const containerName = `easyshell-test-${randomBytes(8).toString("hex")}`
  try {
    await writeFile(inputPath, input)
    await writeFile(outputPath, "{}")
    await chmod(inputPath, 0o644)
    await chmod(outputPath, 0o666)

    // Tests use the image as built or pulled, never a registry copy.
    await $({
      timeout: SUBMISSION_TIMEOUT_MS,
    })`docker run --rm --pull=never --name ${containerName} --network none --pids-limit 256 --ulimit core=0 -m ${SUBMISSION_MEMORY} --cpus ${SUBMISSION_CPUS} -v ${inputPath}:/input.sh -v ${outputPath}:/output.json ${image} -mode submission`

    const output = JSON.parse(
      await readFile(outputPath, "utf8"),
    ) as Partial<ContainerOutput>
    return {
      stdout: output.stdout ?? "",
      stderr: output.stderr ?? "",
      exit_code: output.exit_code ?? 0,
      fs: output.fs ?? {},
    }
  } finally {
    await $({ reject: false })`docker rm --force ${containerName}`
    await rm(dir, { recursive: true, force: true })
  }
}

await main()
