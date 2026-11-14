import { readFile } from "fs/promises"

import type { ProblemConfig } from "@easyshell/problems/schema"
import { testcaseDir } from "@easyshell/utils/build"

const SLUG = "traffic-light"

const ACTIONS: Record<string, string> = {
  red: "STOP",
  yellow: "SLOW DOWN",
  green: "GO",
}

async function testcaseConfig({
  id,
  isPublic,
}: {
  id: number
  isPublic: boolean
}): Promise<ProblemConfig["testcases"][number]> {
  const light = (
    await readFile(`${testcaseDir(SLUG, id)}/light.txt`, "utf-8")
  ).trimEnd()

  return {
    id: id,
    public: isPublic,
    expected_stdout: `${ACTIONS[light] ?? "CALL A MECHANIC"}\n`,
  }
}

const config: ProblemConfig = {
  id: 35,
  slug: SLUG,
  title: "Traffic Light",
  description: `The intern wrote the city's traffic light controller and quit. Red means stop. Purple means panic. 🚥`,
  difficulty: "easy",
  tags: ["case", "if"],
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
      input: `case $(cat light.txt) in red) echo STOP;; yellow) echo 'SLOW DOWN';; green) echo GO;; *) echo 'CALL A MECHANIC';; esac`,
    },
    {
      testcase: "all",
      pass: true,
      input: `c=$(cat light.txt)
if [ "$c" = red ]; then
  echo STOP
elif [ "$c" = yellow ]; then
  echo "SLOW DOWN"
elif [ "$c" = green ]; then
  echo GO
else
  echo "CALL A MECHANIC"
fi`,
    },
    {
      testcase: [4, 5],
      pass: false,
      input: `case $(cat light.txt) in red) echo STOP;; yellow) echo 'SLOW DOWN';; green) echo GO;; esac`,
    },
    {
      testcase: 5,
      pass: false,
      input: `case $(tr A-Z a-z < light.txt) in red) echo STOP;; yellow) echo 'SLOW DOWN';; green) echo GO;; *) echo 'CALL A MECHANIC';; esac`,
    },
  ],
}

export default config
