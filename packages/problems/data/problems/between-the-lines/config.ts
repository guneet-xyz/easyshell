import { readFile } from "fs/promises"

import type { ProblemConfig } from "@easyshell/problems/schema"
import { testcaseDir } from "@easyshell/utils/build"

const SLUG = "between-the-lines"

const BEGIN = "-----BEGIN SECRET-----"
const END = "-----END SECRET-----"

async function testcaseConfig({
  id,
  isPublic,
}: {
  id: number
  isPublic: boolean
}): Promise<ProblemConfig["testcases"][number]> {
  const text = await readFile(`${testcaseDir(SLUG, id)}/vault.txt`, "utf-8")
  const secrets: Array<string> = []
  let inside = false
  for (const line of text.split("\n").slice(0, -1)) {
    if (line === BEGIN) inside = true
    else if (line === END) inside = false
    else if (inside) secrets.push(line)
  }
  return {
    id: id,
    public: isPublic,
    expected_stdout: secrets.map((line) => `${line}\n`).join(""),
  }
}

const config: ProblemConfig = {
  id: 45,
  slug: SLUG,
  title: "Between the Lines",
  description: `The good stuff is always between BEGIN and END. Skip the bread, keep the filling. 🥪`,
  difficulty: "medium",
  tags: ["sed", "awk"],
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
      input: `awk '/^-----END SECRET-----$/ { f = 0 } f; /^-----BEGIN SECRET-----$/ { f = 1 }' vault.txt`,
    },
    {
      testcase: "all",
      pass: true,
      input: `sed -n '/^-----BEGIN SECRET-----$/,/^-----END SECRET-----$/p' vault.txt | sed -e '/^-----BEGIN SECRET-----$/d' -e '/^-----END SECRET-----$/d'`,
    },
    {
      testcase: "all",
      pass: true,
      input: `awk '$0 == "-----BEGIN SECRET-----" { inside = 1; next } $0 == "-----END SECRET-----" { inside = 0; next } inside { print }' vault.txt`,
    },
    {
      testcase: "all",
      pass: false,
      input: `sed -n '/BEGIN SECRET/,/END SECRET/p' vault.txt`,
    },
    {
      testcase: 4,
      pass: false,
      input: `awk '/END SECRET/ { f = 0 } f; /BEGIN SECRET/ { f = 1 }' vault.txt`,
    },
    {
      testcase: 3,
      pass: false,
      input: `sed -n '/^-----BEGIN SECRET-----$/,/^-----END SECRET-----$/p' vault.txt | grep -v -e '-----' -e '^$'`,
    },
  ],
}

export default config
