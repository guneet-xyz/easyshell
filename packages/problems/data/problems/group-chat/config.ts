import { readFile } from "fs/promises"

import type { ProblemConfig } from "@easyshell/problems/schema"
import { testcaseDir } from "@easyshell/utils/build"

const SLUG = "group-chat"

async function testcaseConfig({
  id,
  isPublic,
}: {
  id: number
  isPublic: boolean
}): Promise<ProblemConfig["testcases"][number]> {
  const messages = JSON.parse(
    await readFile(`${testcaseDir(SLUG, id)}/messages.json`, "utf-8"),
  ) as Array<{ user: string }>

  const counts = new Map<string, number>()
  for (const { user } of messages) {
    counts.set(user, (counts.get(user) ?? 0) + 1)
  }

  const sorted: Record<string, number> = {}
  for (const user of Array.from(counts.keys()).toSorted()) {
    sorted[user] = counts.get(user)!
  }

  return {
    id: id,
    public: isPublic,
    expected_stdout: JSON.stringify(sorted, null, 2),
  }
}

const config: ProblemConfig = {
  id: 66,
  slug: SLUG,
  title: "Group Chat",
  description: `Who's the loudest in the group chat? Everyone says Dave. Dave says it's not Dave. The data doesn't lie. 💬`,
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
      input: `jq 'group_by(.user) | map({(.[0].user): length}) | add // {}' messages.json`,
    },
    {
      testcase: "all",
      pass: true,
      input: `jq 'reduce .[] as $m ({}; .[$m.user] += 1)' messages.json | jq -S .`,
    },
    {
      testcase: "all",
      pass: true,
      input: `jq -r '.[].user' messages.json | sort | uniq -c | while read -r count user; do jq -n --arg u "$user" --argjson c "$count" '{($u): $c}'; done | jq -s 'add // {}'`,
    },
    {
      testcase: "all",
      pass: false,
      input: `jq 'length' messages.json`,
    },
    {
      testcase: [1, 2, 3],
      pass: false,
      input: `jq 'reduce .[] as $m ({}; .[$m.user] += 1)' messages.json`,
    },
  ],
}

export default config
