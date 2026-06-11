import type { ProblemConfig } from "@easyshell/problems/schema"

import { readFile } from "fs/promises"
import { testcaseDir } from "packages/utils/build"

const SLUG = "csv-to-json"

async function testcaseConfig({
  id,
  isPublic,
}: {
  id: number
  isPublic: boolean
}): Promise<ProblemConfig["testcases"][number]> {
  const testcase_dir = testcaseDir(SLUG, id)
  const emails = (await readFile(`${testcase_dir}/clients.csv`, "utf-8"))
    .split("\n")
    .slice(1)
    .filter((line) => line.trim().length > 0)
    .map((line) => line.split(",")[1]!)
  const email_json = JSON.stringify(emails, null, 2)
  return {
    id: id,
    public: isPublic,
    expected_stdout: email_json,
  }
}

const config: ProblemConfig = {
  id: 22,
  slug: SLUG,
  title: "CSV to JSON",
  description: `Extract a CSV column and convert it to JSON.`,
  difficulty: "medium",
  tags: ["tail", "jq", "cut", "awk"],
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
      input: `cat clients.csv | tail -n +2 | cut -d, -f2 | jq -R . | jq -s`,
    },
    {
      testcase: "all",
      pass: true,
      input: `tail -n +2 clients.csv | awk -F, '{print $2}' | jq -R . | jq -s`,
    },
    {
      testcase: "all",
      pass: true,
      input: `tail -n +2 clients.csv | cut -d, -f2 | sed 's/^/"/;s/$/"/' | jq -s`,
    },
  ],
}

export default config
