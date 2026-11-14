import { readFile } from "fs/promises"

import type { ProblemConfig } from "@easyshell/problems/schema"
import { testcaseDir } from "@easyshell/utils/build"

const SLUG = "env-to-json"

async function testcaseConfig({
  id,
  isPublic,
}: {
  id: number
  isPublic: boolean
}): Promise<ProblemConfig["testcases"][number]> {
  const text = await readFile(`${testcaseDir(SLUG, id)}/.env`, "utf-8")

  const env: Record<string, string> = {}
  for (const line of text.split("\n")) {
    if (line.length === 0 || line.startsWith("#")) continue
    const index = line.indexOf("=")
    env[line.slice(0, index)] = line.slice(index + 1)
  }

  return {
    id: id,
    public: isPublic,
    expected_stdout: JSON.stringify(env, null, 2),
  }
}

const config: ProblemConfig = {
  id: 69,
  slug: SLUG,
  title: "Env to JSON",
  description: `The shiny new deploy tool only speaks JSON. Your .env file only speaks .env. Time to translate. 🔁`,
  difficulty: "medium",
  tags: ["jq", "sed", "grep"],
  testcases: [
    await testcaseConfig({ id: 1, isPublic: true }),
    await testcaseConfig({ id: 2, isPublic: true }),
    await testcaseConfig({ id: 3, isPublic: false }),
    await testcaseConfig({ id: 4, isPublic: false }),
  ],
  tests: [
    {
      testcase: "all",
      pass: true,
      input: `jq -Rn '[inputs | select(test("^[^#].*=")) | capture("^(?<k>[^=]+)=(?<v>.*)$") | {(.k): .v}] | add // {}' .env`,
    },
    {
      testcase: "all",
      pass: true,
      input: `grep -v '^#' .env | grep . | jq -Rn 'reduce inputs as $line ({}; . + {($line | split("=")[0]): ($line | split("=")[1:] | join("="))})'`,
    },
    {
      testcase: "all",
      pass: true,
      input: `grep -v -e '^#' -e '^$' .env | sed 's/=/\\t/' | jq -Rn '[inputs | split("\\t") | {(.[0]): .[1]}] | add'`,
    },
    {
      testcase: [3, 4],
      pass: false,
      input: `jq -Rn '[inputs | select(test("^[^#].*=")) | split("=") | {(.[0]): .[1]}] | add' .env`,
    },
    {
      testcase: [3, 4],
      pass: false,
      input: `grep -v '^#' .env | grep . | while IFS== read -r key value; do jq -n --arg k "$key" --arg v "$value" '{($k): $v}'; done | jq -s add`,
    },
    {
      testcase: [4],
      pass: false,
      input: `grep -v -e '^#' -e '^$' .env | sed 's/=/\\t/; s/["'"'"']//g' | jq -Rn '[inputs | split("\\t") | {(.[0]): .[1]}] | add'`,
    },
    {
      testcase: [4],
      pass: false,
      input: `jq -Rn '[inputs | select(test("^[^#].*=")) | capture("^(?<k>[^=]+)=(?<v>.*)$") | {(.k): (.v | gsub("^\\\\s+|\\\\s+$"; ""))}] | add' .env`,
    },
    {
      testcase: [4],
      pass: false,
      input: `grep -v -e '^#' -e '^$' .env | sed 's/^\\([^=]*\\)=\\(.*\\)$/  "\\1": "\\2",/' | sed '$ s/,$//' | { echo '{'; cat; echo '}'; }`,
    },
    {
      testcase: [2, 3, 4],
      pass: false,
      input: `jq -Rn '[inputs | select(length > 0) | capture("^(?<k>[^=]+)=(?<v>.*)$") | {(.k): .v}] | add' .env`,
    },
  ],
}

export default config
