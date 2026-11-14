import { readFile } from "fs/promises"

import type { ProblemConfig } from "@easyshell/problems/schema"
import { testcaseDir } from "@easyshell/utils/build"

const SLUG = "who-knocked"

async function testcaseConfig({
  id,
  isPublic,
}: {
  id: number
  isPublic: boolean
}): Promise<ProblemConfig["testcases"][number]> {
  const log = await readFile(`${testcaseDir(SLUG, id)}/access.log`, "utf-8")
  const ips = new Set(
    log
      .split("\n")
      .filter(Boolean)
      .map((line) => line.split(" ")[0]),
  )

  return {
    id: id,
    public: isPublic,
    expected_stdout: ips.size.toString(),
  }
}

const config: ProblemConfig = {
  id: 51,
  slug: SLUG,
  title: "Who Knocked?",
  description: `Your Twitter clone went viral overnight. How many humans (or toasters) showed up? 🚪`,
  difficulty: "easy",
  tags: ["cut", "sort", "uniq", "wc"],
  testcases: [
    await testcaseConfig({ id: 1, isPublic: true }),
    await testcaseConfig({ id: 2, isPublic: true }),
    await testcaseConfig({ id: 3, isPublic: false }),
    await testcaseConfig({ id: 4, isPublic: false }),
    await testcaseConfig({ id: 5, isPublic: false }),
  ],
  tests: [
    {
      testcase: "all",
      pass: true,
      input: `cut -d' ' -f1 access.log | sort -u | wc -l`,
    },
    {
      testcase: "all",
      pass: true,
      input: `awk '{print $1}' access.log | sort | uniq | wc -l`,
    },
    {
      testcase: "all",
      pass: true,
      input: `awk '!seen[$1]++' access.log | wc -l`,
    },
    {
      testcase: "all",
      pass: false,
      input: `wc -l < access.log`,
    },
    {
      testcase: "all",
      pass: false,
      input: `wc -l access.log`,
    },
    {
      // uniq only merges neighbouring lines.
      testcase: [1, 2, 3, 4],
      pass: false,
      input: `cut -d' ' -f1 access.log | uniq | wc -l`,
    },
  ],
}

export default config
