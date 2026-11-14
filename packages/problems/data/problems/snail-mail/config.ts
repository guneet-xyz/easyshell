import { readFile } from "fs/promises"

import type { ProblemConfig } from "@easyshell/problems/schema"
import { testcaseDir } from "@easyshell/utils/build"

const SLUG = "snail-mail"

async function testcaseConfig({
  id,
  isPublic,
}: {
  id: number
  isPublic: boolean
}): Promise<ProblemConfig["testcases"][number]> {
  const log = await readFile(`${testcaseDir(SLUG, id)}/access.log`, "utf-8")
  const requests = log
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const fields = line.split(" ")
      const ms = fields[10]!
      // The method field still has the opening quote of the request line.
      return {
        ms: Number(ms),
        text: `${ms} ${fields[5]!.slice(1)} ${fields[6]}`,
      }
    })

  return {
    id: id,
    public: isPublic,
    // toSorted is stable: ties keep their log order.
    expected_stdout: requests
      .toSorted((a, b) => b.ms - a.ms)
      .slice(0, 5)
      .map((r) => r.text)
      .join("\n"),
  }
}

const config: ProblemConfig = {
  id: 55,
  slug: SLUG,
  title: "Snail Mail",
  description: `Some requests are slower than a snail carrying a fridge. 🐌`,
  difficulty: "medium",
  tags: ["sort", "awk", "head"],
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
      input: `awk '{print $NF, substr($6, 2), $7}' access.log | sort -s -k1,1nr | head -n 5`,
    },
    {
      testcase: "all",
      pass: true,
      input: `awk '{print $NF, $6, $7}' access.log | tr -d '"' | sort -s -rn -k1,1 | head -5`,
    },
    {
      testcase: "all",
      pass: true,
      input: `awk '{print NR, $NF, substr($6, 2), $7}' access.log | sort -k2,2nr -k1,1n | head -n 5 | cut -d' ' -f2-`,
    },
    {
      // Sorts the times as text.
      testcase: "all",
      pass: false,
      input: `awk '{print $NF, substr($6, 2), $7}' access.log | sort -r | head -n 5`,
    },
    {
      // Without -s, sort orders ties by the rest of the line.
      testcase: [2, 5],
      pass: false,
      input: `awk '{print $NF, substr($6, 2), $7}' access.log | sort -k1,1nr | head -n 5`,
    },
    {
      testcase: [2, 5],
      pass: false,
      input: `awk '{print $NF, substr($6, 2), $7}' access.log | sort -nr | head -n 5`,
    },
  ],
}

export default config
