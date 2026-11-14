import { readFile } from "fs/promises"

import type { ProblemConfig } from "@easyshell/problems/schema"
import { testcaseDir } from "@easyshell/utils/build"

const SLUG = "crew-manifest"

async function testcaseConfig({
  id,
  isPublic,
}: {
  id: number
  isPublic: boolean
}): Promise<ProblemConfig["testcases"][number]> {
  const text = await readFile(`${testcaseDir(SLUG, id)}/manifest.txt`, "utf-8")
  const names = text
    .split("\n")
    .filter((line) => line.length > 0 && !line.startsWith("#"))
    .map((line) => line.split(":")[0])
  return {
    id: id,
    public: isPublic,
    expected_stdout: names.map((name) => `${name}\n`).join(""),
  }
}

const config: ProblemConfig = {
  id: 39,
  slug: SLUG,
  title: "Crew Manifest",
  description: `Who's actually on this spaceship? Captain Shellbeard would like to know. 🚀`,
  difficulty: "easy",
  tags: ["cut", "grep"],
  testcases: [
    await testcaseConfig({ id: 1, isPublic: true }),
    await testcaseConfig({ id: 2, isPublic: true }),
    await testcaseConfig({ id: 3, isPublic: false }),
  ],
  tests: [
    {
      testcase: "all",
      pass: true,
      input: `grep -v '^#' manifest.txt | cut -d: -f1`,
    },
    {
      testcase: "all",
      pass: true,
      input: `awk -F: '!/^#/ { print $1 }' manifest.txt`,
    },
    {
      testcase: "all",
      pass: true,
      input: `sed -e '/^#/d' -e 's/:.*//' manifest.txt`,
    },
    {
      testcase: [2, 3],
      pass: false,
      input: `cut -d: -f1 manifest.txt`,
    },
    {
      testcase: 3,
      pass: false,
      input: `grep -v '#' manifest.txt | cut -d: -f1`,
    },
    {
      testcase: 3,
      pass: false,
      input: `grep -v '^#' manifest.txt | awk -F: '{ print $1 }' | cut -d' ' -f1`,
    },
  ],
}

export default config
