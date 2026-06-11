import type { ProblemConfig } from "@easyshell/problems/schema"

import { writeFile } from "fs/promises"
import { cp } from "fs/promises"
import { readFile } from "fs/promises"

const SLUG = "get-it-curl"

async function testcaseConfig({
  id,
  isPublic,
  replace,
}: {
  id: number
  isPublic: boolean
  replace: { id: number; content: string; author: string }
}): Promise<ProblemConfig["testcases"][number]> {
  return {
    id: id,
    public: isPublic,
    expected_stdout: replace.content,
    daemonSetup: async ({ image_dir, problem_dir }) => {
      await cp(`${problem_dir}/daemon`, `${image_dir}/daemon`, {
        recursive: true,
      })

      let mainGo = await readFile(`${image_dir}/daemon/main.go`, "utf-8")
      mainGo = mainGo.replaceAll("__ID__", replace.id.toString())
      mainGo = mainGo.replaceAll("__CONTENT__", replace.content)
      mainGo = mainGo.replaceAll("__AUTHOR__", replace.author)
      await writeFile(`${image_dir}/daemon/main.go`, mainGo)

      return `
RUN apk add go
COPY daemon /src/daemon
RUN go build -C /src/daemon -o /daemon
`
    },
  }
}

const config: ProblemConfig = {
  id: 10,
  slug: SLUG,
  title: "Get it Curl",
  description: `Dig up the freshest hot take.`,
  difficulty: "medium",
  tags: ["curl", "jq"],
  testcases: [
    await testcaseConfig({
      id: 1,
      isPublic: true,
      replace: {
        id: 12,
        content: "Just reinvented Twitter. Again.",
        author: "Melon Usk",
      },
    }),
    await testcaseConfig({
      id: 2,
      isPublic: true,
      replace: {
        id: 42,
        content: "Get Excited!",
        author: "Ishigami Senku",
      },
    }),
    await testcaseConfig({
      id: 3,
      isPublic: true,
      replace: {
        id: 69,
        content: `Don't go there 'cause you'll never return
I know you think of me when you think of her
But then it don't make sense when you're trying hard
To do the right thing but without recompense`,
        author: "The Strokes",
      },
    }),
  ],
  tests: [
    {
      testcase: "all",
      pass: true,
      input: `curl -s http://localhost:4000/most-recent-post | jq -j .content`,
    },
    {
      testcase: "all",
      pass: true,
      input: `curl -s http://localhost:4000/most-recent-post | jq -r .content`,
    },
  ],
}

export default config
