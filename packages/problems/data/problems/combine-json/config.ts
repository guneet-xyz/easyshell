import type { ProblemConfig } from "@easyshell/problems/schema"
import { getFs, testcaseDir } from "@easyshell/utils/build"

import { execa } from "execa"

const SLUG = "combine-json"

async function testcaseConfig({
  id,
  isPublic,
}: {
  id: number
  isPublic: boolean
}): Promise<ProblemConfig["testcases"][number]> {
  const testcase_dir = testcaseDir(SLUG, id)
  const { stdout: output } = await execa(
    "bash",
    ["-c", `find . -name '*.json' -exec cat {} + | jq -s 'sort_by(.id)'`],
    { cwd: testcase_dir },
  )

  const fs = await getFs(testcase_dir)
  fs["products.json"] = output + "\n"

  return {
    id: id,
    public: isPublic,
    expected_fs: fs,
  }
}

const config: ProblemConfig = {
  id: 17,
  slug: SLUG,
  title: "Combine multiple JSON files",
  description: `Combine a pie of product JSONs.`,
  difficulty: "medium",
  tags: ["jq", "find", "xargs", "cat"],
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
  ],
  tests: [
    {
      testcase: "all",
      pass: true,
      input: `find . -name '*.json' -exec cat {} + | jq -s 'sort_by(.id)' > products.json`,
    },
    {
      testcase: "all",
      pass: true,
      input: `find . -name '*.json' | xargs -I{} cat {} | jq --slurp 'sort_by(.id)' > products.json`,
    },
  ],
}

export default config
