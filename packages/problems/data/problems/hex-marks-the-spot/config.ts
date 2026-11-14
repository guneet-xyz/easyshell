import { readFile } from "fs/promises"

import type { ProblemConfig } from "@easyshell/problems/schema"
import { testcaseDir } from "@easyshell/utils/build"

const SLUG = "hex-marks-the-spot"

async function testcaseConfig({
  id,
  isPublic,
}: {
  id: number
  isPublic: boolean
}): Promise<ProblemConfig["testcases"][number]> {
  const map = await readFile(`${testcaseDir(SLUG, id)}/map.hex`, "utf-8")

  return {
    id: id,
    public: isPublic,
    expected_stdout: Buffer.from(map.replace(/\s/g, ""), "hex").toString(
      "utf-8",
    ),
  }
}

const config: ProblemConfig = {
  id: 85,
  slug: SLUG,
  title: "Hex Marks the Spot",
  description: `Captain Shellbeard saved his treasure map as hex. Arr, matey. 🗺️`,
  difficulty: "medium",
  tags: ["xxd"],
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
      input: `xxd -r -p map.hex`,
    },
    {
      testcase: "all",
      pass: true,
      input: `tr -d '\\n' < map.hex | sed 's/../\\\\x&/g' | xargs -0 printf '%b'`,
    },
    {
      testcase: "all",
      pass: true,
      input: `printf "$(tr -d '\\n' < map.hex | sed 's/../\\\\x&/g')"`,
    },
    {
      testcase: "all",
      pass: false,
      input: `xxd map.hex`,
    },
    {
      testcase: "all",
      pass: false,
      input: `xxd -r map.hex`,
    },
  ],
}

export default config
