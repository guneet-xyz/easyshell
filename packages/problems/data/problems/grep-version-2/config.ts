import type { ProblemConfig } from "@easyshell/problems/schema"
import { testcaseDir } from "@easyshell/utils/build"

import { readFile } from "fs/promises"
import { readdir } from "fs/promises"
import { join } from "path"

const SLUG = "grep-version-2"

async function testcaseConfig({
  id,
  isPublic,
}: {
  id: number
  isPublic: boolean
}): Promise<ProblemConfig["testcases"][number]> {
  const testcase_dir = testcaseDir(SLUG, id)
  const file = (await readdir(testcase_dir, { recursive: true })).find((path) =>
    path.endsWith("__about__.py"),
  )
  if (!file) throw Error(`__about__.py not found in ${testcase_dir}`)

  const text = (await readFile(join(testcase_dir, file))).toString()
  const regex = /^[^#'"]?\s*__version__\s*=\s*['"](.*)['"]/gm
  const matches = Array.from(text.matchAll(regex))
  if (!matches) throw Error(`__version__ not found in ${file}`)
  const version = matches[matches.length - 1]?.[1]
  if (!version) throw Error(`__version__ not found in ${file}`)

  return {
    id: id,
    public: isPublic,
    expected_stdout: version,
  }
}

const config: ProblemConfig = {
  id: 16,
  slug: SLUG,
  title: "Grep Version 2",
  description: "Extract version number from your project",
  difficulty: "hard",
  tags: ["grep", "find", "tail"],
  testcases: [
    await testcaseConfig({
      id: 1,
      isPublic: true,
    }),
    await testcaseConfig({
      id: 2,
      isPublic: true,
    }),
    await testcaseConfig({
      id: 3,
      isPublic: false,
    }),
    await testcaseConfig({
      id: 4,
      isPublic: false,
    }),
    await testcaseConfig({
      id: 5,
      isPublic: false,
    }),
  ],
  tests: [
    {
      testcase: "all",
      pass: true,
      input: `cat "$(find -name __about__.py)" | grep -oP '^[^#'\\''"]?\\s*__version__\\s*=\\s*['\\''"]\\K.*(?=['\\''"])' | tail -n 1`,
    },
    {
      testcase: "all",
      pass: true,
      input: `cat "$(find . -name __about__.py)" | grep -P '^\\s*__version__\\s*=\\s*.*' | tail -n 1 | grep -oP '(?<=["'\\''])(.*)(?=["'\\''])'`,
    },
  ],
}

export default config
