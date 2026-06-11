import type { ProblemConfig } from "@easyshell/problems/schema"

import { readFile } from "fs/promises"
import { readdir } from "fs/promises"
import { testcaseDir } from "packages/utils/build"
import { join } from "path"

const SLUG = "grep-version"

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
  const matches = /__version__ = \"(.*)\"/gm.exec(text)
  if (!matches) throw Error(`__version__ not found in ${file}`)
  const version = matches[1]
  if (!version) throw Error(`__version__ not found in ${file}`)

  return {
    id: id,
    public: isPublic,
    expected_stdout: version,
  }
}

const config: ProblemConfig = {
  id: 15,
  slug: SLUG,
  title: "Grep Version",
  description: `Print the version of your python package.`,
  difficulty: "medium",
  tags: ["grep", "cat", "find"],
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
  ],
  tests: [
    {
      testcase: "all",
      pass: true,
      input: `cat "$(find -name __about__.py)" | grep -oP '\\d+\\.\\d+\\.\\d+'`,
    },
    {
      testcase: "all",
      pass: true,
      input: `grep -oP '\\d+\\.\\d+\\.\\d+' "$(find -name __about__.py)"`,
    },
  ],
}

export default config
