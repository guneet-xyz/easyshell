import { readFile } from "fs/promises"

import type { ProblemConfig } from "@easyshell/problems/schema"
import { testcaseDir } from "@easyshell/utils/build"

const SLUG = "ini-detective"

async function testcaseConfig({
  id,
  isPublic,
}: {
  id: number
  isPublic: boolean
}): Promise<ProblemConfig["testcases"][number]> {
  const text = await readFile(`${testcaseDir(SLUG, id)}/config.ini`, "utf-8")

  let section: string | undefined
  const ports: Array<string> = []
  for (const line of text.split("\n")) {
    if (line.startsWith(";")) continue
    const header = /^\[(.*)\]$/.exec(line)
    if (header) {
      section = header[1]
      continue
    }
    const entry = /^([^=]*)=(.*)$/.exec(line)
    if (section === "database" && entry && entry[1]!.trim() === "port") {
      ports.push(entry[2]!.trim())
    }
  }
  if (ports.length !== 1) {
    throw new Error(`${SLUG}/${id}: expected exactly one database port`)
  }

  return {
    id: id,
    public: isPublic,
    expected_stdout: ports[0]!,
  }
}

const config: ProblemConfig = {
  id: 70,
  slug: SLUG,
  title: "INI Detective",
  description: `Which port is the database on? The config file knows, and it's not making it easy. 🔧`,
  difficulty: "medium",
  tags: ["awk", "sed", "grep"],
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
      input: `awk -F= '/^\\[/ {s = $0} s == "[database]" && $1 ~ /^[ \\t]*port[ \\t]*$/ {gsub(/[ \\t]/, "", $2); print $2}' config.ini`,
    },
    {
      testcase: "all",
      pass: true,
      input: `sed -n '/^\\[database\\]/,/^\\[/p' config.ini | grep -E '^ *port *=' | cut -d= -f2 | tr -d ' '`,
    },
    {
      testcase: "all",
      pass: true,
      input: `awk -F' *= *' '/^\\[/ {in_db = ($0 == "[database]")} in_db && $1 == "port" {print $2}' config.ini`,
    },
    {
      testcase: "all",
      pass: false,
      input: `grep port config.ini | head -1`,
    },
    {
      testcase: [3, 4],
      pass: false,
      input: `grep -A5 '\\[database' config.ini | grep '^port' | head -1 | cut -d= -f2 | tr -d ' '`,
    },
    {
      testcase: [4],
      pass: false,
      input: `sed -n '/^\\[database\\]/,/^\\[/p' config.ini | grep port | head -1 | cut -d= -f2 | tr -d ' '`,
    },
  ],
}

export default config
