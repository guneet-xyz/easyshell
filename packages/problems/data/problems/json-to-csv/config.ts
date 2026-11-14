import { readFile } from "fs/promises"

import type { ProblemConfig } from "@easyshell/problems/schema"
import { testcaseDir } from "@easyshell/utils/build"

const SLUG = "json-to-csv"

/** Quotes a string the way jq's `@csv` does. */
function csvString(value: string) {
  return `"${value.replaceAll(`"`, `""`)}"`
}

async function testcaseConfig({
  id,
  isPublic,
}: {
  id: number
  isPublic: boolean
}): Promise<ProblemConfig["testcases"][number]> {
  const users = JSON.parse(
    await readFile(`${testcaseDir(SLUG, id)}/users.json`, "utf-8"),
  ) as Array<{ id: number; name: string; email: string }>

  const lines = [
    ["id", "name", "email"].map(csvString).join(","),
    ...users.map(
      (user) => `${user.id},${csvString(user.name)},${csvString(user.email)}`,
    ),
  ]

  return {
    id: id,
    public: isPublic,
    expected_stdout: lines.join("\n"),
  }
}

const config: ProblemConfig = {
  id: 67,
  slug: SLUG,
  title: "JSON to CSV",
  description: `Finance wants the users as a spreadsheet. By lunch. Of course they do. 📈`,
  difficulty: "medium",
  tags: ["jq"],
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
      input: `jq -r '["id", "name", "email"], (.[] | [.id, .name, .email]) | @csv' users.json`,
    },
    {
      testcase: "all",
      pass: true,
      input: `echo '"id","name","email"'; jq -r '.[] | [.id, .name, .email] | @csv' users.json`,
    },
    {
      testcase: "all",
      pass: true,
      input: `echo '"id","name","email"'; jq -r '.[] | "\\(.id),\\"\\(.name | gsub("\\""; "\\"\\""))\\",\\"\\(.email)\\""' users.json`,
    },
    {
      testcase: "all",
      pass: false,
      input: `echo id,name,email; jq -r '.[] | "\\(.id),\\(.name),\\(.email)"' users.json`,
    },
    {
      testcase: "all",
      pass: false,
      input: `echo id,name,email; jq -r '.[] | [.id, .name, .email] | @csv' users.json`,
    },
  ],
}

export default config
