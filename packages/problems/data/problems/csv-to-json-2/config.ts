import type { ProblemConfig } from "@easyshell/problems/schema"

import { readFile } from "fs/promises"
import { testcaseDir } from "packages/utils/build"

const SLUG = "csv-to-json-2"

async function testcaseConfig({
  id,
  isPublic,
}: {
  id: number
  isPublic: boolean
}): Promise<ProblemConfig["testcases"][number]> {
  const testcase_dir = testcaseDir(SLUG, id)
  const json = (await readFile(`${testcase_dir}/clients.csv`, "utf-8"))
    .split("\n")
    .slice(1)
    .filter((line) => line.trim().length > 0)
    .map((line) => line.split(","))
    .map((cols) => {
      return {
        id: parseInt(cols[0]!.trim()),
        email: cols[1]!.trim(),
        name: cols[2]!.trim(),
      }
    })
  const json_string = JSON.stringify(json, null, 2)
  return {
    id: id,
    public: isPublic,
    expected_stdout: json_string,
  }
}

const config: ProblemConfig = {
  id: 24,
  slug: SLUG,
  title: "CSV to JSON 2",
  description: `Convert each row of a CSV file into a JSON object and output a JSON list.`,
  difficulty: "hard",
  tags: ["jq", "awk", "cat"],
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
      input: `
ids=$(cat clients.csv | tail -n +2 | awk -F, '{print $1}' | jq --slurp)
emails=$(cat clients.csv | tail -n +2 | awk -F, '{print $2}' | jq . -R | jq --slurp)
names=$(cat clients.csv | tail -n +2 | awk -F, '{print $3}' | jq . -R | jq --slurp)

echo $ids $emails $names | jq -s 'transpose[] | {id: .[0], email: .[1], name: .[2]}' | jq --slurp
`,
    },
  ],
}

export default config
